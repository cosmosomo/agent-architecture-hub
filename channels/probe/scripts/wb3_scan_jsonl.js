// probe: scan a WorkBuddy session jsonl for token/usage/context fields
const fs = require('fs');
const p = process.argv[2];
const s = fs.readFileSync(p, 'utf8');
const res = ['contextWindow', 'totalTokens', 'inputTokens', 'outputTokens', 'cachedTokens', 'context_window', '"usage"', 'thoughtLevel', 'reasoning_effort', 'effort'];
for (const k of res) {
  const idx = s.indexOf(k);
  if (idx >= 0) console.log(k, '->', s.slice(Math.max(0, idx - 60), idx + 140).replace(/\s+/g, ' '));
}
