# Hermes 原生 ACP 探针 v2：带启动诊断 + 逐步落盘日志
import sys, os, json, subprocess, time, threading

SCENARIO = sys.argv[1] if len(sys.argv) > 1 else 'ping'
ROOT = os.path.dirname(os.path.abspath(__file__))
LOGP = os.path.join(ROOT, f'acp_probe_{SCENARIO}.log')
log = open(LOGP, 'w', encoding='utf-8')
def P(**kw):
    line = json.dumps(kw, ensure_ascii=False, default=str)
    log.write(line + '\n'); log.flush()
    print(line)

argv = json.load(open(os.path.expandvars(r'%USERPROFILE%\.acpx\config.json'), encoding='utf-8'))['agents']['hermes']['argv']
env = dict(os.environ)
env.update({'PYTHONIOENCODING': 'utf-8', 'PYTHONUTF8': '1', 'HERMES_ACP_SKIP_CONFIGURED_MCP': '1'})

t_spawn = time.time()
proc = subprocess.Popen(argv, stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, env=env, cwd=ROOT)
P(step='spawned', pid=proc.pid)

_id = [0]
def send(method, params):
    _id[0] += 1
    rid = _id[0]
    proc.stdin.write((json.dumps({'jsonrpc': '2.0', 'id': rid, 'method': method, 'params': params}) + '\n').encode('utf-8'))
    proc.stdin.flush()
    return rid

pending = {}
events = []
def reader():
    for raw in proc.stdout:
        line = raw.decode('utf-8', 'replace').strip()
        if not line: continue
        try: msg = json.loads(line)
        except Exception:
            P(raw_nonjson=line[:200]); continue
        if 'id' in msg and ('result' in msg or 'error' in msg):
            pending[msg['id']] = msg
            P(dir='in', kind='rpc-result', id=msg.get('id'), peek=json.dumps(msg.get('result') if 'result' in msg else msg.get('error'))[:300])
        elif 'method' in msg:
            events.append(msg)
            u = msg.get('params', {}).get('update', {})
            if msg.get('method') != 'session/update' or u.get('sessionUpdate') not in ('agent_message_chunk', 'user_message_chunk'):
                P(dir='in', kind=msg.get('method'), update=u.get('sessionUpdate'), peek=json.dumps(msg.get('params'))[:260])
def err_reader():
    for raw in proc.stderr:
        P(bridge_stderr=raw.decode('utf-8', 'replace')[:300].strip())
threading.Thread(target=reader, daemon=True).start()
threading.Thread(target=err_reader, daemon=True).start()

def wait_result(rid, timeout=240):
    t0 = time.time()
    while time.time() - t0 < timeout:
        if rid in pending: return pending.pop(rid)
        time.sleep(0.2)
    return {'timeout': True, 'id': rid, 'waited': timeout}

def collect_chunks(sid):
    return ''.join(e['params']['update']['content']['text'] for e in events
                   if e.get('method') == 'session/update'
                   and e['params'].get('sessionId') == sid
                   and e['params'].get('update', {}).get('sessionUpdate') == 'agent_message_chunk')

def prompt(sid, text, timeout=240, label=None):
    events.clear()
    r = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': text}]})
    res = wait_result(r, timeout)
    stop = (res.get('result') or {}).get('stopReason') or ('timeout' if res.get('timeout') else json.dumps(res.get('error'))[:120])
    reply = collect_chunks(sid)
    P(step='prompt', label=label or text[:50], stop=stop, reply_tail=reply[-350:])
    return stop, reply

# ---- main flow ----
r = send('initialize', {'protocolVersion': 1, 'clientCapabilities': {}})
res = wait_result(r, 90)
caps = (res.get('result') or {}).get('agentCapabilities')
P(step='initialize', caps=caps, waited=round(time.time()-t_spawn, 1))
if res.get('timeout'):
    P(fatal='initialize timeout'); proc.terminate(); sys.exit(1)

