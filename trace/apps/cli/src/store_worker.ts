import { parentPort, workerData } from 'node:worker_threads';
import { ADAPTERS } from '@hub-trace/adapters';
import { SessionStore } from './store.ts';

const store = new SessionStore({ roots: workerData.roots.map((r: any) => {
  const adapter = ADAPTERS[r.adapterIndex];
  if (!adapter || adapter.kind !== r.kind) throw new Error(`Unknown worker adapter ${r.kind} at ${r.adapterIndex}`);
  return { adapter, dir: r.dir };
}), cacheFile: workerData.cacheFile });
let queue = Promise.resolve();
parentPort!.on('message', ({ id, method, args }) => {
  queue = queue.then(async () => {
    try {
      let value;
      if (method === 'scan') {
        const report = await store.scan();
        value = { report, files: store.files(), index: store.index(), revision: store.revision() };
      } else if (method === 'session') value = await store.session(args[0]);
      else if (method === 'parseSource') value = await store.parseSource(args[0]);
      else throw new Error(`Unknown store read operation ${method}`);
      parentPort!.postMessage({ id, value });
    } catch (error) {
      parentPort!.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
    }
  });
});
