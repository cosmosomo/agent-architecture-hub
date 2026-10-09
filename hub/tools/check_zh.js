#!/usr/bin/env node
/**
 * check_zh.js - validates hub/data/zh.js against SPEC.md §12.1.
 * Usage: node hub/tools/check_zh.js
 */
const { createContext, loadScripts } = require('./load.js');
const ctx = loadScripts(createContext(), ['data/base.js', 'data/zh.js']);
const B = ctx.HUB.base, Z = ctx.HUB.zh || {};
const errors = [];
const err = (m) => errors.push(m);
const len = (s) => [...String(s || '')].length;
const hasLatinOnly = (s) => /^[\x00-\x7F]*$/.test(String(s || ''));

Object.keys(B.agents).forEach((id) => {
  const a = (Z.agents || {})[id];
  if (!a) return err(`agents.${id} missing`);
  if (!a.name) err(`agents.${id}.name missing`);
  if (!a.role) err(`agents.${id}.role missing`);
  if (len(a.role) > 30) err(`agents.${id}.role longer than 30 chars (${len(a.role)})`);
  if (hasLatinOnly(a.role)) err(`agents.${id}.role is not Chinese`);
});
Object.keys(B.presets).forEach((id) => {
  const p = (Z.presets || {})[id];
  if (!p) return err(`presets.${id} missing`);
  ['name', 'summary', 'flow'].forEach((k) => { if (!p[k]) err(`presets.${id}.${k} missing`); });
  if (len(p.summary) > 40) err(`presets.${id}.summary longer than 40 chars (${len(p.summary)})`);
  if (len(p.flow) > 30) err(`presets.${id}.flow longer than 30 chars (${len(p.flow)})`);
});
['strategy', 'research', 'debate1', 'debate2', 'build', 'qa', 'hitl'].forEach((k) => { if (!(Z.phases || {})[k]) err(`phases.${k} missing`); });
const tools = new Set();
Object.values(B.agents).forEach((a) => String(a.tools || '').split(',').map((s) => s.replace(/\(.*?\)/g, '').trim()).filter(Boolean).flatMap((s) => s.split('/')).map((s) => s.trim()).filter(Boolean).forEach((t) => tools.add(t)));
tools.forEach((t) => { if (!(Z.tools || {})[t]) err(`tools.${t} missing`); });
const extra = Object.keys(Z.agents || {}).filter((k) => !B.agents[k]);
if (extra.length) err('unknown agent ids: ' + extra.join(','));

errors.forEach((e) => console.log('ERROR ' + e));
console.log(errors.length ? `FAILED: ${errors.length} error(s)` : `OK: ${Object.keys(Z.agents || {}).length} agents, ${Object.keys(Z.presets || {}).length} presets, ${tools.size} tools`);
process.exit(errors.length ? 1 : 0);
