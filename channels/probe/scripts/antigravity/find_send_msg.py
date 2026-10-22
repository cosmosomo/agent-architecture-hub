ls_bin = r'C:\Users\COLORFIRE\AppData\Local\Programs\antigravity\resources\bin\language_server.exe'
with open(ls_bin, 'rb') as f:
    data = f.read()

idx = 0
while True:
    idx = data.find(b'SendUserCascadeMessage', idx)
    if idx == -1:
        break
    print('Found at', idx)
    chunk = data[idx:idx+500]
    printable = ''.join(chr(b) if 32 <= b <= 126 else ' ' for b in chunk)
    print(' '.join(printable.split()))
    idx += len(b'SendUserCascadeMessage')
