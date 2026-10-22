import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'TextOrScopeItem\x12')
if pos == -1:
    pos = data.find(b'TextOrScopeItem')
block = data[pos:pos+3000]
print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:1500]))
