import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = 57455641
block = data[pos:pos+4000]
# Replace non-printable characters
print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:1500]))