r = send('session/new', {'cwd': ROOT, 'mcpServers': []})
res = wait_result(r, 120)
sid = (res.get('result') or {}).get('sessionId')
modes = (res.get('result') or {}).get('modes')
P(step='session/new', sessionId=sid, modes=[m.get('id') if isinstance(m, dict) else m for m in (modes or [])])
if not sid:
    P(fatal='no sessionId', err=json.dumps(res)[:300]); proc.terminate(); sys.exit(1)

if SCENARIO == 'ping':
    prompt(sid, '只回复两个字:收到', 180)
elif SCENARIO == 'slash':
    for text in ['/version', '/help', '/model', '/tools', '/context']:
        events.clear()
        r = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': text}]})
        res = wait_result(r, 90)
        stop = (res.get('result') or {}).get('stopReason') or ('timeout' if res.get('timeout') else json.dumps(res.get('error'))[:100])
        P(step='slash', cmd=text, stop=stop, reply_head=collect_chunks(sid)[:300])
elif SCENARIO == 'inject':
    events.clear()
    r1 = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': '任务INJ2: 用 terminal 工具运行 "ping -n 40 127.0.0.1"，等它跑完，结束后只回复:主任务完成'}]})
    time.sleep(15)
    r2 = send('session/prompt', {'sessionId': sid, 'prompt': [{'type': 'text', 'text': '插话：把结束词改成 SKATE-77'}]})
    res2 = wait_result(r2, 240)
    P(step='inject_prompt_result', stop=(res2.get('result') or {}).get('stopReason'), err=json.dumps(res2.get('error'))[:150])
    events.clear()
    res1 = wait_result(r1, 400)
    full = collect_chunks(sid)
    P(step='main_turn', stop=(res1.get('result') or {}).get('stopReason'), SKATE_in_main='SKATE-77' in full, tail=full[-250:])
    # any queued next turn fired?
    time.sleep(20)
    after = collect_chunks(sid)
    P(step='after_wait', SKATE_in_after='SKATE-77' in after, tail_after=after[-250:])
elif SCENARIO == 'perm':
    got = {'n': 0}
    def watcher():
        t0 = time.time()
        while time.time() - t0 < 240:
            for e in list(events):
                if e.get('method') == 'session/request_permission':
                    req = e['params']; got['n'] += 1
                    opt = next((o for o in req.get('options', []) if o.get('kind') == 'allow_once'), None)
                    outcome = {'outcome': 'selected', 'optionId': opt['optionId']} if opt else {'outcome': 'approved'}
                    proc.stdin.write((json.dumps({'jsonrpc': '2.0', 'id': e['id'], 'result': {'outcome': outcome}}) + '\n').encode('utf-8'))
                    proc.stdin.flush()
                    P(step='permission_answered', n=got['n'], title=(req.get('toolCall') or {}).get('title'))
                    events.remove(e)
            time.sleep(0.3)
    threading.Thread(target=watcher, daemon=True).start()
    stop, reply = prompt(sid, '在当前目录创建文件 perm_native_l1a.txt 内容 perm-native-ok-42，成功后只回复:written', 240, 'perm')
    time.sleep(1)
    P(step='perm_check', file_exists=os.path.exists(os.path.join(ROOT, 'perm_native_l1a.txt')), requests_seen=got['n'])
elif SCENARIO == 'reset':
    prompt(sid, '记住暗号 NATIVE-RESET-3355。只回复:收到', 180, 'plant')
    prompt(sid, '/reset', 90, 'reset')
    stop, reply = prompt(sid, '暗号是什么？只回答暗号本身，不要用任何工具', 180, 'ask-after-reset')
    P(step='reset_verdict', secret_gone='NATIVE-RESET-3355' not in reply)
elif SCENARIO == 'compress':
    prompt(sid, '记住并复述收到即可: ' + '细节句子编号。' * 60, 240, 'plant')
    s1, r1 = prompt(sid, '/context', 90, 'ctx-before')
    prompt(sid, '/compress', 300, 'compress')
    s2, r2 = prompt(sid, '/context', 90, 'ctx-after')
    P(step='compress_verdict', before=r1[-200:], after=r2[-200:])

try:
    send('session/close', {'sessionId': sid}); time.sleep(1.5)
except Exception:
    pass
proc.terminate()
P(step='done')
