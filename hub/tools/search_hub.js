#!/usr/bin/env node
/**
 * search_hub.js — Unified Multi-Provider Search & Extract Rotator Gateway
 *
 * Aggregates and automatically rotates across 22 keys in 3 providers:
 *   1. Tavily   (9 keys × 1,000 credits/mo = 9,000 credits/mo) — AI Search + Batch URL Extract
 *   2. SerpApi  (10 keys × 250 searches/mo = 2,500 searches/mo) — Google / Scholar / News / Patents + `site:` / `filetype:`
 *   3. AnySearch (3 keys) — General & Vertical Domain Search + Extract fallback
 *
 * Features:
 *   - Smart Query Routing: auto-routes `site:` / `filetype:` / `intitle:` / `--engine google_scholar` to SerpApi;
 *     general queries to Tavily -> SerpApi -> AnySearch.
 *   - Automatic Key Rotation: round-robin / quota-aware selection across all keys in `channels/_private/sites.local.json`.
 *   - Circuit Breaker & Failover: on HTTP 429/403/432 or timeout, marks key in cooldown and transparently retries next key/provider.
 *   - Zero-Cost Quota Sync (`status --sync`): refreshes all 19 SerpApi + Tavily keys via `/account.json` and `/usage` (0 credit cost).
 *
 * Usage:
 *   node hub/tools/search_hub.js search "<query>" [--provider auto|tavily|serpapi|anysearch] [--engine google|google_scholar|google_news|google_patents] [--max 5] [--domains github.com,arxiv.org] [--depth basic|advanced] [--json]
 *   node hub/tools/search_hub.js extract "<url1,url2>" [--provider auto|tavily|anysearch] [--json]
 *   node hub/tools/search_hub.js status [--sync] [--json]
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const CANONICAL_ROOT = 'e:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const ROOT_DIR = fs.existsSync(path.join(CANONICAL_ROOT, 'channels', '_private', 'sites.local.json'))
  ? CANONICAL_ROOT
  : path.resolve(__dirname, '..', '..');
const PRIVATE_DIR = path.join(ROOT_DIR, 'channels', '_private');
const VAULT_PATH = path.join(PRIVATE_DIR, 'sites.local.json');
const STATE_PATH = path.join(PRIVATE_DIR, 'search_state.local.json');
const ANYSEARCH_CLI = 'C:\\Users\\COLORFIRE\\.zcode\\skills\\anysearch\\scripts\\anysearch_cli.js';
const PROXY_URL = 'http://127.0.0.1:7892';

function maskKey(k) {
  if (!k || k.length < 12) return '***';
  return `${k.slice(0, 8)}...${k.slice(-4)}`;
}

function loadVault() {
  if (!fs.existsSync(VAULT_PATH)) {
    throw new Error(`Missing credential vault: ${VAULT_PATH}`);
  }
  return JSON.parse(fs.readFileSync(VAULT_PATH, 'utf8'));
}

function loadState(vault) {
  let state = {
    updatedAt: null,
    cursors: { tavily: 0, serpapi: 0, anysearch: 0 },
    keys: { tavily: {}, serpapi: {}, anysearch: {} },
    stats: { totalSearches: 0, totalExtracts: 0, failovers: 0 },
  };
  if (fs.existsSync(STATE_PATH)) {
    try {
      const raw = JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
      state = { ...state, ...raw, cursors: { ...state.cursors, ...(raw.cursors || {}) }, keys: { ...state.keys, ...(raw.keys || {}) } };
    } catch {}
  }
  // Initialize key entries from vault
  for (const item of (vault.tavily && vault.tavily.keys) || []) {
    if (!state.keys.tavily[item.name]) {
      state.keys.tavily[item.name] = {
        name: item.name,
        fingerprint: maskKey(item.key),
        remaining: item.name === 'ct' ? 554 : 1000,
        limit: 1000,
        localCalls: 0,
        errors: 0,
        cooldownUntil: null,
        lastUsedAt: null,
      };
    }
  }
  for (const item of (vault.serpapi && vault.serpapi.keys) || []) {
    if (!state.keys.serpapi[item.name]) {
      state.keys.serpapi[item.name] = {
        name: item.name,
        fingerprint: maskKey(item.key),
        remaining: item.name === 'cosmostxy' ? 249 : 250,
        limit: 250,
        localCalls: 0,
        errors: 0,
        cooldownUntil: null,
        lastUsedAt: null,
      };
    }
  }
  for (const item of (vault.anysearch && vault.anysearch.keys) || []) {
    const id = item.role;
    if (!state.keys.anysearch[id]) {
      state.keys.anysearch[id] = {
        name: id,
        fingerprint: maskKey(item.key),
        remaining: null,
        limit: null,
        localCalls: 0,
        errors: 0,
        cooldownUntil: null,
        lastUsedAt: null,
      };
    }
  }
  return state;
}

function saveState(state) {
  state.updatedAt = new Date().toISOString();
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function curlRequest(args, timeoutSec = 15) {
  const t0 = Date.now();
  let res = spawnSync(
    'curl.exe',
    ['-s', '-w', '\n%{http_code}', '--max-time', String(timeoutSec), '-x', PROXY_URL, ...args],
    { encoding: 'utf8', timeout: (timeoutSec + 3) * 1000, windowsHide: true }
  );
  let usedProxy = true;
  if (res.status !== 0 || !res.stdout || res.stdout.trim() === '000') {
    usedProxy = false;
    res = spawnSync('curl.exe', ['-s', '-w', '\n%{http_code}', '--max-time', String(timeoutSec), ...args], {
      encoding: 'utf8',
      timeout: (timeoutSec + 3) * 1000,
      windowsHide: true,
    });
  }
  const ms = Date.now() - t0;
  const out = (res.stdout || '').trim();
  const lines = out.split(/\r?\n/);
  const httpCode = Number(lines.pop() || 0);
  const bodyStr = lines.join('\n');
  let data = null;
  try {
    data = JSON.parse(bodyStr);
  } catch {
    data = { raw: bodyStr.slice(0, 500) };
  }
  return { httpCode, ms, usedProxy, data };
}

/**
 * Pick an ordered list of candidate keys for a provider using round-robin + quota health check.
 */
