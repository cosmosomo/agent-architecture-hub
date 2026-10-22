const { TencentDocsService } = require('E:/workbuddy/resources/app.asar.unpacked/node_modules/@tencent/tencent-docs-ai-engine/lib/common/tencent-docs-service.js');
const s = new TencentDocsService({ port: '29099', portFileRootDir: 'C:/Users/COLORFIRE/.workbuddy' });
s.ensureStarted().then(() => {
    console.log('READY on port:', s.getPort());
    setInterval(() => {}, 10000);
}).catch(e => {
    console.error('ERR:', e);
    process.exit(1);
});
