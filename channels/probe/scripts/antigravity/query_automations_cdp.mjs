import http from 'node:http';

async function main() {
  const list = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:9234/json/list`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = list.find((t) => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) {
    console.error('No page target found on port 9234');
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

  const code = `(() => {
    const all = Array.from(document.querySelectorAll('*'));
    const matched = all
      .filter(el => /automation|schedule|cron/i.test(el.innerText || el.getAttribute('aria-label') || el.className || ''))
      .map(el => ({
        tag: el.tagName,
        ariaLabel: el.getAttribute('aria-label'),
        text: (el.innerText || '').slice(0, 100),
        className: el.className
      }))
      .filter(x => x.text || x.ariaLabel);
    return {
      title: document.title,
      matchedCount: matched.length,
      sample: matched.slice(0, 10)
    };
  })()`;

  const domInfo = await send('Runtime.evaluate', {
    expression: code,
    returnByValue: true,
  });

  console.log('Automations CDP search result:', JSON.stringify(domInfo.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
