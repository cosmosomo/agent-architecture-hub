import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

# search for functions containing agentapi
matches = re.finditer(rb'([a-zA-Z0-9_\./]+agentapi[a-zA-Z0-9_\./]*)', data)
funcs = set()
for m in matches:
    funcs.add(m.group(1).decode('latin1'))

for fn in sorted(funcs):
    print(fn)
