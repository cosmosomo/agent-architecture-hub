import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'RevertToCascadeStepRequest')
while pos != -1:
    print(f"--- At {pos} ---")
    block = data[pos-100:pos+300]
    print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block))
    pos = data.find(b'RevertToCascadeStepRequest', pos+1)
