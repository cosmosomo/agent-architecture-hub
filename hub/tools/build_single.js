#!/usr/bin/env node
/**
 * build_single.js - inlines the observation mode's stylesheets and scripts into a copy of the page,
 * so the whole thing (designer + observatory) is one HTML file that opens by double-click.
 * Usage: node hub/tools/build_single.js  ->  hub/dist/observatory.html
 */
const fs = require('fs');
const path = require('path');
const { HUB_DIR } = require('./load.js');

const ROOT = path.join(HUB_DIR, '..');
const src = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf-8');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf-8');
const missing = [];

let out = src.replace(/<link rel="stylesheet" href="(hub\/[^"]+)">/g, (all, href) => {
  if (!fs.existsSync(path.join(ROOT, href))) { missing.push(href); return ''; }
  return '<style>/* ' + href + ' */\n' + read(href) + '</style>';
});
out = out.replace(/<script src="(hub\/[^"]+)"><\/script>/g, (all, file) => {
  if (!fs.existsSync(path.join(ROOT, file))) { missing.push(file); return ''; }
  // a literal "</script" inside the code would end the inline block early
  return '<script>/* ' + file + ' */\n' + read(file).replace(/<\/script/gi, '<\\/script') + '</script>';
});

const distDir = path.join(HUB_DIR, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const target = path.join(distDir, 'observatory.html');
fs.writeFileSync(target, out, 'utf-8');
console.log('wrote ' + path.relative(process.cwd(), target) + ' (' + (out.length / 1024 / 1024).toFixed(1) + ' MB)');
if (missing.length) { console.log('missing, skipped: ' + missing.join(', ')); process.exit(1); }