function getCandidateKeys(provider, vault, state) {
  const now = Date.now();
  let rawList = [];
  if (provider === 'tavily') rawList = (vault.tavily && vault.tavily.keys) || [];
  else if (provider === 'serpapi') rawList = (vault.serpapi && vault.serpapi.keys) || [];
  else if (provider === 'anysearch') {
    rawList = ((vault.anysearch && vault.anysearch.keys) || []).map((k) => ({ name: k.role, key: k.key }));
  }
  if (!rawList.length) return [];

  const n = rawList.length;
  const start = (state.cursors[provider] || 0) % n;
  const rotated = [];
  for (let i = 0; i < n; i++) {
    rotated.push(rawList[(start + i) % n]);
  }
  // Filter out keys in cooldown or with <= 3 remaining quota (keep as last-resort if all filtered)
  const healthy = rotated.filter((item) => {
    const ks = state.keys[provider][item.name];
    if (!ks) return true;
    if (ks.cooldownUntil && new Date(ks.cooldownUntil).getTime() > now) return false;
    if (typeof ks.remaining === 'number' && ks.remaining <= 3) return false;
    return true;
  });
  return healthy.length > 0 ? healthy : rotated;
}

function markKeySuccess(provider, keyName, creditCost, state) {
  const ks = state.keys[provider][keyName];
  if (ks) {
    ks.localCalls = (ks.localCalls || 0) + 1;
    ks.lastUsedAt = new Date().toISOString();
    ks.cooldownUntil = null;
    if (typeof ks.remaining === 'number' && creditCost > 0) {
      ks.remaining = Math.max(0, ks.remaining - creditCost);
    }
  }
  state.cursors[provider] = ((state.cursors[provider] || 0) + 1);
}

function markKeyFailure(provider, keyName, httpCode, state) {
  const ks = state.keys[provider][keyName];
  if (ks) {
    ks.errors = (ks.errors || 0) + 1;
    // 429 -> 10 min cooldown; 401/403/432 -> 12h cooldown
    const cooldownMs = httpCode === 429 ? 10 * 60 * 1000 : 60 * 60 * 1000;
    ks.cooldownUntil = new Date(Date.now() + cooldownMs).toISOString();
  }
  state.cursors[provider] = ((state.cursors[provider] || 0) + 1);
  state.stats.failovers = (state.stats.failovers || 0) + 1;
}

