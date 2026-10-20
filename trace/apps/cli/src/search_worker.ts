import { parentPort, workerData } from 'node:worker_threads';
import { SearchIndex } from './search.ts';

const index = new SearchIndex(workerData.file);
let queue = Promise.resolve();
parentPort!.on('message', ({ id, method, args }) => {
  queue = queue.then(async () => {
    try {
      let value;
      if (method === 'put') value = await index.put(args[0], args[1], async () => {});
      else if (method === 'remove') index.remove(args[0]);
      else if (method === 'analyze') index.analyze();
      else if (method === 'checkpoint') index.checkpoint();
      else throw new Error(`Unknown search write operation ${method}`);
      parentPort!.postMessage({ id, value });
    } catch (error) {
      parentPort!.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
    }
  });
});
