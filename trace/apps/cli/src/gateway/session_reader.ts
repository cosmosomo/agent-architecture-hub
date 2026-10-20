import type { Session, SessionSummary } from '@hub-trace/contract';
import type { AcpxSessionInfo } from './types.ts';
import { ReadRpc } from '../read_rpc.ts';

export class SessionReader {
  private rpc: ReadRpc;
  list: AcpxSessionInfo[] = [];
  recent: SessionSummary[] = [];
  updatedAt = 0;
  error?: string;
  private pending?: Promise<AcpxSessionInfo[]>;
  constructor(repoRoot: string, cacheFile: string) {
    this.rpc = new ReadRpc(new URL('./session_worker.ts', import.meta.url), { repoRoot, cacheFile });
  }
  get ready() { return this.updatedAt > 0 && !this.error && Date.now() - this.updatedAt < 60_000; }
  refresh(): Promise<AcpxSessionInfo[]> {
    if (this.pending) return this.pending;
    if (Date.now() - this.updatedAt < 10_000) return Promise.resolve(this.list);
    this.pending = this.rpc.call<{ list: AcpxSessionInfo[]; recent: SessionSummary[] }>('list').then((result) => {
      this.list = result.list;
      this.recent = result.recent;
      this.updatedAt = Date.now();
      this.error = undefined;
      return this.list;
    }).catch((error) => {
      this.error = String(error);
      throw error;
    }).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  current() {
    void this.refresh().catch((error) => console.error('[session-discovery]', error));
    return this.list;
  }
  contract(id: string): Promise<Session | null> { return this.rpc.call('contract', [id]); }
  summaries(existing: Set<string>): Promise<SessionSummary[]> { return this.rpc.call('summaries', [[...existing]]); }
  async close() { await this.rpc.close(); }
}
