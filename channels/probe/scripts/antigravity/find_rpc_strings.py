import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

getters = re.findall(rb'SendUserCascadeMessageRequest\)\.([A-Za-z0-9_]+)', data)
unique_getters = sorted(list(set(g.decode('latin1') for g in getters)))
print("Getters on SendUserCascadeMessageRequest:")
for g in unique_getters:
    print(" -", g)
