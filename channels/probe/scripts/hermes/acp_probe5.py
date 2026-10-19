# Hermes ACP compact 探针 v5：复用同一桥连接（一次 session/new），带 stderr 全记录
import sys, os, json, subprocess, time, threading

ROOT = os.path.dirname(os.path.abspath(__file__))
LOGP = os.path.join(ROOT, 'acp_probe_compact3.log')
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
        if 'id' in msg and ('result' in msg or 'error' in msg):
            pending[msg['id']] = msg
            P(dir='in', rpc=msg.get('id'), peek=json.dumps(msg.get('result', msg.get('error')))[:200])
        else: events.append(msg)
def err_reader():
    t0 = time.time()
    for raw in proc.stderr:
        s = raw.decode('utf-8', 'replace').strip()
        if time.time() - t0 < 20 or 'rror' in s or 'Trace' in s:
            P(stderr=s[:250])
threading.Thread(target=reader, daemon=True).start()
threading.Thread(target=err_reader, daemon=True).start()

def wait_result(rid, timeout=600):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if rid in pending: return pending.pop(rid)
        time.sleep(0.3)
    return {'timeout': True}

def chunks(sid):
    return ''.join(e['params']['update']['content']['text'] for e in events
                   if e.get('method') == 'session/update' and e['params'].get('sessionId') == sid
                   and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk')

def prompt(sid, text, timeout=600, label=None):
    events.clear()
    r = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': text}]})
    res = wait_result(r, timeout)
    stop = (res.get('result') or {}).get('stopReason') or ('timeout' if res.get('timeout') else json.dumps(res.get('error'))[:120])
    reply = chunks(sid)
    P(step='prompt', label=label or text[:40], stop=stop, reply_head=reply[:150], reply_tail=reply[-200:])
    return stop, reply

P(step='start', t=time.time())
r = send('initialize', {'protocolVersion': 1, 'clientCapabilities': {}})
res = wait_result(r, 180)
P(step='init_done', ok=not res.get('timeout'))
if res.get('timeout'):
    proc.terminate(); sys.exit(1)
r = send('session/new', {'cwd': ROOT, 'mcpServers': []})
res = wait_result(r, 300)
sid = (res.get('result') or {}).get('sessionId')
P(step='new_done', sessionId=sid)
if not sid:
    proc.terminate(); sys.exit(1)

blob = '这是用于压缩测试的长文本段落。' * 800
for i in range(3):
    prompt(sid, f'第{i+1}轮。存入上下文即可，只回复:存好了{i+1}\n{blob}', 600, f'fill{i+1}')
s, before = prompt(sid, '/context', 120, 'ctx-before')
prompt(sid, '/compress', 600, 'compress')
s2, after = prompt(sid, '/context', 120, 'ctx-after')
try:
    send('session/close', {'sessionId': sid}); time.sleep(1)
except Exception: pass
proc.terminate(); P(step='done')
