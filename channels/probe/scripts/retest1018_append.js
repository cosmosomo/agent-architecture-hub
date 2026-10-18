#!/usr/bin/env node
// 追加一行复测记录到黑板（只追加）。用法：node retest1018_append.js <record.json>
// record 字段：family,layer,route,surface,capability,result,condition,evidence,cmd,note
const fs = require('fs');
const path = require('path');
const bb = path.join(__dirname, '..', 'blackboard.jsonl');
const rec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const now = new Date();
const pad = (n) => String(n).padStart(2, '0');
const at = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}+08:00`;
const line = JSON.stringify({ at, by: 'zcode-retest-1018', ...rec });
fs.appendFileSync(bb, line + '\n');
console.log('appended:', rec.capability, '->', rec.result);