function runTavilySearch(query, opts, vault, state) {
  const candidates = getCandidateKeys('tavily', vault, state);
  const depth = opts.depth === 'advanced' ? 'advanced' : 'basic';
  const cost = depth === 'advanced' ? 2 : 1;
  const maxResults = Number(opts.max || 5);

  for (const cand of candidates) {
    const payload = {
      query,
      search_depth: depth,
      max_results: maxResults,
      include_answer: true,
    };
    if (opts.topic) payload.topic = opts.topic;
    if (opts.timeRange) payload.time_range = opts.timeRange;
    if (opts.domains && opts.domains.length) payload.include_domains = opts.domains;

    const r = curlRequest([
      '-X',
      'POST',
      'https://api.tavily.com/search',
      '-H',
      'Content-Type: application/json',
      '-H',
      `Authorization: Bearer ${cand.key}`,
      '-d',
      JSON.stringify(payload),
    ]);

    if (r.httpCode === 200 && r.data && Array.isArray(r.data.results)) {
      markKeySuccess('tavily', cand.name, cost, state);
      return {
        ok: true,
        provider: 'tavily',
        keyName: cand.name,
        keyFingerprint: maskKey(cand.key),
        latencyMs: r.ms,
        query,
        answer: r.data.answer || null,
        results: r.data.results.map((x) => ({
          title: x.title,
          url: x.url,
          snippet: x.content,
          score: x.score,
        })),
      };
    }
    markKeyFailure('tavily', cand.name, r.httpCode, state);
  }
  return { ok: false, provider: 'tavily', error: 'All Tavily keys failed or exhausted' };
}

function runSerpApiSearch(query, opts, vault, state) {
  const candidates = getCandidateKeys('serpapi', vault, state);
  let engine = opts.engine || 'google';
  if (engine === 'scholar') engine = 'google_scholar';
  if (engine === 'news') engine = 'google_news';
  if (engine === 'patents') engine = 'google_patents';
  const num = Number(opts.max || 5);

  let finalQuery = query;
  if (opts.domains && opts.domains.length && !/\bsite:/i.test(finalQuery)) {
    finalQuery = `${opts.domains.map((d) => `site:${d}`).join(' OR ')} ${finalQuery}`;
  }

  for (const cand of candidates) {
    const params = new URLSearchParams({
      engine,
      q: finalQuery,
      num: String(num),
      api_key: cand.key,
    });
    if (opts.hl) params.set('hl', opts.hl);
    if (opts.gl) params.set('gl', opts.gl);

    const r = curlRequest([`https://serpapi.com/search.json?${params.toString()}`]);
    const list =
      (r.data && (r.data.organic_results || r.data.news_results || r.data.video_results)) || null;
    if (r.httpCode === 200 && Array.isArray(list)) {
      const cached = Boolean(r.data.search_metadata && r.data.search_metadata.cached);
      markKeySuccess('serpapi', cand.name, cached ? 0 : 1, state);
      return {
        ok: true,
        provider: 'serpapi',
        engine,
        cached,
        keyName: cand.name,
        keyFingerprint: maskKey(cand.key),
        latencyMs: r.ms,
        query: finalQuery,
        answer: (r.data.answer_box && (r.data.answer_box.answer || r.data.answer_box.snippet)) || null,
        results: list.slice(0, num).map((x) => ({
          title: x.title,
          url: x.link,
          snippet: x.snippet || (x.publication_info && x.publication_info.summary) || '',
          date: x.date || null,
        })),
      };
    }
    markKeyFailure('serpapi', cand.name, r.httpCode, state);
  }
  return { ok: false, provider: 'serpapi', error: 'All SerpApi keys failed or exhausted' };
}

