import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = 55442327
block = data[pos-100:pos+1500]
print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:1000]))
