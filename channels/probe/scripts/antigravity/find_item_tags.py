import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'TextOrScopeItem')
while pos != -1:
    block = data[pos:pos+2000]
    tags = re.findall(rb'json:"([^"]+)"', block)
    if tags:
        print(f"Tags at {pos}:", tags[:15])
    pos = data.find(b'TextOrScopeItem', pos+1)
