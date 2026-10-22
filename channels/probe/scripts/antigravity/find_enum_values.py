import os, re

ls_bin = os.path.join(os.environ['LOCALAPPDATA'], 'Programs', 'antigravity', 'resources', 'bin', 'language_server.exe')
with open(ls_bin, 'rb') as f:
    data = f.read()

# In Go protobuf generated code:
# MessageDeliveryStrategy_name = map[int32]string{ ... } or MessageDeliveryStrategy_value = map[string]int32{ ... }
# Or strings like "MESSAGE_DELIVERY_STRATEGY_"
matches = re.finditer(rb'MESSAGE_DELIVERY_STRATEGY_[A-Z0-9_]+', data)
vals = set()
for m in matches:
    vals.add(m.group(0).decode())
print("Enum values found:")
for v in sorted(vals):
    print(" -", v)
