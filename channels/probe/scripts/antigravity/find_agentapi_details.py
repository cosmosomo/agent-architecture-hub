import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'cmd/agentapi')
while pos != -1:
    block = data[pos-100:pos+2500]
    print(f"--- At {pos} ---")
    print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:800]))
    pos = data.find(b'cmd/agentapi', pos+1)
