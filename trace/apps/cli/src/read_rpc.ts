import { Worker } from 'node:worker_threads';

/** One owner for synchronous source work. Failures propagate; calls never move back onto the HTTP thread. */
export class ReadRpc {
  private worker: Worker;
  private next = 0;
  private failure?: Error;
  private closing = false;
  private pending = new Map<number, { resolve: (value: any) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
  constructor(url: URL, data: unknown) {
    this.worker = new Worker(url, { workerData: data, env: { ...process.env, HUB_BACKGROUND: '0' } });
    this.worker.on('message', ({ id, value, error }) => {
      const request = this.pending.get(id);
      if (!request) return;
      clearTimeout(request.timer);
      this.pending.delete(id);
      if (error) request.reject(new Error(error));
      else request.resolve(value);
      if (!this.pending.size) this.worker.unref();
    });
    const fail = (error: Error) => {
      this.failure = error;
      console.error('[read-worker]', error);
      for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(error); }
      this.pending.clear();
    };
    this.worker.on('error', fail);
    this.worker.on('exit', (code) => { if (!this.failure && !this.closing) fail(new Error(`Read worker exited (${code})`)); });
    this.worker.unref();
  }
  call<T>(method: string, args: unknown[] = []): Promise<T> {
    if (this.failure) return Promise.reject(this.failure);
    const id = ++this.next;
    this.worker.ref();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Read worker ${method} exceeded 180s`));
        if (!this.pending.size) this.worker.unref();
      }, 180_000);
      this.pending.set(id, { resolve, reject, timer });
      this.worker.postMessage({ id, method, args });
    });
  }
  async close() {
    this.closing = true;
    this.failure = new Error('Read worker closed');
    for (const request of this.pending.values()) { clearTimeout(request.timer); request.reject(this.failure); }
    this.pending.clear();
    await this.worker.terminate();
  }
}
