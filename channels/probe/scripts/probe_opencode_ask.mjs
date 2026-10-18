import { AcpRawTester } from './probe_ask_user_tester.mjs';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

async function testOpencode() {
  console.log(`\n======================================================`);
  console.log(`TESTING OPENCODE ASK_USER`);
  console.log(`======================================================`);

  const caps = {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: false,
  };

  const tester = new AcpRawTester('opencode', caps);
  let userAsked = false;
  let requestFrame = null;
  let userChoiceGiven = null;
  let currentSid = null;

  tester.onServerRequest = async (msg, resolve, reject) => {
    console.log(`\n>>> [OPENCODE REQUEST RECEIVED]: ${msg.method} id=${msg.id}`);
    console.log(JSON.stringify(msg, null, 2));
    requestFrame = msg;
    userAsked = true;

    if (msg.method === 'session/request_permission') {
      const toolCall = msg.params?.toolCall || {};
      const options = msg.params?.options || [];
      console.log(`Intercepted permission request: title=${toolCall.title}, options=`, options);
      resolve({ outcome: { outcome: 'selected', optionId: options[0]?.optionId || 'allow' } });
      return;
    }

    if (msg.method === 'elicitation/create') {
      console.log(`Intercepted elicitation request:`, msg.params);
      resolve({ action: 'accept', content: { answer: '香蕉' } });
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

    try {
      await tester.call('session/set_model', { sessionId: currentSid, modelId: 'zhipuai-coding-plan/glm-5.3-flash' });
      console.log(`Set model to zhipuai-coding-plan/glm-5.3-flash`);
    } catch (e) {
      console.log(`session/set_model notice:`, e.message || e);
    }

    const prompt = `你必须向我提问一个二选一的问题（例如问我喜欢苹果还是香蕉），提供选项，不要直接做假设，不要自己编造答案，必须调用你的提问/询问工具向我提问，等我回答后再根据我的选择回复我：请调用提问工具。`;

    console.log(`\nSending prompt...`);
    const promptRes = await tester.call('session/prompt', {
      sessionId: currentSid,
      prompt: [{ type: 'text', text: prompt }],
    });

    console.log(`\nPrompt finished! Result:`, JSON.stringify(promptRes));
    return {
      success: userAsked,
      method: requestFrame?.method,
      requestFrame,
      userChoiceGiven,
      sessionId: currentSid,
      promptRes,
    };
  } finally {
    await tester.close();
  }
}

testOpencode().then((res) => {
  console.log(`Done! User asked? ${res.success}`);
});
