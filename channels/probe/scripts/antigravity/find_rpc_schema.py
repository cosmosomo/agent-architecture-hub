import os
import re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

# Search for SendUserCascadeMessage
idx = 0
found = []
while True:
    pos = data.find(b'SendUserCascadeMessage', idx)
    if pos == -1:
        break
    found.append(pos)
    idx = pos + 1

print(f"Found {len(found)} occurrences of SendUserCascadeMessage")
for p in found:
    snippet = data[max(0, p-100):min(len(data), p+200)]
    # extract printable ascii strings
    strings = re.findall(rb'[a-zA-Z0-9_\./]{3,}', snippet)
    print("--- Near", p, "---")
    print([s.decode('latin1', 'ignore') for s in strings])