function runAnySearch(query, opts, vault, state) {
  if (!fs.existsSync(ANYSEARCH_CLI)) {
    return { ok: false, provider: 'anysearch', error: 'anysearch_cli.js not found' };
  }
  const candidates = getCandidateKeys('anysearch', vault, state);
  const maxResults = Math.min(10, Math.max(1, Number(opts.max || 5)));

  for (const cand of candidates) {
    const t0 = Date.now();
    const res = spawnSync(
      'node',
      [ANYSEARCH_CLI, 'search', query, '--max_results', String(maxResults), '--api_key', cand.key],
      { encoding: 'utf8', timeout: 20000, windowsHide: true }
    );
    const ms = Date.now() - t0;
    if (res.status === 0 && res.stdout && res.stdout.trim().length > 20) {
      markKeySuccess('anysearch', cand.name, 1, state);
      // Sync active key to .env if needed
      if (vault.anysearch && vault.anysearch.env_file) {
        try {
          fs.writeFileSync(vault.anysearch.env_file, `ANYSEARCH_API_KEY=${cand.key}\n`, 'utf8');
        } catch {}
      }
      let parsed = null;
      try {
        parsed = JSON.parse(res.stdout.trim());
      } catch {}
      const items = (parsed && (parsed.results || parsed.data)) || [];
      return {
        ok: true,
        provider: 'anysearch',
        keyName: cand.name,
        keyFingerprint: maskKey(cand.key),
        latencyMs: ms,
        query,
        answer: null,
        rawText: Array.isArray(items) && items.length ? undefined : res.stdout.trim(),
        results: Array.isArray(items)
          ? items.map((x) => ({
              title: x.title || x.name,
              url: x.url || x.link,
              snippet: x.snippet || x.content || x.description || '',
            }))
          : [],
      };
    }
    markKeyFailure('anysearch', cand.name, res.status || 500, state);
  }
  return { ok: false, provider: 'anysearch', error: 'All AnySearch keys failed' };
}

function executeSearchWithFailover(query, opts = {}) {
  const vault = loadVault();
  const state = loadState(vault);
  const normOpts = {
    provider: (opts.provider || 'auto').toLowerCase(),
    engine: opts.engine || null,
    max: Number(opts.max || 5),
    depth: opts.depth || 'basic',
    topic: opts.topic || null,
    timeRange: opts.timeRange || opts['time-range'] || null,
    domains: Array.isArray(opts.domains)
      ? opts.domains
      : opts.domains
      ? String(opts.domains).split(',').map((s) => s.trim()).filter(Boolean)
      : [],
    hl: opts.hl || null,
    gl: opts.gl || null,
  };

  let chain = ['tavily', 'serpapi', 'anysearch'];
  const hasGoogleSyntax = /\b(site:|filetype:|intitle:|inurl:)/i.test(query);
  if (normOpts.provider === 'serpapi' || (normOpts.provider === 'auto' && (hasGoogleSyntax || normOpts.engine))) {
    chain = ['serpapi', 'tavily', 'anysearch'];
  } else if (normOpts.provider === 'tavily') {
    chain = ['tavily', 'serpapi', 'anysearch'];
  } else if (normOpts.provider === 'anysearch') {
    chain = ['anysearch', 'tavily', 'serpapi'];
  }

  let result = null;
  for (const prov of chain) {
    if (prov === 'tavily') result = runTavilySearch(query, normOpts, vault, state);
    else if (prov === 'serpapi') result = runSerpApiSearch(query, normOpts, vault, state);
    else if (prov === 'anysearch') result = runAnySearch(query, normOpts, vault, state);
    if (result && result.ok) break;
  }

  state.stats.totalSearches = (state.stats.totalSearches || 0) + 1;
  saveState(state);
  return result || { ok: false, query, error: 'All search providers failed' };
}

