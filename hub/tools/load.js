/**
 * load.js - runs the observatory's non-DOM scripts inside a Node vm context,
 * the same way the browser loads them (classic scripts sharing window.HUB).
 * Used by the test scripts; never loaded by the page.
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const HUB_DIR = path.join(__dirname, '..');

function createContext() {
  const ctx = { console, Math, Date, JSON, setTimeout, clearTimeout };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  return ctx;
}

function loadScripts(ctx, files) {
  files.forEach((rel) => {
    const file = path.join(HUB_DIR, rel);
    const code = fs.readFileSync(file, 'utf-8');
    vm.runInContext(code, ctx, { filename: rel });
  });
  return ctx;
}

/** The page's scripts in the page's own order: index.html is the one place the load order is written down.
    `only`: path prefixes (relative to hub/) to keep, for the ones that run without a DOM. */
function pageScripts(only) {
  const html = fs.readFileSync(path.join(HUB_DIR, '..', 'index.html'), 'utf-8');
  const all = Array.from(html.matchAll(/<script src="hub\/([^"]+)"><\/script>/g), (m) => m[1]);
  return only ? all.filter((f) => only.some((p) => f.startsWith(p))) : all;
}

/** fetch() over the file system, as the page sees the local service: a file answers its text, a folder an <a href> listing. */
function fsFetch(url) {
  const p = path.join(HUB_DIR, url.replace(/^hub\//, ''));
  try {
    if (fs.statSync(p).isDirectory()) {
      return Promise.resolve(fs.readdirSync(p, { withFileTypes: true }).filter((e) => !e.name.startsWith('.'))
        .map((e) => '<a href="' + encodeURI(e.name) + (e.isDirectory() ? '/' : '') + '">' + e.name + '</a>').join('\n'));
    }
    return Promise.resolve(fs.readFileSync(p, 'utf-8'));
  } catch (e) {
    return Promise.resolve('');
  }
}

/** The case folders (a folder holding meta.md) below `dir`, found by walking. A folder starting with "_" is shelved
    (the reference corpus) and is only entered with { shelved: true }. */
function findCases(dir, opts) {
  const out = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (!e.isDirectory() || e.name.startsWith('.')) continue;
      if (e.name.startsWith('_') && !(opts && opts.shelved)) continue;
      const p = path.join(d, e.name);
      if (fs.existsSync(path.join(p, 'meta.md'))) out.push({ id: e.name, dir: p });
      else walk(p);
    }
  })(dir);
  return out;
}

module.exports = { createContext, loadScripts, pageScripts, fsFetch, findCases, HUB_DIR };
