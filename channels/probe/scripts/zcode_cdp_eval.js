// Evaluates DOM and inspects UI state of ZCode Desktop via native CDP WebSocket
// Zero UI stealing, completely silent in background.
import http from 'node:http';

async function main() {
  const list = await new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9240/json/list', (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = list.find((t) => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) {
    console.error('No page target found on :9240');
    process.exit(1);
  }

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve) => (ws.onopen = resolve));

  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const id = Math.floor(Math.random() * 100000);
      const handler = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.id === id) {
          ws.removeEventListener('message', handler);
          resolve(msg.result);
        }
      };
      ws.addEventListener('message', handler);
      ws.send(JSON.stringify({ id, method, params }));
    });

  const evalResult = await send('Runtime.evaluate', {
    expression: JSON.stringify({
      title: 'ZCode',
      elementCount: 'document.querySelectorAll("*").length',
      buttonCount: 'document.querySelectorAll("button").length',
    }),
  });

  // Execute real JS in renderer
  const domInfo = await send('Runtime.evaluate', {
    expression: 'JSON.stringify({ title: document.title, totalElements: document.querySelectorAll("*").length, buttons: document.querySelectorAll("button").length, inputs: document.querySelectorAll("input, textarea").length })',
    returnByValue: true,
  });

  console.log('DOM Info:', domInfo.result.value);
  ws.close();
}

main().catch(console.error);
