// Keys are borrowed from the center, not read from the skill. The vault stays channels/_private/sites.local.json
// (gitignored). Whether a borrow is lent is decided by the center's one rule table, hub/data/security-policy.json
// (action key.borrow; default allow), and every borrow goes into ~/.agent-hub/key-audit.jsonl (who, which key, why,
// the decision and the rule). User 10-20: “密钥从技能里拿走”“秘钥可以拿，但是后续可以在这里加审批节点”“中心一道闸门、
// 一个审批队列、一本账……默认仍放行”.
//
//   key list                                   providers, what each holds, endpoints, any rule on it — never a value
//   key get <provider>[/<name>] --by <who> --why <what for>   the value on stdout, when the rule allows
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const VAULT = path.join(ROOT, 'channels', '_private', 'sites.local.json');
const POLICY = path.join(ROOT, 'hub', 'data', 'security-policy.json');
const AUDIT = path.join(process.env.HUB_DATA_DIR || path.join(os.homedir(), '.agent-hub'), 'key-audit.jsonl');
const gate = require('./security_gate.cjs');

/** Field names that hold a secret; everything else (urls, names, quotas) is safe to show. */
const SECRET_FIELD = /^(api_key|key|access_token|refresh_token|password|token|secret|account_id)$/i;

const vault = () => JSON.parse(fs.readFileSync(VAULT, 'utf8'));
const policy = () => {
  try {
    return JSON.parse(fs.readFileSync(POLICY, 'utf8'));
  } catch {
    return { default: 'allow', rules: [] };
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

/**
 * The first key.borrow rule whose target and who match, else the table's default. Target: '*', '<provider>/*' or
 * '<provider>/<name>'; who: { product, session, task }, product matched against --by.
 */
function ruleFor(pol, args, key) {
  const q = { action: 'key.borrow', target: key, product: args.by, session: args.session, task: args.task };
  const res = gate.evaluate(pol, q);
  return { decision: res.decision, rule: res.rule };
}

function list(args = {}) {
  const pol = policy();
  const WORD = { allow: '放行', ask: '要批', deny: '不借' };
  const lines = [`密钥（值不显示；借用：key get <供应商>[/<名字>] --by <你> --why <用途>；规则在 hub/data/security-policy.json，默认放行）`];
  for (const [prov, p] of Object.entries(vault())) {
    if (!p || typeof p !== 'object') continue;
    const es = entries(prov, p);
    if (!es.length) continue;
    const urls = Object.entries(p).filter(([k, x]) => typeof x === 'string' && /url|endpoint/i.test(k)).map(([k, x]) => `${k}=${x}`).join(' ');
    const names = es.map((e) => {
      const d = ruleFor(pol, args, `${prov}/${e.name}`).decision;
      return e.name + (e.usage ? `(${e.usage})` : '') + (d !== (pol.default || 'allow') ? `[${WORD[d] || d}]` : '');
    });
    lines.push(`- ${prov}：${names.join('、')}${urls ? `\n    ${urls}` : ''}`);
  }
  return lines.join('\n');
}

function get(spec, args) {
  const [prov, name] = String(spec || '').split('/');
  if (!prov) throw new Error('key get <供应商>[/<名字>] --by <你> --why <用途>（key list 看有哪些）');
  if (!args.by || !args.why) throw new Error('借密钥要写 --by <你的产品或会话名> 和 --why <用途>，会记进账本');
  const p = vault()[prov];
  if (!p) throw new Error(`没有 ${prov}（key list 看有哪些）`);
  const es = entries(prov, p);
  const e = name ? es.find((x) => x.name === name) : es[0];
  if (!e) throw new Error(`${prov} 下没有 ${name}；有：${es.map((x) => x.name).join('、')}`);
  const key = `${prov}/${e.name}`;
  const pol = policy();
  const q = { action: 'key.borrow', target: key, product: args.by, session: args.session, task: args.task, layer: 'L1' };
  const { decision, rule } = gate.evaluate(pol, q);
  gate.audit(q, { decision, rule });
  fs.mkdirSync(path.dirname(AUDIT), { recursive: true });
  fs.appendFileSync(AUDIT, JSON.stringify({ at: new Date().toISOString(), by: String(args.by), key, why: String(args.why), decision, rule, lent: decision === 'allow' }) + '\n');
  if (decision === 'ask') {
    try {
      const { spawnSync } = require('child_process');
      const curl = spawnSync('curl', ['-s', '--noproxy', '*', '-X', 'POST', 'http://127.0.0.1:8899/api/gateway/request-approval', '-H', 'Content-Type: application/json', '-d', JSON.stringify({ product: args.by, session: args.session, task: args.task, action: 'key.borrow', target: key, reason: `密钥借用：${key}（用途：${args.why}）`, layer: 'L1' })], { encoding: 'utf8', timeout: 3000 });
      if (curl.status === 0 && curl.stdout) {
        const parsed = JSON.parse(curl.stdout);
        if (parsed.allowed) return e.value;
      }
    } catch {}
    throw new Error(`${key} 要人批：已提交中心审批队列（/m/ 审批卡或 agent_gateway.js approve），批准后方可获取（规则 ${rule}，hub/data/security-policy.json）`);
  }
  if (decision !== 'allow') throw new Error(`${key} 不借（规则 ${rule}，hub/data/security-policy.json）`);
  return e.value;
}

/** A copy of a text with every vault secret (and anything key-shaped) replaced by how to borrow it. */
function mask(text) {
  let s = text;
  for (const [prov, p] of Object.entries(vault())) {
    if (!p || typeof p !== 'object') continue;
    for (const e of entries(prov, p)) if (e.value && e.value.length >= 8) s = s.split(e.value).join(`<借用：key get ${prov}/${e.name}>`);
  }
  for (const sec of allSecrets()) s = s.split(sec).join('<借用：key get>');
  return s.replace(/\b(sk-|tvly-)[A-Za-z0-9_-]{16,}/g, '<借用：key get>').replace(/\bAIza[0-9A-Za-z_-]{20,}/g, '<借用：key get>');
}

module.exports = { list, get, mask, allSecrets, ruleFor };