function executeExtractWithFailover(urlsInput, opts = {}) {
  const urls = Array.isArray(urlsInput)
    ? urlsInput
    : String(urlsInput)
        .split(',')
        .map((u) => u.trim())
        .filter(Boolean);
  const vault = loadVault();
  const state = loadState(vault);
  const prov = (opts.provider || 'auto').toLowerCase();

  let finalOut = null;
  if (prov === 'auto' || prov === 'tavily') {
    const candidates = getCandidateKeys('tavily', vault, state);
    for (const cand of candidates) {
      const r = curlRequest([
        '-X',
        'POST',
        'https://api.tavily.com/extract',
        '-H',
        'Content-Type: application/json',
        '-H',
        `Authorization: Bearer ${cand.key}`,
        '-d',
        JSON.stringify({ urls, extract_depth: opts.depth || 'basic' }),
      ]);
      if (r.httpCode === 200 && r.data && Array.isArray(r.data.results)) {
        const creditCost = Math.max(1, Math.ceil(r.data.results.length / 5));
        markKeySuccess('tavily', cand.name, creditCost, state);
        finalOut = {
          ok: true,
          provider: 'tavily',
          keyName: cand.name,
          keyFingerprint: maskKey(cand.key),
          latencyMs: r.ms,
          results: r.data.results,
          failedResults: r.data.failed_results || [],
        };
        break;
      }
      markKeyFailure('tavily', cand.name, r.httpCode, state);
    }
  }

  if (!finalOut && (prov === 'auto' || prov === 'anysearch') && fs.existsSync(ANYSEARCH_CLI)) {
    const candidates = getCandidateKeys('anysearch', vault, state);
    for (const cand of candidates) {
      const t0 = Date.now();
      const res = spawnSync('node', [ANYSEARCH_CLI, 'extract', urls[0], '--api_key', cand.key], {
        encoding: 'utf8',
        timeout: 20000,
        windowsHide: true,
      });
      if (res.status === 0 && res.stdout && res.stdout.trim().length > 20) {
        markKeySuccess('anysearch', cand.name, 1, state);
        finalOut = {
          ok: true,
          provider: 'anysearch',
          keyName: cand.name,
          keyFingerprint: maskKey(cand.key),
          latencyMs: Date.now() - t0,
          results: [{ url: urls[0], raw_content: res.stdout.trim() }],
        };
        break;
      }
      markKeyFailure('anysearch', cand.name, res.status || 500, state);
    }
  }

  state.stats.totalExtracts = (state.stats.totalExtracts || 0) + 1;
  saveState(state);
  return finalOut || { ok: false, urls, error: 'All extract providers failed' };
}

function cmdSearch(args) {
  const query = args._.slice(1).join(' ').trim() || args.q || args.query;
  if (!query) {
    console.error('Usage: node hub/tools/search_hub.js search "<query>" [--provider auto|tavily|serpapi|anysearch] [--engine google|google_scholar] [--max 5] [--domains a.com,b.com] [--json]');
    process.exit(1);
  }
  const result = executeSearchWithFailover(query, args);
  if (!result || !result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }
  if (args.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }
  console.log(`=== SearchHub Result [provider=${result.provider} | key=${result.keyName} (${result.keyFingerprint}) | ${result.latencyMs}ms] ===`);
  if (result.answer) {
    console.log(`\n[AI Answer Summary]\n${result.answer}\n`);
  }
  if (result.rawText) {
    console.log(result.rawText);
    return;
  }
  result.results.forEach((r, idx) => {
    console.log(`${idx + 1}. ${r.title}`);
    console.log(`   URL: ${r.url}`);
    if (r.snippet) console.log(`   ${String(r.snippet).replace(/\s+/g, ' ').slice(0, 260)}`);
  });
}

function cmdExtract(args) {
  const rawUrls = args._.slice(1).join(',') || args.url || args.urls;
  if (!rawUrls) {
    console.error('Usage: node hub/tools/search_hub.js extract "<url1,url2,...>" [--provider auto|tavily|anysearch] [--json]');
    process.exit(1);
  }
  const finalOut = executeExtractWithFailover(rawUrls, args);
  if (!finalOut || !finalOut.ok) {
    console.error(JSON.stringify(finalOut, null, 2));
    process.exit(1);
  }
  if (args.json) {
    console.log(JSON.stringify(finalOut, null, 2));
    return;
  }
  console.log(`=== SearchHub Extract [provider=${finalOut.provider} | key=${finalOut.keyName} (${finalOut.keyFingerprint}) | ${finalOut.latencyMs}ms] ===`);
  for (const item of finalOut.results) {
    console.log(`\n--- URL: ${item.url} (${(item.raw_content || '').length} chars) ---`);
    console.log((item.raw_content || '').slice(0, 2000));
  }
}

