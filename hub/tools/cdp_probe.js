#!/usr/bin/env node
/**
 * cdp_probe.js — Automated Chrome DevTools Protocol (CDP) Discovery & Inspector
 *
 * Implements non-intrusive automated discovery for Chromium/Electron desktop applications:
 *   - Auto-scans localhost ports for active CDP debugger endpoints.
 *   - Probes /json/version and /json/list to enumerate active pages, web workers, and iframes.
 *   - Correlates ports to process names (Antigravity, Doubao, ZCode, Codex).
 *   - 100% background and read-only: never steals mouse/keyboard focus or interrupts user UI.
 *
 * Usage:
 *   node hub/tools/cdp_probe.js [--json]
 *   node hub/tools/cdp_probe.js targets --port <port> [--json]
 *   node hub/tools/cdp_probe.js eval --port <port> --expr "document.title"
 */

const http = require('http');
const { spawnSync } = require('child_process');

const KNOWN_CDP_PORTS = [9222, 9225, 9234, 9238, 9240, 9229, 9333];

function fetchJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { timeout: timeoutMs }, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`Failed to parse JSON from ${url}: ${err.message}`));
        }
      });
    });
    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout fetching ${url}`));
    });
    req.on('error', (err) => reject(err));
  });
}

function getListeningTcpPorts() {
  const ports = new Set(KNOWN_CDP_PORTS);
  try {
    const out = spawnSync('netstat', ['-ano', '-p', 'tcp'], { encoding: 'utf8' }).stdout || '';
    for (const line of out.split('\n')) {
      const match = line.match(/127\.0\.0\.1:(\d+)\s+.*LISTENING\s+(\d+)/i);
      if (match) {
        const port = parseInt(match[1], 10);
        // Only include candidate devtools range (9000-9500)
        if (port >= 9200 && port <= 9300) {
          ports.add(port);
        }
      }
    }
  } catch {}
  return Array.from(ports).sort((a, b) => a - b);
}

async function probePort(port) {
  try {
    const ver = await fetchJson(`http://127.0.0.1:${port}/json/version`, 2000);
    let targets = [];
    try {
      targets = await fetchJson(`http://127.0.0.1:${port}/json/list`, 2000);
    } catch {}

    let guessedApp = 'Chromium/Electron';
    const ua = ver['User-Agent'] || '';
    if (/Antigravity/i.test(ua)) guessedApp = 'Antigravity Desktop';
    else if (/ZCode/i.test(ua)) guessedApp = 'ZCode Desktop';
    else if (/Doubao/i.test(ua) || targets.some((t) => /doubao/i.test(t.url))) guessedApp = 'Doubao Desktop';
    else if (/Codex/i.test(ua) || targets.some((t) => /codex/i.test(t.url))) guessedApp = 'Codex Desktop';

    return {
      ok: true,
      port,
      app: guessedApp,
      browser: ver.Browser,
      protocolVersion: ver['Protocol-Version'],
      userAgent: ver['User-Agent'],
      webSocketDebuggerUrl: ver.webSocketDebuggerUrl,
      targetCount: targets.length,
      targets: targets.map((t) => ({
        id: t.id,
        type: t.type,
        title: t.title,
        url: t.url,
        wsUrl: t.webSocketDebuggerUrl,
      })),
    };
  } catch {
    return { ok: false, port };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes('--json');
  const portArgIndex = args.indexOf('--port');
  const targetPort = portArgIndex >= 0 ? parseInt(args[portArgIndex + 1], 10) : null;

  if (targetPort) {
    const res = await probePort(targetPort);
    if (jsonMode) {
      console.log(JSON.stringify(res, null, 2));
    } else {
      console.log(`=== Port ${targetPort} Probe: ${res.ok ? '🟢 ONLINE' : '🔴 OFFLINE'} ===`);
      if (res.ok) {
        console.log(`App: ${res.app}`);
        console.log(`Browser: ${res.browser}`);
        console.log(`WS URL: ${res.webSocketDebuggerUrl}`);
        console.log(`Targets (${res.targetCount}):`);
        for (const t of res.targets) {
          console.log(`  - [${t.type}] ${t.title} -> ${t.url}`);
        }
      }
    }
    return;
  }

  const ports = getListeningTcpPorts();
  const promises = ports.map((p) => probePort(p));
  const results = (await Promise.all(promises)).filter((r) => r.ok);

  if (jsonMode) {
    console.log(JSON.stringify({ ok: true, activeEndpoints: results }, null, 2));
  } else {
    console.log(`=== Discovered ${results.length} Active CDP Debugger Endpoints on localhost ===`);
    console.log('PORT\tAPP\t\t\tBROWSER\t\t\tTARGETS');
    console.log('----\t---\t\t\t-------\t\t\t-------');
    for (const r of results) {
      console.log(
        `${r.port}\t${(r.app + '                ').slice(0, 20)}\t${(r.browser + '            ').slice(0, 24)}\t${r.targetCount} pages`
      );
      for (const t of r.targets) {
        console.log(`   └─ [${t.type}] ${(t.title || '(untitled)').slice(0, 40)} -> ${t.url.slice(0, 60)}`);
      }
    }
  }
}

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
} else {
  module.exports = { probePort, getListeningTcpPorts };
}
