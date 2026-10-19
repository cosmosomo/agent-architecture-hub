# Hermes 原生 ACP 探针（native L1a）：spawn 桥进程、测斜杠命令/注入/审批等
# 用法: .venv python acp_probe.py <场景名>
# 场景:
#   slash    - /help /model /tools /context /version /compress /reset /queue /steer + 未知命令落到模型
#   inject   - inject-next: 第二个 prompt 在第一个跑 ping -n 40 时发出; inject-silent: ACP 无原语
#   perm     - default 模式写文件 → requestPermission → allow → 同轮继续
import sys, os, json, subprocess, time, threading

SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'slash'
ROOT = r'E:/program/GIT/Agent/multi/Agent-Architecture-Hub/channels/probe/scripts/hermes'
sys.path.insert(0, ROOT)

argv = json.load(open(os.path.expandvars(r'%USERPROFILE%\.acpx\config.json'), encoding='utf-8'))['agents']['hermes']['argv']
env = dict(os.environ)
env.update({'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'HERMES_ACP_SKIP_CONFIGURED_MCP': '1'})

proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=ROOT)

_id = [0]
def send(method, params, timeout=180):
    _id[0] += 1
    rid = _id[0]
    frame = json.dumps({'jsonrpc': '2.0', 'id': rid, 'method': method, 'params': params})
    proc.stdin.write((frame + '\n').encode('utf-8')); proc.stdin.flush()
    return rid

pending = {}          # id -> ('result', event) filled by reader thread
events = []           # all notifications
def reader():
    for raw in proc.stdout:
        line = raw.decode('utf-8', 'replace').strip()
        if not line: continue
        try: msg = json.loads(line)
        except Exception: continue
        if 'id' in msg and ('result' in msg or 'error' in msg):
            pending[msg['id']] = msg
        else:
            events.append(msg)
threading.Thread(target=reader, daemon=True).start()

def wait_result(rid, timeout=240):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if rid in pending: return pending.pop(rid)
        time.sleep(0.2)
    return {'timeout': True, 'id': rid}

def wait_stop(session_id, timeout=240):
    """Wait for the prompt RPC result whose params include sessionId (prompt returns via its id)."""
    # prompt result comes back on its request id; we track via pending. Caller uses send+wait.
    pass

out = {'scenario': SCENARIO, 'frames': [], 'version': None}

r = send('initialize', {'protocolVersion': 1, 'clientCapabilities': {}})
res = wait_result(r); out['init'] = {'agentCapabilities': res.get('result', {}).get('agentCapabilities')}
r = send('session/new', {'cwd': ROOT, 'mcpServers': []})
res = wait_result(r)
sid = res.get('result', {}).get('sessionId')
out['session'] = sid
print(json.dumps({'scenario': SCENARIO, 'sessionId': sid, 'caps': out['init']['agentCapabilities']}, ensure_ascii=False))

cmds = {
 'slash': [
   ('/version', None),
   ('/help', None),
   ('/model', None),
   ('/tools', None),
   ('/context', None),
 ],
 'slash2': [
   ('/queue queued from L1a probe HELLO-INJECT-NEXT', None),
 ],
}

if SCENARIO == 'slash':
    for text, _ in cmds['slash']:
        r = send('session/prompt', {'sessionId': sid, 'prompt': text})
        res = wait_result(r, timeout=120)
        # collect agent_message_chunk from events after this point
        chunks = [e for e in events if e.get('method') == 'session/update'
                  and e['params'].get('sessionId') == sid
                  and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
        last = ''.join(c['params']['update']['content']['text'] for c in chunks[-8:])
        stop = (res.get('result') or {}).get('stopReason')
        print(json.dumps({'cmd': text, 'stopReason': stop, 'reply': last[:400]}, ensure_ascii=False))
        events.clear()
elif SCENARIO == 'inject':
    # 1) long-running turn: agent runs ping -n 40 via terminal tool
    r1 = send('session/prompt', {'sessionId': sid, 'prompt': '任务INJ1: 用 terminal 工具运行 "ping -n 40 127.0.0.1"。等它跑完。结束后只回复:完成'})
    time.sleep(12)   # let the turn get into the tool call
    # 2) inject-next attempt: second prompt while first in flight
    r2 = send('session/prompt', {'sessionId': sid, 'prompt': '插话：结束后词请改为 SKATE-77（这是排到下一轮的话）'})
    res2 = wait_result(r2, timeout=240)
    chunks2 = [e for e in events if e.get('method') == 'session/update'
               and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'inject_reply_stop': (res2.get('result') or {}).get('stopReason'),
                      'inject_reply': ''.join(c['params']['update']['content']['text'] for c in chunks2)[-300:]}, ensure_ascii=False))
    res1 = wait_result(r1, timeout=300)
    chunks_all = [e for e in events if e.get('method') == 'session/update'
                  and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    full = ''.join(c['params']['update']['content']['text'] for c in chunks_all)
    print(json.dumps({'main_stop': (res1.get('result') or {}).get('stopReason'),
                      'main_reply_tail': full[-300:], 'SKATE_seen': 'SKATE-77' in full}, ensure_ascii=False))
elif SCENARIO == 'perm':
    # default mode: file write → requestPermission → we allow → same turn continues
    r = send('session/prompt', {'sessionId': sid, 'prompt': '在当前目录创建文件 perm_native_l1a.txt，内容 perm-native-ok-42。创建成功后只回复:written'})
    allowed = {'done': False}
    def perm_watcher():
        t0 = time.time()
        while time.time() - t0 < 200 and not allowed['done']:
            for e in list(events):
                if e.get('method') == 'session/request_permission':
                    req = e['params']
                    opt = next((o for o in req.get('options', []) if o.get('kind') == 'allow_once'), None)
                    ans = {'jsonrpc': '2.0', 'id': e['id'], 'result': {'outcome': {'outcome': 'selected', 'optionId': opt['optionId']}}} if opt else {'jsonrpc': '2.0', 'id': e['id'], 'result': {'outcome': {'outcome': 'approved'}}}
                    proc.stdin.write((json.dumps(ans) + '\n').encode('utf-8')); proc.stdin.flush()
                    events.remove(e)
                    print(json.dumps({'perm_request_title': req.get('toolCall', {}).get('title'), 'answered': 'allow_once'}, ensure_ascii=False))
            time.sleep(0.3)
    threading.Thread(target=perm_watcher, daemon=True).start()
    res = wait_result(r, timeout=240)
    chunks = [e for e in events if e.get('method') == 'session/update'
              and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'perm_stop': (res.get('result') or {}).get('stopReason'),
                      'perm_reply': ''.join(c['params']['update']['content']['text'] for c in chunks)[-200:]}, ensure_ascii=False))
    time.sleep(1)
    print(json.dumps({'file_exists': os.path.exists(os.path.join(ROOT, 'perm_native_l1a.txt'))}, ensure_ascii=False))
