import json, os

cids = [
    ('6b0d9f16-17b6-464e-a9cc-5992e918c297', 'guard'),
    ('ef3f573d-d1aa-4f9e-8be3-d59d399ae87c', 'goal'),
    ('a5e71081-591c-4f3f-8b9d-a322bb4e21d8', 'inject-next'),
    ('f25b1670-9db9-4900-b871-6b0d82da5474', 'act-deliver')
]

with open('channels/probe/scripts/antigravity/transcripts_out.txt', 'w', encoding='utf-8') as out:
    for cid, name in cids:
        path = os.path.expanduser(f"~/.gemini/antigravity/brain/{cid}/.system_generated/logs/transcript.jsonl")
        out.write(f"=== {name} ({cid}) ===\n")
        if not os.path.exists(path):
            out.write("File does not exist\n\n")
            continue
        with open(path, 'r', encoding='utf-8') as tf:
            for line in tf:
                try:
                    step = json.loads(line.strip())
                    out.write(f"Step {step.get('step_index')}: type={step.get('type')} status={step.get('status')}\n")
                    content = step.get('content', '')
                    if content:
                        out.write(f"  content: {content[:150]}\n")
                    calls = step.get('tool_calls', [])
                    if calls:
                        for c in calls:
                            out.write(f"  tool_call: {c.get('name') if isinstance(c, dict) else c}\n")
                except:
                    pass
        out.write("\n" + "="*50 + "\n\n")
