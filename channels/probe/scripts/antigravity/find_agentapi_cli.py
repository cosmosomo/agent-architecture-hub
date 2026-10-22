import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'Usage: agentapi <command> [args]')
if pos != -1:
    block = data[pos:pos+3000]
    print(f"--- At {pos} ---")
    print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block[:1500]))
