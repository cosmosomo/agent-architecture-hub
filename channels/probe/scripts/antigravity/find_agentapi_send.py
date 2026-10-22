import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = 0
while True:
    pos = data.find(b'send-message', pos)
    if pos == -1:
        break
    block = data[max(0, pos-100):pos+300]
    print(f"--- At {pos} ---")
    print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:300]))
    pos += 1
