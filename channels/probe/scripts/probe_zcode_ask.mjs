import { AcpRawTester } from './probe_ask_user_tester.mjs';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

async function testZcode(withElicitation = false) {
  console.log(`\n======================================================`);
  console.log(`TESTING ZCODE ASK_USER (withElicitation=${withElicitation})`);
  console.log(`======================================================`);

  const caps = {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: false,
    ...(withElicitation ? { elicitation: { form: true } } : {}),
  };

  const tester = new AcpRawTester('zcode', caps);
  let userAsked = false;
  let requestFrame = null;
  let userChoiceGiven = null;

  tester.onServerRequest = async (msg, resolve, reject) => {
    requestFrame = msg;
    userAsked = true;

    if (msg.method === 'session/request_permission') {
      const toolCall = msg.params?.toolCall || {};
      const options = msg.params?.options || [];
      console.log(`\n[ZCODE ASK] Intercepted session/request_permission:`);
      console.log(`  Title:`, toolCall.title);
      console.log(`  Options:`, options.map((o) => `${o.optionId} (${o.name})`).join(' | '));

      // Choose the first non-skip option or one matching our answer
      const choice = options.find((o) => o.optionId !== '__skip__' && !o.optionId.endsWith(':no')) || options[0];
      userChoiceGiven = choice.optionId;
      console.log(`[ZCODE ASK] Selecting option:`, choice.optionId);

      // Return ACP outcome
      resolve({ outcome: { outcome: 'selected', optionId: choice.optionId } });
      return;
    }

    if (msg.method === 'elicitation/create') {
      console.log(`\n[ZCODE ASK] Intercepted elicitation/create form!`);
      const schema = msg.params?.requestedSchema;
      console.log(`  Properties:`, Object.keys(schema?.properties || {}));

      // Pick an option for q_0
      const q0 = schema?.properties?.q_0;
      let val = '香蕉';
      if (q0?.oneOf) {
        const first = q0.oneOf.find((x) => x.const !== '__skip__');
        if (first) val = first.const;
      }
      userChoiceGiven = val;
      console.log(`[ZCODE ASK] Submitting form with answer:`, val);
      resolve({
        action: 'accept',
        content: {
          q_0: val,
        },
      });
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
    const sessionName = `probe-ask-zcode-${Date.now()}`;
    console.log(`Creating session: ${sessionName}...`);
    const sessionRes = await tester.call('session/new', { cwd: CWD, mcpServers: [] });
    const sessionId = sessionRes.sessionId;
    console.log(`Created sessionId: ${sessionId}`);

    // Set model
    try {
      await tester.call('session/set_model', { sessionId, modelId: 'builtin:bigmodel-coding-plan\\GLM-5.3-Flash' });
      console.log(`Set model to GLM-5.3-Flash`);
    } catch (e) {
      console.log(`session/set_model notice:`, e.message);
    }

    // Set mode: plan or yolo
    try {
      await tester.call('session/set_mode', { sessionId, modeId: 'plan' });
      console.log(`Set mode to plan`);
    } catch (e) {
      console.log(`session/set_mode notice:`, e.message);
    }

    console.log(`\nSending prompt to trigger ask_user...`);
    const prompt = `你必须向我提问一个二选一的问题（例如问我喜欢苹果还是香蕉），提供选项，不要直接做假设，不要自己编造答案，必须调用你的提问/询问工具向我提问，等我回答后再根据我的选择回复我：请调用提问工具。`;
    const promptRes = await tester.call('session/prompt', {
      sessionId,
      prompt: [{ type: 'text', text: prompt }],
    });

    console.log(`\n\nPrompt finished! Result:`, JSON.stringify(promptRes));
    console.log(`User asked?`, userAsked);
    console.log(`Choice given:`, userChoiceGiven);

    return {
      success: userAsked,
      method: requestFrame?.method,
      requestFrame,
      userChoiceGiven,
      sessionId,
    };
  } finally {
    await tester.close();
  }
}

(async () => {
  console.log('--- Step 1: ZCode without elicitation (request_permission fallback) ---');
  const res1 = await testZcode(false);

  console.log('\n--- Step 2: ZCode with elicitation ---');
  const res2 = await testZcode(true);

  console.log('\n================ SUMMARY ================');
  console.log('Without elicitation:', res1.success ? `PASS (via ${res1.method})` : 'FAIL');
  console.log('With elicitation:', res2.success ? `PASS (via ${res2.method})` : 'FAIL');
})();
