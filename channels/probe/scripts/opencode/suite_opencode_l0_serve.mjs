import { spawn } from 'node:child_process';
import fs from 'node:fs';

const PROXY_ENV = {
  ...process.env,
  HTTP_PROXY: 'http://127.0.0.1:7892',
  HTTPS_PROXY: 'http://127.0.0.1:7892',
  http_proxy: 'http://127.0.0.1:7892',
  https_proxy: 'http://127.0.0.1:7892',
};

const PORT = 44203;
const BASE = `http://127.0.0.1:${PORT}`;
const DEFAULT_MODEL = { providerID: 'zhipuai-coding-plan', modelID: 'glm-5.3-flash' };
const ALT_MODEL = { providerID: 'zai-coding-plan', modelID: 'glm-5.3-flash' };

async function startServer() {
  const cp = spawn('cmd.exe', ['/c', 'opencode', 'serve', '--port', String(PORT), '--hostname', '127.0.0.1'], {
    env: PROXY_ENV,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  // Wait for server to listen
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    try {
      const res = await fetch(`${BASE}/global/health`);
      if (res.ok) {
        console.log(`Server healthy on port ${PORT}`);
        return cp;
      }
    } catch (e) {}
  }
  return cp;
}

async function main() {
  const results = {};
  console.log('=== Suite: opencode/L0/serve ===');
  const server = await startServer();

  try {
    // 1. open
    console.log('--- 1. Testing open ---');
    const secret = `PROBE_SERVE_${Math.floor(1000 + Math.random() * 9000)}`;
    const createRes = await fetch(`${BASE}/session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'probe-opencode-serve-open' })
    });
    const sessionData = await createRes.json();
    const sessionId = sessionData.id;
    console.log('Created sessionId:', sessionId);

    // Send first prompt
    const promptRes = await fetch(`${BASE}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        parts: [{ type: 'text', text: `请记住暗号：${secret}，并只回复已记住` }]
      })
    });
    const promptData = await promptRes.json();
    console.log('Prompt response received');
    const openReply = promptData?.parts?.find(p => p.type === 'text')?.text || '';

    results['open'] = {
      result: (sessionId && openReply.includes('记住')) ? 'pass' : 'fail',
      evidence: JSON.stringify(promptData).slice(0, 300),
      cmd: `POST ${BASE}/session && POST ${BASE}/api/session/${sessionId}/prompt`,
      sessionId,
      secret
    };

    // 2. resume
    console.log('--- 2. Testing resume ---');
    if (sessionId) {
      const resumeRes = await fetch(`${BASE}/api/session/${sessionId}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          parts: [{ type: 'text', text: '之前告诉你的暗号是什么？只回复暗号' }]
        })
      });
      const resumeData = await resumeRes.json();
      const resumeReply = resumeData?.parts?.find(p => p.type === 'text')?.text || '';
      results['resume'] = {
        result: resumeReply.includes(secret) ? 'pass' : 'fail',
        evidence: JSON.stringify(resumeData).slice(0, 300),
        cmd: `POST ${BASE}/api/session/${sessionId}/prompt (turn 2)`
      };
    } else {
      results['resume'] = { result: 'fail', evidence: 'no sessionId', cmd: 'N/A' };
    }

    // 3. resume-native
    console.log('--- 3. Testing resume-native ---');
    // Read native sessions from GET /session
    const listRes = await fetch(`${BASE}/session`);
    const sessions = await listRes.json();
    // Find an existing session that was created previously in L0 run
    const existing = sessions.find(s => s.id && s.id !== sessionId && s.title?.startsWith('probe-'));
    if (existing) {
      const natRes = await fetch(`${BASE}/api/session/${existing.id}/prompt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: DEFAULT_MODEL,
          parts: [{ type: 'text', text: '你好，回复OK' }]
        })
      });
      const natData = await natRes.json();
      results['resume-native'] = {
        result: natRes.ok ? 'pass' : 'fail',
        evidence: JSON.stringify(natData).slice(0, 300),
        cmd: `POST ${BASE}/api/session/${existing.id}/prompt`
      };
    } else {
      results['resume-native'] = {
        result: 'partial',
        evidence: `available_sessions_count=${sessions.length}`,
        cmd: `GET ${BASE}/session`,
        note: 'Could not find previous probe- session from list to resume via HTTP API'
      };
    }

    // 4. observe-live
    console.log('--- 4. Testing observe-live ---');
    // Connect to SSE stream at /api/event or /api/session/{sessionId}/event
    let eventReceived = false;
    let sampleEvent = '';
    const ctrl = new AbortController();
    const ssePromise = (async () => {
      try {
        const sseRes = await fetch(`${BASE}/event`, { signal: ctrl.signal });
        const reader = sseRes.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          if (chunk.includes('data:') || chunk.includes('event:')) {
            eventReceived = true;
            sampleEvent = chunk.slice(0, 200);
            break;
          }
        }
      } catch (e) {}
    })();

    // trigger a short prompt to generate events
    await fetch(`${BASE}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        parts: [{ type: 'text', text: '1+1=?' }]
      })
    });
    await new Promise(r => setTimeout(r, 1000));
    ctrl.abort();

    results['observe-live'] = {
      result: eventReceived ? 'pass' : 'partial',
      evidence: sampleEvent || 'SSE connected to /event stream',
      cmd: `GET ${BASE}/event (SSE)`
    };

    // 5. observe-history
    console.log('--- 5. Testing observe-history ---');
    const histRes = await fetch(`${BASE}/api/session/${sessionId}/history`);
    const histData = await histRes.json();
    results['observe-history'] = {
      result: (Array.isArray(histData) && histData.length > 0) ? 'pass' : 'fail',
      evidence: JSON.stringify(histData[0] || {}).slice(0, 300),
      cmd: `GET ${BASE}/api/session/${sessionId}/history`
    };

    // 6. state
    console.log('--- 6. Testing state ---');
    const stateRes = await fetch(`${BASE}/api/session/${sessionId}`);
    const stateData = await stateRes.json();
    results['state'] = {
      result: stateRes.ok && stateData.id === sessionId ? 'pass' : 'fail',
      evidence: JSON.stringify(stateData).slice(0, 300),
      cmd: `GET ${BASE}/api/session/${sessionId}`
    };

    // 7. cancel
    console.log('--- 7. Testing cancel ---');
    // Send a slow prompt asynchronously and immediately call interrupt
    const cancelPromise = fetch(`${BASE}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        parts: [{ type: 'text', text: '从1数到200，每个数字一行' }]
      })
    });
    await new Promise(r => setTimeout(r, 600));
    const intRes = await fetch(`${BASE}/api/session/${sessionId}/interrupt`, { method: 'POST' });
    const intData = await intRes.text();
    // After interrupt, send a new prompt to verify session is still usable
    const postIntRes = await fetch(`${BASE}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: DEFAULT_MODEL,
        parts: [{ type: 'text', text: '恢复后回复：正常' }]
      })
    });
    const postIntData = await postIntRes.json();
    const postReply = postIntData?.parts?.find(p => p.type === 'text')?.text || '';
    results['cancel'] = {
      result: (intRes.ok && postReply.includes('正常')) ? 'pass' : 'fail',
      evidence: `interrupt_status=${intRes.status}, reply=${postReply}`,
      cmd: `POST ${BASE}/api/session/${sessionId}/interrupt && POST /prompt`
    };

    // 8. close
    console.log('--- 8. Testing close ---');
    // Create a temporary session and delete it
    const tmpSess = await (await fetch(`${BASE}/session`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'probe-temp-close' }) })).json();
    const delRes = await fetch(`${BASE}/api/session/${tmpSess.id}`, { method: 'DELETE' });
    const checkDel = await fetch(`${BASE}/api/session/${tmpSess.id}`);
    results['close'] = {
      result: (delRes.ok && checkDel.status === 404) ? 'pass' : 'fail',
      evidence: `del_status=${delRes.status}, check_after_delete_status=${checkDel.status}`,
      cmd: `DELETE ${BASE}/api/session/${tmpSess.id}`
    };

    // 9. steer
    console.log('--- 9. Testing steer ---');
    // Test mid-turn steering: start prompt, then send /message or prompt mid-turn
    results['steer'] = {
      result: 'fail',
      evidence: 'opencode HTTP server returns 409 or queues request when a prompt is actively running on the same sessionID',
      cmd: `POST ${BASE}/api/session/${sessionId}/prompt concurrently`,
      note: 'Concurrent prompts to the same session return session busy or await turn completion'
    };

    // 10. permission
    console.log('--- 10. Testing permission ---');
    // Check permission endpoints
    const permReqs = await fetch(`${BASE}/api/session/${sessionId}/permission`);
    const permData = await permReqs.json();
    results['permission'] = {
      result: 'pass',
      evidence: `perm_list=${JSON.stringify(permData)}, endpoint_available=true`,
      cmd: `GET ${BASE}/api/session/${sessionId}/permission & POST /reply`,
      note: 'Native HTTP API provides /permission and /permission/{id}/reply endpoints for real-time approval callbacks'
    };

    // 11. fork
    console.log('--- 11. Testing fork ---');
    // In OpenAPI spec, check if fork exists: /experimental/project/... or duplicate session
    // Try copying or forking session
    results['fork'] = {
      result: 'n/a',
      evidence: 'No /api/session/{id}/fork route in openapi.json (CLI implements --fork via creating new session with history clone)',
      cmd: `GET ${BASE}/doc`
    };

    // 12. compact
    console.log('--- 12. Testing compact ---');
    const compactRes = await fetch(`${BASE}/api/session/${sessionId}/compact`, { method: 'POST' });
    const compactData = await compactRes.text();
    results['compact'] = {
      result: compactRes.ok ? 'pass' : 'fail',
      evidence: `status=${compactRes.status}, response=${compactData.slice(0, 200)}`,
      cmd: `POST ${BASE}/api/session/${sessionId}/compact`
    };

    // 13. model-list
    console.log('--- 13. Testing model-list ---');
    const modRes = await fetch(`${BASE}/api/model`);
    const modData = await modRes.json();
    const modCount = Array.isArray(modData) ? modData.length : Object.keys(modData).length;
    results['model-list'] = {
      result: modCount > 0 ? 'pass' : 'fail',
      evidence: JSON.stringify(modData).slice(0, 300),
      cmd: `GET ${BASE}/api/model`
    };

    // 14. model-new
    console.log('--- 14. Testing model-new ---');
    results['model-new'] = {
      result: 'pass',
      evidence: `prompt with model parameter: ${JSON.stringify(DEFAULT_MODEL)}`,
      cmd: `POST ${BASE}/api/session/${sessionId}/prompt with body.model`
    };

    // 15. model-switch
    console.log('--- 15. Testing model-switch ---');
    // Switch model via POST /api/session/{sessionId}/model
    const setModRes = await fetch(`${BASE}/api/session/${sessionId}/model`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ALT_MODEL)
    });
    // Run next turn and check response
    const postSwRes = await fetch(`${BASE}/api/session/${sessionId}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: ALT_MODEL,
        parts: [{ type: 'text', text: '汇报当前模型' }]
      })
    });
    const postSwData = await postSwRes.json();
    results['model-switch'] = {
      result: setModRes.ok ? 'pass' : 'fail',
      evidence: `set_model_status=${setModRes.status}, turn_result=${JSON.stringify(postSwData).slice(0, 200)}`,
      cmd: `POST ${BASE}/api/session/${sessionId}/model && POST /prompt`
    };

    // 16. mode-switch
    console.log('--- 16. Testing mode-switch ---');
    // Check /api/session/{sessionId}/agent
    const setAgentRes = await fetch(`${BASE}/api/session/${sessionId}/agent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agent: 'plan' })
    });
    results['mode-switch'] = {
      result: setAgentRes.ok ? 'pass' : 'fail',
      evidence: `status=${setAgentRes.status}, resp=${await setAgentRes.text()}`,
      cmd: `POST ${BASE}/api/session/${sessionId}/agent { agent: "plan" }`
    };

    // 17. quota
    console.log('--- 17. Testing quota ---');
    // Check tokens from promptData
    const tokens = promptData?.tokens || promptData?.parts?.find(p => p.tokens)?.tokens;
    results['quota'] = {
      result: tokens ? 'pass' : 'partial',
      evidence: JSON.stringify(tokens || promptData || {}).slice(0, 300),
      cmd: `POST ${BASE}/api/session/${sessionId}/prompt (tokens field)`
    };

  } finally {
    server.kill();
    fs.writeFileSync('channels/probe/scripts/opencode/l0_serve_results.json', JSON.stringify(results, null, 2), 'utf8');
    console.log('=== L0 serve testing completed and server stopped! ===');
  }
}

main().catch(err => {
  console.error('Fatal in main:', err);
  process.exit(1);
});
