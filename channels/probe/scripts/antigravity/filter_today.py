import json

lines = open('channels/probe/blackboard.jsonl', 'r', encoding='utf-8').readlines()
results = []
for i, line in enumerate(lines):
    try:
        d = json.loads(line.strip())
        if d.get('family') == 'antigravity' and '2026-10-19' in d.get('at', ''):
            results.append((i+1, d))
    except:
        pass

with open('channels/probe/scripts/antigravity/today_agy_blackboard.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total today antigravity entries: {len(results)}\n\n")
    for line_num, d in results:
        out.write(f"Line {line_num}: [{d.get('capability')}] result={d.get('result')} by={d.get('by')} route={d.get('route')}\n")
        out.write(f"  condition: {d.get('condition')}\n")
        out.write(f"  evidence: {d.get('evidence')}\n")
        out.write(f"  note: {d.get('note')}\n\n")
