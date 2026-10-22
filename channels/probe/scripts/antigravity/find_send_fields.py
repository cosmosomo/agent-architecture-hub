ls_bin = r'C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\resources\bin\language_server.exe'
with open(ls_bin, 'rb') as f:
    data = f.read()

idx = data.find(b'SendUserCascadeMessageRequest')
while idx != -1:
    chunk = data[idx:idx+800]
    printable = ''.join(chr(b) if 32 <= b <= 126 else ' ' for b in chunk)
    print('Chunk at', idx, ':')
    print(' '.join(printable.split()))
    idx = data.find(b'SendUserCascadeMessageRequest', idx+1)
