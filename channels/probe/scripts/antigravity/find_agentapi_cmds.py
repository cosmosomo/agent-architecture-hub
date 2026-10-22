import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'send-message')
while pos != -1:
    block = data[pos-100:pos+300]
    # see if there are other commands around it
    if b'new-conversation' in block or b'get-conversation-metadata' in block:
        print(f"--- At {pos} ---")
        print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block))
    pos = data.find(b'send-message', pos+1)
