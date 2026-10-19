import sys
sys.path.insert(0, r'E:/program/GIT/Agent/hermes and vcp like/hermes-agent')
from toolsets import get_all_toolsets, resolve_toolset

all_ts = get_all_toolsets()
print('ALL TOOLSETS:', len(all_ts))
for name in all_ts:
    tools = resolve_toolset(name)
    print(f'  {name}: {len(tools)} tools -> {sorted(tools)[:12]}{"..." if len(tools) > 12 else ""}')

# hermes-acp toolset specifically
try:
    acp_tools = resolve_toolset('hermes-acp')
    print('\nhermes-acp toolset:', len(acp_tools), sorted(acp_tools))
except Exception as e:
    print('hermes-acp resolve error:', e)
