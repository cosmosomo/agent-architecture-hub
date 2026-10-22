import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

for term in [b'hide_from_conversation_list', b'hideFromConversationList', b'ArchiveConversation', b'archive_conversation']:
    pos = data.find(term)
    while pos != -1:
        print(f"[{term.decode()}] at {pos}")
        block = data[pos-100:pos+200]
        print(''.join(chr(b) if 32 <= b <= 126 else f'\\x{b:02x}' for b in block))
        pos = data.find(term, pos+1)
        if pos > 100000000:
            break
