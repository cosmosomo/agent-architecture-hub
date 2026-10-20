// 唯一规则解释器：CLI 与中心共用；不读取凭证，不在账本保存命令正文。
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../..');
const policyFile = path.join(repo, 'hub/data/security-policy.json');
const decisions = new Set(['allow', 'ask', 'deny']);

function policy() {
  const p = JSON.parse(fs.readFileSync(policyFile, 'utf8'));
  if (!decisions.has(p.default) || !Array.isArray(p.rules)) throw new Error('invalid security-policy default/rules');
  return p;
}

function modeName(value, p = policy()) {
  const mode = value === undefined ? p.defaultMode : value;
  if (typeof mode !== 'string' || !Array.isArray(p.modes[mode])) throw new Error(`未知安全模式: ${String(mode)}`);
  return mode;
}

function expand(value, cwd) {
  let s = String(value).replaceAll('{repo}', repo).replace(/^~(?=[\\/]|$)/, os.homedir());
  s = s.replace(/%([^%]+)%/g, (_, key) => {
    if (!process.env[key]) throw new Error(`安全路径变量缺失: ${key}`);
    return process.env[key];
  });
  return path.resolve(cwd || repo, s).replaceAll('\\', '/').toLowerCase().replace(/\/$/, '');
}

function within(candidate, root) { return candidate === root || candidate.startsWith(root + '/'); }

function matches(pattern, value) {
  const re = String(pattern).split('*').map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*');
  return new RegExp('^' + re + '$').test(value);
}

function evaluate(p, q) {
  if (!(q.action in p.actions)) throw new Error(`未知安全动作: ${q.action}`);
  const mode = modeName(q.mode, p);
  const rules = [...p.rules.map((r, i) => [r, `rules:${i}`]), ...p.modes[mode].map((r, i) => [r, `modes:${mode}:${i}`])];
  const target = String(q.target ?? '');
  const targets = (q.paths && q.paths.length) ? q.paths : (q.action.startsWith('file.') ? [target] : []);
  const normalized = targets.map((s) => expand(s, q.cwd));
  const sensitive = p.sensitive.map((s) => expand(s, q.cwd));
  const targetLower = target.toLowerCase().replaceAll('\\', '/');
  const targetExpanded = targetLower.replace(/~(?=[\\/]|$)/g, os.homedir().toLowerCase().replaceAll('\\', '/'));
  const allSensitive = [
    ...p.sensitive.map((s) => s.toLowerCase().replaceAll('\\', '/')),
    ...sensitive,
  ];

  const hit = rules.find(([r]) => {
    if (r.action !== q.action && r.action !== '*') return false;
    if (r.who && !['product', 'session', 'task'].every((k) => r.who[k] === undefined || matches(r.who[k], String(q[k] || '')))) return false;
    if (!r.target || r.target === '*') return true;
    if (r.target === 'sensitive') {
      return normalized.some((s) => sensitive.some((root) => within(s, root))) ||
        allSensitive.some((s) => targetLower.includes(s) || targetExpanded.includes(s));
    }
    if (r.target === 'outside-cwd') {
      return normalized.some((s) => !within(s, expand(q.cwd || repo)));
    }
    if (q.action.startsWith('file.')) {
      return normalized.some((s) => within(s, expand(r.target, q.cwd)));
    }
    return matches(r.target, target);
  });

  const decision = hit ? hit[0].decision : p.default;
  if (!decisions.has(decision)) throw new Error(`规则结论无效: ${decision}`);
  return { decision, rule: hit ? hit[1] : 'default', mode };
}

function audit(q, result, file = path.join(process.env.HUB_DATA_DIR || path.join(os.homedir(), '.agent-hub'), 'security-audit.jsonl')) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const object = q.action === 'shell.run' ? `sha256:${crypto.createHash('sha256').update(String(q.target)).digest('hex')}` : String(q.target);
  const row = {
    at: new Date().toISOString(),
    who: { product: q.product, session: q.session, task: q.task },
    product: q.product,
    session: q.session,
    task: q.task,
    action: q.action,
    object,
    decision: result.decision,
    rule: result.rule,
    layer: q.layer || 'L1',
    mode: result.mode,
  };
  fs.appendFileSync(file, JSON.stringify(row) + '\n');
}

function judge(q) {
  const result = evaluate(policy(), q);
  audit(q, result);
  return result;
}

module.exports = { policy, modeName, expand, evaluate, judge, audit, policyFile };
