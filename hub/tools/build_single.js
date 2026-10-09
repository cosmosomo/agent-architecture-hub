#!/usr/bin/env node
/**
 * build_single.js - inlines every stylesheet and script of hub/index.html into one file,
 * so the observatory opens by double-click and can be passed around as a single page.
 * Usage: node hub/tools/build_single.js  ->  hub/dist/observatory.html
 */
const fs = require('fs');
const path = require('path');
const { HUB_DIR } = require('./load.js');

const src = fs.readFileSync(path.join(HUB_DIR, 'index.html'), 'utf-8');
const read = (rel) => fs.readFileSync(path.join(HUB_DIR, rel), 'utf-8');
const missing = [];

let out = src.replace(/<link rel="stylesheet" href="([^"]+)">/g, (all, href) => {
  if (!fs.existsSync(path.join(HUB_DIR, href))) { missing.push(href); return ''; }
  return '<style>/* ' + href + ' */\n' + read(href) + '</style>';
});
out = out.replace(/<script src="([^"]+)"><\/script>/g, (all, file) => {
  if (!fs.existsSync(path.join(HUB_DIR, file))) { missing.push(file); return ''; }
  // a literal "</script" inside the code would end the inline block early
  return '<script>/* ' + file + ' */\n' + read(file).replace(/<\/script/gi, '<\\/script') + '</script>';
});

const distDir = path.join(HUB_DIR, 'dist');
fs.mkdirSync(distDir, { recursive: true });
const target = path.join(distDir, 'observatory.html');
fs.writeFileSync(target, out, 'utf-8');
console.log('wrote ' + path.relative(process.cwd(), target) + ' (' + Math.round(out.length / 1024) + ' KB)');
if (missing.length) { console.log('missing, skipped: ' + missing.join(', ')); process.exit(1); }