elif SCENARIO == 'reset':
    # /reset clears history: plant secret, reset, ask secret
    r = send('session/prompt', {'sessionId': sid, 'prompt': '记住暗号 NATIVE-RESET-3355。只回复:收到'})
    print(json.dumps({'plant': wait_result(r, 120).get('result', {}).get('stopReason')}, ensure_ascii=False))
    r = send('session/prompt', {'sessionId': sid, 'prompt': '/reset'})
    print(json.dumps({'reset': wait_result(r, 120).get('result', {}).get('stopReason')}, ensure_ascii=False))
    r = send('session/prompt', {'sessionId': sid, 'prompt': '暗号是什么？只回答暗号本身，不要用任何工具'})
    res = wait_result(r, 120)
    chunks = [e for e in events if e.get('method') == 'session/update'
              and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'after_reset_reply': ''.join(c['params']['update']['content']['text'] for c in chunks)[-200:]}, ensure_ascii=False))
elif SCENARIO == 'compress':
    r = send('session/prompt', {'sessionId': sid, 'prompt': '记住这句话并只回复收到: ' + ('细节句子。' * 60)})
    print(json.dumps({'plant': wait_result(r, 180).get('result', {}).get('stopReason')}, ensure_ascii=False))
    r = send('session/prompt', {'sessionId': sid, 'prompt': '/context'})
    res = wait_result(r, 120)
    chunks = [e for e in events if e.get('method') == 'session/update'
              and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'before': ''.join(c['params']['update']['content']['text'] for c in chunks)[-400:]}, ensure_ascii=False))
    events.clear()
    r = send('session/prompt', {'sessionId': sid, 'prompt': '/compress'})
    res = wait_result(r, 300)
    chunks = [e for e in events if e.get('method') == 'session/update'
              and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'compress': ''.join(c['params']['update']['content']['text'] for c in chunks)[-400:]}, ensure_ascii=False))
    events.clear()
    r = send('session/prompt', {'sessionId': sid, 'prompt': '/context'})
    res = wait_result(r, 120)
    chunks = [e for e in events if e.get('method') == 'session/update'
              and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk']
    print(json.dumps({'after': ''.join(c['params']['update']['content']['text'] for c in chunks)[-400:]}, ensure_ascii=False))

try:
    send('session/close', {'sessionId': sid})
    time.sleep(1)
finally:
    proc.terminate()
