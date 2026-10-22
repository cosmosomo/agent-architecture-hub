import os

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

pos = data.find(b'RevertToCascadeStepRequest')
while pos != -1:
    # search forward and backward for field names (like step_index, cascade_id, conversation_id)
    block = data[pos:pos+1500]
    for candidate in [b'step', b'index', b'cascade', b'conversation', b'trajectory', b'revert']:
        subpos = 0
        while True:
            idx = block.find(candidate, subpos)
            if idx == -1:
                break
            snippet = block[max(0, idx-20):idx+50]
            clean = ''.join(chr(b) if 32 <= b <= 126 else ' ' for b in snippet)
            print(f"[{candidate.decode()}] {clean}")
            subpos = idx + len(candidate)
    pos = data.find(b'RevertToCascadeStepRequest', pos+1)
    if pos > 85000000:
        break
