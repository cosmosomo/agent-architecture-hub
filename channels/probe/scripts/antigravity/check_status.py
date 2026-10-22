import json

lines = open('channels/probe/blackboard.jsonl', 'r', encoding='utf-8').readlines()
target_caps = [
    'goal', 'guard', 'loop-guard', 'inject-next', 'peer-message', 'handoff',
    'host-drain', 'artifact', 'permission-scope', 'archive', 'act-deliver',
    'act-report', 'task-board', 'mount-tools', 'instructions', 'workspace',
    'output-contract', 'inject-tool', 'capacity', 'handover-human', 'app-sync',
    'act-request', 'reclaim'
]
status = {}
for line in lines:
    try:
        d = json.loads(line.strip())
        if d.get('family') == 'antigravity':
            cap = d.get('capability')
            if cap in target_caps:
                status[cap] = d
    except:
        pass

with open('channels/probe/scripts/antigravity/status_out.txt', 'w', encoding='utf-8') as out:
    out.write(f"Total target capabilities: {len(target_caps)}\n")
    for c in target_caps:
        st = status.get(c, {})
        out.write(f"[{c}] result={st.get('result')} by={st.get('by')} route={st.get('route')} at={st.get('at')}\n")
        out.write(f"   evidence: {st.get('evidence')}\n\n")
