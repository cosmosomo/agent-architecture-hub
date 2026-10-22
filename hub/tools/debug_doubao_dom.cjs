const http = require('http');
const { WebSocket } = require('C:/Users/COLORFIRE/AppData/Roaming/npm/node_modules/@jackwener/opencli/node_modules/ws');

http.get('http://127.0.0.1:9225/json', (res) => {
  let body = '';
  res.on('data', c => body += c);
  res.on('end', () => {
    const list = JSON.parse(body);
    const wsUrl = list[0]?.webSocketDebuggerUrl;
    if (!wsUrl) {
      console.log('No inspectable targets found on 9225:', list);
      return;
    }
    const ws = new WebSocket(wsUrl);
    ws.on('open', () => {
      let id = 1;
      const send = (method, params) => new Promise(r => {
        const cur = id++;
        const onMsg = (data) => {
          const m = JSON.parse(data.toString());
          if (m.id === cur) {
            ws.off('message', onMsg);
            r(m.result);
          }
        };
        ws.on('message', onMsg);
        ws.send(JSON.stringify({ id: cur, method, params }));
      });

      send('Runtime.evaluate', {
        expression: `(() => {
          const msgs = Array.from(document.querySelectorAll('[data-testid="message_content"]'));
          const breakBtn = document.querySelector('[data-testid="chat_input_local_break_button"]');
          const loading = document.querySelectorAll('[data-testid="message_loading"]');
          return JSON.stringify({
            msgCount: msgs.length,
            breakBtnFound: !!breakBtn,
            breakBtnDisplay: breakBtn ? window.getComputedStyle(breakBtn).display : null,
            loadingCount: loading.length,
            msgs: msgs.map((m, idx) => ({
              idx,
              className: m.className,
              isUser: m.classList.contains('justify-end') || !!m.closest('[data-testid="send_message"]'),
              hasIndicator: !!m.querySelector('[data-testid="indicator"], [data-testid="message_loading"]'),
              textLen: m.innerText ? m.innerText.length : 0,
              textPreview: (m.innerText || '').substring(0, 50).replace(/\\n/g, ' ')
            }))
          });
        })()`,
        returnByValue: true
      }).then(res => {
        console.log(JSON.stringify(JSON.parse(res.result.value), null, 2));
        ws.close();
      }).catch(err => {
        console.error('Evaluate error:', err);
        ws.close();
      });
    });
    ws.on('error', err => {
      console.error('WebSocket error:', err.message);
    });
  });
}).on('error', err => {
  console.error('HTTP error:', err.message);
});
