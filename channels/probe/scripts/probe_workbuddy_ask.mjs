import { AcpRawTester } from './probe_ask_user_tester.mjs';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';

async function testWorkbuddy() {
  console.log(`\n======================================================`);
  console.log(`TESTING WORKBUDDY ASK_USER`);
  console.log(`======================================================`);

  const caps = {
    fs: { readTextFile: true, writeTextFile: true },
    terminal: false,
  };

  const tester = new AcpRawTester('workbuddy', caps);
  let userAsked = false;
  let requestFrame = null;
  let userChoiceGiven = null;
  let currentSid = null;

  tester.onServerRequest = async (msg, resolve, reject) => {
    requestFrame = msg;
    userAsked = true;

    if (msg.method === 'session/request_permission') {
      const toolCall = msg.params?.toolCall || {};
      const options = msg.params?.options || [];
      console.log(`\n[WORKBUDDY ASK] Intercepted session/request_permission:`);
      console.log(`  ToolCall Title:`, toolCall.title);
      console.log(`  ToolCall _meta:`, JSON.stringify(toolCall._meta));
      console.log(`  ToolCall rawInput:`, JSON.stringify(toolCall.rawInput));
      console.log(`  Options:`, options.map((o) => `${o.optionId} (${o.name}, kind=${o.kind})`).join(' | '));

      const toolName = toolCall._meta?.['codebuddy.ai/toolName'] || toolCall.title;
      const toolCallId = toolCall.toolCallId;

      if (toolName === 'AskUserQuestion') {
        console.log(`  -> Detected AskUserQuestion in request_permission!`);
        // Let us see if we can resolve it via extension method `_codebuddy.ai/resolveInterruption`
        // or via standard request_permission return.
        // First let us check what rawInput questions are:
        const questions = toolCall.rawInput?.questions || [];
        console.log(`  -> Questions:`, JSON.stringify(questions));

        // Let us test answering via standard response first or checking if we can call resolveInterruption!
        const choice = '香蕉';
        userChoiceGiven = choice;

        // Try standard allow option:
        const allowOpt = options.find((o) => o.optionId === 'allow' || o.kind === 'allow_once');
        console.log(`[WORKBUDDY ASK] Standard resolution with optionId:`, allowOpt?.optionId);
        resolve({ outcome: { outcome: 'selected', optionId: allowOpt?.optionId || 'allow' } });
        return;
      }

      // Default allow
      resolve({ outcome: { outcome: 'selected', optionId: options[0]?.optionId || 'allow' } });
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
    const sessionName = `probe-ask-wb-${Date.now()}`;
    console.log(`Creating session: ${sessionName}...`);
    const sessionRes = await tester.call('session/new', { cwd: CWD, mcpServers: [] });
    currentSid = sessionRes.sessionId;
    console.log(`Created sessionId: ${currentSid}`);

    // Try setting model to custom-local:glm-5.3-flash
    try {
      await tester.call('session/set_model', { sessionId: currentSid, modelId: 'custom-local:glm-5.3-flash' });
      console.log(`Set model to custom-local:glm-5.3-flash`);
    } catch (e) {
      console.log(`session/set_model notice:`, e.message || e);
    }

    console.log(`\nSending prompt to trigger AskUserQuestion...`);
    const prompt = `你必须向我提问一个二选一的问题（例如问我喜欢苹果还是香蕉），提供选项，不要直接做假设，不要自己编造答案，必须调用你的提问/询问工具向我提问，等我回答后再根据我的选择回复我：请调用提问工具。`;
    const promptRes = await tester.call('session/prompt', {
      sessionId: currentSid,
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
      sessionId: currentSid,
      promptRes,
    };
  } finally {
    await tester.close();
  }
}

(async () => {
  const res = await testWorkbuddy();
  console.log('\n================ SUMMARY ================');
  console.log('WorkBuddy ask result:', res.success ? `PASS (via ${res.method})` : 'FAIL');
})();
