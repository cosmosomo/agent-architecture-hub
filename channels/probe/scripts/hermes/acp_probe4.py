# Hermes 原生 ACP 探针 v4：compact 大会话（先灌到阈值之上，再 /compress，验证 token 下降）
import sys, os, json, subprocess, time, threading

ROOT = os.path.dirname(os.path.abspath(__file__))
LOGP = os.path.join(ROOT, 'acp_probe_compact2.log')
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
        else: events.append(msg)
threading.Thread(target=reader, daemon=True).start()

def wait_result(rid, timeout=400):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if rid in pending: return pending.pop(rid)
        time.sleep(0.2)
    return {'timeout': True}

def chunks(sid):
    return ''.join(e['params']['update']['content']['text'] for e in events
                   if e.get('method') == 'session/update' and e['params'].get('sessionId') == sid
                   and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk')

def prompt(sid, text, timeout=400, label=None):
    events.clear()
    r = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': text}]})
    res = wait_result(r, timeout)
    stop = (res.get('result') or {}).get('stopReason') or ('timeout' if res.get('timeout') else json.dumps(res.get('error'))[:120])
    reply = chunks(sid)
    P(step='prompt', label=label or text[:40], stop=stop, reply_head=reply[:200], reply_tail=reply[-250:])
    return stop, reply

r = send('initialize', {'protocolVersion': 1, 'clientCapabilities': {}})
assert not wait_result(r, 90).get('timeout')
r = send('session/new', {'cwd': ROOT, 'mcpServers': []})
res = wait_result(r, 120)
sid = (res.get('result') or {}).get('sessionId')
if not sid:
    P(fatal='no sessionId', err=json.dumps(res)[:300])
    proc.terminate(); sys.exit(1)
P(sessionId=sid)

# 灌 3 轮长内容（每轮 ~20K token 文本）
blob = '这是一段用于压缩测试的长文本。' * 700   # ~9800 chars ≈ ~7K tokens each round
for i in range(3):
    prompt(sid, f'第{i+1}轮。请把下面这段话存进上下文（不需要复述，只回复:存好了{i+1}）：\n{blob}', 400, f'fill{i+1}')
s, before = prompt(sid, '/context', 120, 'ctx-before')
prompt(sid, '/compress', 500, 'compress')
s2, after = prompt(sid, '/context', 120, 'ctx-after')
try:
    send('session/close', {'sessionId': sid}); time.sleep(1)
except Exception: pass
proc.terminate(); P(step='done')
