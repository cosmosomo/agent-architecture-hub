// Answers search queries off the service's main thread, on its own read connection to the index file (WAL lets it
// read while search_worker.ts writes). A query with a short term scans every step's text; here that no longer holds
// the service's other requests.
import { parentPort, workerData } from 'node:worker_threads';
import { SearchIndex } from './search.ts';

const index = new SearchIndex(workerData.file);
parentPort!.on('message', ({ id, method, args }) => {
  try {
    if (method !== 'query') throw new Error(`Unknown search read operation ${method}`);
    parentPort!.postMessage({ id, value: index.query(args[0]) });
  } catch (error) {
    parentPort!.postMessage({ id, error: error instanceof Error ? error.stack : String(error) });
  }
});
