import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

# Let's search for function names containing DeliveryStrategy or Queue or Queued
matches = re.finditer(rb'([a-zA-Z0-9_\./]+\.(?:[A-Za-z0-9_]*DeliveryStrategy[A-Za-z0-9_]*|[A-Za-z0-9_]*Queue[A-Za-z0-9_]*))', data)
funcs = set()
for m in matches:
    funcs.add(m.group(1).decode('latin1'))

for fn in sorted(funcs):
    if 'cortex' in fn or 'language_server' in fn or 'jetski' in fn:
        print(fn)