function cmdStatus(args) {
  const vault = loadVault();
  const state = loadState(vault);

  if (args.sync) {
    for (const item of (vault.serpapi && vault.serpapi.keys) || []) {
      const r = curlRequest([`https://serpapi.com/account.json?api_key=${item.key}`], 8);
      if (r.httpCode === 200 && r.data) {
        const left = r.data.total_searches_left ?? r.data.plan_searches_left;
        if (typeof left === 'number') state.keys.serpapi[item.name].remaining = left;
      }
    }
    for (const item of (vault.tavily && vault.tavily.keys) || []) {
      const r = curlRequest(['-H', `Authorization: Bearer ${item.key}`, 'https://api.tavily.com/usage'], 8);
      if (r.httpCode === 200 && r.data && r.data.account) {
        const left = (r.data.account.plan_limit || 1000) - (r.data.account.plan_usage || 0);
        state.keys.tavily[item.name].remaining = left;
      }
    }
    saveState(state);
  }

  const tavilyTotal = Object.values(state.keys.tavily).reduce((acc, k) => acc + (k.remaining || 0), 0);
  const serpTotal = Object.values(state.keys.serpapi).reduce((acc, k) => acc + (k.remaining || 0), 0);

  if (args.json) {
    console.log(JSON.stringify({ tavilyTotal, serpTotal, state }, null, 2));
    return;
  }

  console.log('=== SearchHub Rotator Pool Status (22 Keys Across 3 Providers) ===');
  console.log(`  - Tavily Pool   (9 keys):  ${tavilyTotal} / 9000 credits left | Next cursor index: ${state.cursors.tavily % 9}`);
  for (const k of Object.values(state.keys.tavily)) {
    console.log(`      [${k.name.padEnd(10)}] (${k.fingerprint}) remaining=${String(k.remaining).padStart(4)}/1000 | localCalls=${k.localCalls} | errors=${k.errors} | cooldown=${k.cooldownUntil || 'none'}`);
  }
  console.log(`  - SerpApi Pool  (10 keys): ${serpTotal} / 2500 searches left | Next cursor index: ${state.cursors.serpapi % 10}`);
  for (const k of Object.values(state.keys.serpapi)) {
    console.log(`      [${k.name.padEnd(10)}] (${k.fingerprint}) remaining=${String(k.remaining).padStart(4)}/250  | localCalls=${k.localCalls} | errors=${k.errors} | cooldown=${k.cooldownUntil || 'none'}`);
  }
  console.log(`  - AnySearch Pool (3 keys): Next cursor index: ${state.cursors.anysearch % 3}`);
  for (const k of Object.values(state.keys.anysearch)) {
    console.log(`      [${k.name.padEnd(10)}] (${k.fingerprint}) localCalls=${k.localCalls} | errors=${k.errors} | cooldown=${k.cooldownUntil || 'none'}`);
  }
}

/**
 * Local HTTP Gateway Mode (`node hub/tools/search_hub.js serve [--port 8899]`)
 */
function cmdServe(args) {
  const http = require('http');
  const port = Number(args.port || 8899);
  const server = http.createServer((req, res) => {
    const u = new URL(req.url, `http://127.0.0.1:${port}`);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    if (req.method === 'GET' && u.pathname === '/status') {
      const vault = loadVault();
      const state = loadState(vault);
      res.end(JSON.stringify({ ok: true, state }));
      return;
    }
    if (req.method === 'GET' && u.pathname === '/search') {
      const q = u.searchParams.get('q') || u.searchParams.get('query');
      const out = executeSearchWithFailover(q, {
        provider: u.searchParams.get('provider') || 'auto',
        engine: u.searchParams.get('engine') || null,
        max: u.searchParams.get('max') || 5,
        domains: u.searchParams.get('domains') || '',
      });
      res.statusCode = out.ok ? 200 : 502;
      res.end(JSON.stringify(out));
      return;
    }
    if (req.method === 'POST' && (u.pathname === '/search' || u.pathname === '/extract')) {
      let body = '';
      req.on('data', (chunk) => (body += chunk));
      req.on('end', () => {
        try {
          const payload = JSON.parse(body || '{}');
          const out =
            u.pathname === '/search'
              ? executeSearchWithFailover(payload.query || payload.q, payload)
              : executeExtractWithFailover(payload.urls || payload.url, payload);
          res.statusCode = out.ok ? 200 : 502;
          res.end(JSON.stringify(out));
        } catch (e) {
          res.statusCode = 400;
          res.end(JSON.stringify({ ok: false, error: e.message }));
        }
      });
      return;
    }
    res.statusCode = 404;
    res.end(JSON.stringify({ ok: false, error: 'Endpoints: GET/POST /search, POST /extract, GET /status' }));
  });
  server.listen(port, '127.0.0.1', () => {
    console.log(`SearchHub HTTP Gateway listening on http://127.0.0.1:${port} (/search, /extract, /status)`);
  });
}

