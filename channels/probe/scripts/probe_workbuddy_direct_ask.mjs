import { AcpRawTester } from './probe_ask_user_tester.mjs';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

async function testWbDirect() {
  console.log(`\n======================================================`);
  console.log(`TESTING WORKBUDDY DIRECT ASK`);
  console.log(`======================================================`);

  const tester = new AcpRawTester('workbuddy', {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: false,
  });

  let currentSid = null;
  let intercepted = [];

  tester.onServerRequest = async (msg, resolve, reject) => {
    console.log(`\n>>> [WORKBUDDY REQUEST RECEIVED]: ${msg.method} id=${msg.id}`);
    console.log(JSON.stringify(msg, null, 2));
    intercepted.push(msg);

    if (msg.method === 'session/request_permission') {
      const toolCall = msg.params?.toolCall || {};
      const toolCallId = toolCall.toolCallId;
      const toolName = toolCall._meta?.['codebuddy.ai/toolName'] || toolCall.title;

      console.log(`Intercepted tool permission: toolName=${toolName}, toolCallId=${toolCallId}`);

      // Try calling extension method _codebuddy.ai/resolveInterruption if toolName is AskUserQuestion or DeferExecuteTool
      if (toolName === 'AskUserQuestion' || toolCall.rawInput?.toolName === 'AskUserQuestion') {
        console.log(`Attempting to call _codebuddy.ai/resolveInterruption with answers...`);
        try {
          const res = await tester.call('_codebuddy.ai/resolveInterruption', {
            sessionId: currentSid,
            toolCallId: toolCallId,
            decision: 'allow',
            answers: {
              '二选一：你更喜欢哪种水果？': '香蕉',
              'q_0': '香蕉',
            },
          });
          console.log(`_codebuddy.ai/resolveInterruption response:`, res);
        } catch (e) {
          console.log(`_codebuddy.ai/resolveInterruption error:`, e.message || e);
        }
      }

      // Also respond to the standard permission request
      resolve({ outcome: { outcome: 'selected', optionId: 'allow' } });
      return;
    }

    if (msg.method === 'fs/read_text_file' || msg.method === 'fs/write_text_file') {
      resolve({});
      return;
    }

    reject({ code: -32601, message: `Method not implemented: ${msg.method}` });
  };

  try {
    await tester.start();
    const sessionRes = await tester.call('session/new', { cwd: CWD, mcpServers: [] });
    currentSid = sessionRes.sessionId;
    console.log(`Created sessionId: ${currentSid}`);

    await tester.call('session/set_model', { sessionId: currentSid, modelId: 'custom-local:glm-5.3-flash' });
    console.log(`Set model to custom-local:glm-5.3-flash`);

    const prompt = `请直接调用 AskUserQuestion 工具向我提问：
问我“你喜欢苹果还是香蕉？”，选项为“苹果”和“香蕉”。
请不要通过 DeferExecuteTool，直接执行 AskUserQuestion，等我回答后再根据我的选择回复我。`;

    console.log(`\nSending prompt...`);
    const promptRes = await tester.call('session/prompt', {
      sessionId: currentSid,
      prompt: [{ type: 'text', text: prompt }],
    });

    console.log(`\nPrompt finished! Result:`, JSON.stringify(promptRes));
    return {
      intercepted,
      promptRes,
      sessionId: currentSid,
    };
  } finally {
    await tester.close();
  }
}

testWbDirect().then((res) => {
  console.log(`Done! Intercepted ${res.intercepted.length} requests.`);
});
