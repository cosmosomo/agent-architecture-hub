import sys, json

rows = []
with open(r'E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/blackboard.jsonl', encoding='utf-8') as f:
    for line in f:
        line = line.strip()
        if not line: continue
        try: r = json.loads(line)
        except Exception: continue
        if r.get('family') == 'hermes':
            rows.append(r)

seen = {}
for r in rows:
    key = (r.get('layer'), r.get('route'), r.get('capability'))
    seen[key] = r.get('result')

by_layer = {}
for (layer, route, cap), res in sorted(seen.items()):
    by_layer.setdefault(layer, []).append(f'{cap}={res}')
for layer in ['L0', 'L1a', 'L1b', 'L2', 'L3']:
    if layer in by_layer:
        print(f'--- {layer} ({len(by_layer[layer])} cells)')
        print('  ' + ', '.join(by_layer[layer]))
