// Keys are borrowed from the center, not read from the skill. The vault stays channels/_private/sites.local.json
// (gitignored); hub/data/key-policy.json says, per key, what happens when one is borrowed — the approval node; and
// every borrow is written to ~/.agent-hub/key-audit.jsonl (who, which key, why, what was decided).
// User 10-20: “做第 1、2 层，密钥从技能里拿走”“秘钥可以拿，但是后续可以在这里加审批节点”.
//
//   key list                                   providers, what each holds, endpoints, policy — never a value
//   key get <provider>[/<name>] --by <who> --why <what for>   the value on stdout, after the policy says yes
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const VAULT = path.join(ROOT, 'channels', '_private', 'sites.local.json');
const POLICY = path.join(ROOT, 'hub', 'data', 'key-policy.json');
const AUDIT = path.join(process.env.HUB_DATA_DIR || path.join(os.homedir(), '.agent-hub'), 'key-audit.jsonl');

/** Field names that hold a secret; everything else (urls, names, quotas) is safe to show. */
const SECRET_FIELD = /^(api_key|key|access_token|refresh_token|password|token|secret|account_id)$/i;

const vault = () => JSON.parse(fs.readFileSync(VAULT, 'utf8'));
const policy = () => {
  try {
    return JSON.parse(fs.readFileSync(POLICY, 'utf8'));
  } catch {
    return { default: 'auto', keys: {} };
  }
};

/** Every secret string in the vault, for masking copies of it (the skill's reference). */
function allSecrets() {
  const out = new Set();
  const walk = (o, k = '') => {
    if (Array.isArray(o)) return o.forEach((x) => walk(x, k));
    if (o && typeof o === 'object') return Object.entries(o).forEach(([kk, v]) => walk(v, kk));
    if (typeof o === 'string' && SECRET_FIELD.test(k) && o.length >= 8) out.add(o);
  };
  walk(vault());
  return [...out];
}

/** The keys one provider holds, by name: its own api_key/access_token, and each entry of tokens/keys. */
function entries(provider, p) {
  const out = [];
  for (const [k, v] of Object.entries(p)) {
    if (typeof v === 'string' && SECRET_FIELD.test(k)) out.push({ name: k, value: v });
    if (Array.isArray(v)) {
      v.forEach((x, i) => {
        if (x && typeof x === 'object') {
          const sk = Object.keys(x).find((f) => SECRET_FIELD.test(f) && typeof x[f] === 'string');
          if (sk) out.push({ name: x.name || x.role || `${k}#${i + 1}`, value: x[sk], usage: x.usage || x.role || x.group });
        }
      });
    }
  }
  return out;
}

function list() {
  const v = vault();
  const pol = policy();
  const lines = [`密钥（值不显示；借用：key get <供应商>[/<名字>] --by <你> --why <用途>）`];
  for (const [prov, p] of Object.entries(v)) {
    if (!p || typeof p !== 'object') continue;
    const es = entries(prov, p);
    if (!es.length) continue;
    const urls = Object.entries(p).filter(([k, x]) => typeof x === 'string' && /url|endpoint/i.test(k)).map(([k, x]) => `${k}=${x}`).join(' ');
    const mode = (pol.keys || {})[prov] || pol.default || 'auto';
    const fieldNote = es.filter((e) => (pol.fields || {})[e.name]).map((e) => `${e.name}:${(pol.fields || {})[e.name]}`).join(' ');
    lines.push(`- ${prov}（${mode === 'auto' ? '自动放行' : mode === 'ask' ? '要人批' : '不外借'}）：${es.map((e) => e.name + (e.usage ? `(${e.usage})` : '')).join('、')}${fieldNote ? `（按字段：${fieldNote}）` : ''}${urls ? `\n    ${urls}` : ''}`);
  }
  return lines.join('\n');
}

/**
 * The approval node. 'auto' lends at once; 'ask' and 'deny' do not lend yet — 'ask' will hand the request to the
 * center's approvals (the same pending-approval card on /m/ the tools use) once that is wired.
 */
function decide(prov, args, field) {
  const pol = policy();
  // A field rule (account passwords, login tokens) wins over the provider rule.
  const mode = (pol.fields || {})[field] || (pol.keys || {})[prov] || pol.default || 'auto';
  if (mode === 'auto') return { ok: true, decision: 'auto' };
  if (mode === 'ask') return { ok: false, decision: 'ask', why: `${prov} 要人批：审批节点还没接到中心的审批卡，现在不外借（改 hub/data/key-policy.json 或找用户）` };
  return { ok: false, decision: 'deny', why: `${prov} 不外借（hub/data/key-policy.json）` };
}

function get(spec, args) {
  const [prov, name] = String(spec || '').split('/');
  if (!prov) throw new Error('key get <供应商>[/<名字>] --by <你> --why <用途>（key list 看有哪些）');
  if (!args.by || !args.why) throw new Error('借密钥要写 --by <你的产品或会话名> 和 --why <用途>，会记进审计');
  const p = vault()[prov];
  if (!p) throw new Error(`没有 ${prov}（key list 看有哪些）`);
  const es = entries(prov, p);
  const e = name ? es.find((x) => x.name === name) : es[0];
  if (!e) throw new Error(`${prov} 下没有 ${name}；有：${es.map((x) => x.name).join('、')}`);
  const d = decide(prov, args, e.name);
  fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
  fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), by: String(args.by), key: `${prov}/${e.name}`, why: String(args.why), decision: d.decision, lent: d.ok }) + '\n');
  if (!d.ok) throw new Error(d.why);
  return e.value;
}

/** A copy of a text with every vault secret (and anything key-shaped) replaced by how to borrow it. */
function mask(text) {
  let s = text;
  const v = vault();
  for (const [prov, p] of Object.entries(v)) {
    if (!p || typeof p !== 'object') continue;
    for (const e of entries(prov, p)) if (e.value && e.value.length >= 8) s = s.split(e.value).join(`<借用：key get ${prov}/${e.name}>`);
  }
  for (const sec of allSecrets()) s = s.split(sec).join('<借用：key get>');
  return s.replace(/\b(sk-|tvly-)[A-Za-z0-9_-]{16,}/g, '<借用：key get>').replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '<借用：key get>');
}

module.exports = { list, get, mask, allSecrets };
