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

module.exports = { createContext, loadScripts, HUB_DIR };
