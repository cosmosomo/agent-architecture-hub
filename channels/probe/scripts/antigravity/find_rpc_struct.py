ls_bin = r'C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\resources\bin\language_server.exe'
with open(ls_bin, 'rb') as f:
    data = f.read()

targets = [b'HandleCascadeUserInteractionRequest', b'ResolveOutstandingStepsRequest', b'SendUserCascadeMessageRequest']
for s in targets:
    idx = data.find(s)
    print(s.decode(), 'found at:', idx)
    if idx != -1:
        chunk = data[idx:idx+400]
        printable = ''.join(chr(b) if 32 <= b <= 126 else ' ' for b in chunk)
        print(' '.join(printable.split()))