/**
 * Stdio MCP Server Mode (`node hub/tools/search_hub.js mcp`)
 * Exposes `search_hub_search` and `search_hub_extract` to any MCP host (Claude Code, Codex, ZCode, WorkBuddy, OpenCode).
 */
function cmdMcp() {
  const readline = require('readline');
  const rl = readline.createInterface({ input: process.stdin, terminal: false });

  function send(msg) {
    process.stdout.write(JSON.stringify(msg) + '\n');
  }

  rl.on('line', (line) => {
    if (!line.trim()) return;
    let req;
    try {
      req = JSON.parse(line);
    } catch {
      return;
    }
    const { id, method, params } = req;
    if (method === 'initialize') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: { name: 'search-hub-rotator', version: '1.0.0' },
        },
      });
    } else if (method === 'tools/list') {
      send({
        jsonrpc: '2.0',
        id,
        result: {
          tools: [
            {
              name: 'search_hub_search',
              description:
                'Unified search rotator across 9 Tavily keys (9,000/mo), 10 SerpApi keys (2,500/mo, supports site:/filetype:/google_scholar), and 3 AnySearch keys with automatic failover.',
              inputSchema: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'Search query (supports site:, filetype:)' },
                  provider: { type: 'string', enum: ['auto', 'tavily', 'serpapi', 'anysearch'], default: 'auto' },
                  engine: { type: 'string', description: 'SerpApi engine: google, google_scholar, google_news, google_patents, bing, youtube' },
                  max: { type: 'number', default: 5 },
                  domains: { type: 'string', description: 'Comma-separated domain filter (e.g. github.com,arxiv.org)' },
                },
                required: ['query'],
              },
            },
            {
              name: 'search_hub_extract',
              description: 'Extract clean Markdown content from one or more URLs via rotated Tavily / AnySearch keys.',
              inputSchema: {
                type: 'object',
                properties: {
                  urls: { type: 'string', description: 'Comma-separated URLs to extract' },
                  provider: { type: 'string', enum: ['auto', 'tavily', 'anysearch'], default: 'auto' },
                },
                required: ['urls'],
              },
            },
          ],
        },
      });
    } else if (method === 'tools/call') {
      const toolName = params && params.name;
      const toolArgs = (params && params.arguments) || {};
      if (toolName === 'search_hub_search') {
        const res = executeSearchWithFailover(toolArgs.query, toolArgs);
        send({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }], isError: !res.ok },
        });
      } else if (toolName === 'search_hub_extract') {
        const res = executeExtractWithFailover(toolArgs.urls, toolArgs);
        send({
          jsonrpc: '2.0',
          id,
          result: { content: [{ type: 'text', text: JSON.stringify(res, null, 2) }], isError: !res.ok },
        });
      } else {
        send({ jsonrpc: '2.0', id, error: { code: -32601, message: `Unknown tool: ${toolName}` } });
      }
    } else if (id !== undefined) {
      send({ jsonrpc: '2.0', id, result: {} });
    }
  });
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (!next || next.startsWith('--')) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else if (a === '-q' && argv[i + 1]) {
      out.q = argv[++i];
    } else {
      out._.push(a);
    }
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const sub = (args._[0] || 'status').toLowerCase();
  if (sub === 'search' || sub === 's') return cmdSearch(args);
  if (sub === 'extract' || sub === 'e') return cmdExtract(args);
  if (sub === 'status' || sub === 'quota') return cmdStatus(args);
  if (sub === 'serve' || sub === 'server') return cmdServe(args);
  if (sub === 'mcp') return cmdMcp();
  console.error(`Unknown subcommand: ${sub}. Expected: search | extract | status | serve | mcp`);
  process.exit(1);
}

main();
