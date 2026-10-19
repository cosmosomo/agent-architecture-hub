# Hermes 原生 ACP 探针 v3：redirect 轮内插话（ACP 原生面 steer 格的真正入口）
# 场景 redirect: 主 turn 用 terminal background=true + process poll 拉长，中途第二个 prompt（text-only）应触发 agent.redirect()
import sys, os, json, subprocess, time, threading

SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'redirect'
ROOT = os.path.dirname(os.path.abspath(__file__))
LOGP = os.path.join(ROOT, f'acp_probe_{SCENARIO}.log')
log = open(LOGP, 'w', encoding='utf-8')
def P(**kw):
    line = json.dumps(kw, ensure_ascii=False, default=str)
    log.write(line + '\n'); log.flush(); print(line)

argv = json.load(open(os.path.expandvars(r'%USERPROFILE%\.acpx\config.json'), encoding='utf-8'))['agents']['hermes']['argv']
env = dict(os.environ); env.update({'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'HERMES_ACP_SKIP_CONFIGURED_MCP': '1'})
proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=ROOT)

_id = [0]
def send(method, params):
    _id[0] += 1; rid = _id[0]
    proc.stdin.write((json.dumps({'jsonrpc': '2.0', 'id': rid, 'method': method, 'params': params}) + '\n').encode('utf-8')); proc.stdin.flush()
    return rid

pending, events = {}, []
def reader():
    for raw in proc.stdout:
        line = raw.decode('utf-8', 'replace').strip()
        if not line: continue
        try: msg = json.loads(line)
        except Exception: continue
        if 'id' in msg and ('result' in msg or 'error' in msg): pending[msg['id']] = msg
        else:
            events.append(msg)
            u = msg.get('params', {}).get('update', {})
            if msg.get('method') != 'session/update' or u.get('sessionUpdate') not in ('agent_message_chunk',):
                P(dir='in', kind=msg.get('method'), upd=u.get('sessionUpdate'), peek=json.dumps(msg.get('params'))[:200])
def err_reader():
    for raw in proc.stderr:
        s = raw.decode('utf-8', 'replace').strip()
        if 'Delivered /steer' in s or 'redirect' in s.lower() or 'steer' in s.lower():
            P(bridge_stderr=s[:250])
threading.Thread(target=reader, daemon=True).start()
threading.Thread(target=err_reader, daemon=True).start()

def wait_result(rid, timeout=300):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if rid in pending: return pending.pop(rid)
        time.sleep(0.2)
    return {'timeout': True}

def chunks(sid):
    return ''.join(e['params']['update']['content']['text'] for e in events
                   if e.get('method') == 'session/update' and e['params'].get('sessionId') == sid
                   and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk')

r = send('initialize', {'protocolVersion': 1, 'clientCapabilities': {}})
res = wait_result(r, 90); assert not res.get('timeout'), 'init timeout'
r = send('session/new', {'cwd': ROOT, 'mcpServers': []})
res = wait_result(r, 120); sid = res['result']['sessionId']
P(sessionId=sid)

# 主 turn：模型请求阶段拉长（不带 /steer 前缀的纯文本第二 prompt 才走 redirect 路径）
r1 = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': '任务RD1: 用 terminal 工具以 background=true 运行 "ping -n 45 127.0.0.1"，然后用 process_manage action=poll 等它。全部结束后只回复:主任务完成'}]})
time.sleep(20)  # 等它进入工具轮
r2 = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': '插话：结束时请回复 SKATE-88 而不是主任务完成'}]})
res2 = wait_result(r2, 240)
P(step='redirect_prompt_done', stop=(res2.get('result') or {}).get('stopReason'))
events.clear()
res1 = wait_result(r1, 400)
full = chunks(sid)
P(step='main_turn', stop=(res1.get('result') or {}).get('stopReason'), SKATE='SKATE-88' in full, tail=full[-200:])
try:
    send('session/close', {'sessionId': sid}); time.sleep(1)
except Exception: pass
proc.terminate(); P(step='done')
