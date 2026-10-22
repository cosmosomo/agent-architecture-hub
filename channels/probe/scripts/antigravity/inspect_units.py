import json

with open('hub/data/capability-units.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

items = data.get('units', data) if isinstance(data, dict) else data
target_caps = [
    'goal', 'guard', 'loop-guard', 'inject-next', 'peer-message', 'handoff',
    'host-drain', 'artifact', 'permission-scope', 'archive', 'act-deliver',
    'act-report', 'task-board', 'mount-tools', 'instructions', 'workspace',
    'output-contract', 'inject-tool', 'capacity', 'handover-human', 'app-sync',
    'act-request', 'reclaim'
]

units = {u['id']: u for u in items}
with open('channels/probe/scripts/antigravity/inspect_units_out.txt', 'w', encoding='utf-8') as out:
    for tid in target_caps:
        if tid in units:
            u = units[tid]
            out.write(f"[{tid}] {u.get('name')}\n")
            out.write(f"  Judge: {u.get('judge')}\n")
            out.write(f"  Desc: {u.get('description')}\n\n")
