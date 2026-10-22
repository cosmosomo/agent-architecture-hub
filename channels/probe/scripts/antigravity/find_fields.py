import os
import re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = 0
while True:
    pos = data.find(b'SendUserCascadeMessageRequest', pos)
    if pos == -1:
        break
    block = data[pos:pos+5000]
    if b'json:' in block:
        print('Found tag block at', pos)
        # find all `name` or json:"..."
        matches = re.findall(rb'json:"([^"]+)"', block)
        if matches:
            print('JSON tags:', [m.decode('latin1') for m in matches[:50]])
    pos += 1
