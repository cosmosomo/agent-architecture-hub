// cdp_read_dom.mjs — Read DOM and UI state of any active Electron app via CDP WebSocket
// Zero UI stealing, completely silent in background.
import http from 'node:http';

const port = process.argv[2] || '9240';

async function main() {
  const list = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${port}/json/list`, (res) => {
      let data = '';
      res.on('data', (c) => (data += c));
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  const page = list.find((t) => t.type === 'page');
  if (!page || !page.webSocketDebuggerUrl) {
    console.error(`No page target found on port :${port}`);
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
    const rawLabels = Array.from(document.querySelectorAll('button, [role=button], .menu-item, [role=menuitem], nav, header, aside, [aria-label]'))
      .map(el => (el.getAttribute('aria-label') || el.innerText || el.title || '').trim())
      .filter(t => t.length > 0 && t.length < 50);
    const unique = Array.from(new Set(rawLabels));
    return {
      title: document.title,
      totalElements: document.querySelectorAll('*').length,
      buttons: document.querySelectorAll('button').length,
      sampleLabels: unique.slice(0, 25)
    };
  })()`;

  const domInfo = await send('Runtime.evaluate', {
    expression: code,
    returnByValue: true,
  });

  console.log(`Port ${port} UI Summary:`, JSON.stringify(domInfo.result.value, null, 2));
  ws.close();
}

main().catch(console.error);
