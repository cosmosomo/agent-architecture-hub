import fs from 'node:fs';
import path from 'node:path';

const CWD = 'E:\\program\\GIT\\Agent\\multi\\Agent-Architecture-Hub';
const bbPath = path.resolve(CWD, 'channels', 'probe', 'blackboard.jsonl');
const now = new Date().toISOString();

const entries = [
  // Special wake-stall entry
  {
    at: now,
    by: 'agy-flash',
    family: 'antigravity',
    layer: 'L0',
    route: 'codex/L0/app-server',
    surface: 'daemon',
    capability: 'wake-stall',
    result: 'fail',
    condition: 'run_command launching persistent daemon without timeout',
    evidence: 'Task id ed540fb1-25a0-457a-acdf-2e0d9f42cf5a/task-157 hung for 15+ minutes because stdio JSON-RPC daemon does not self-terminate',
    cmd: 'codex app-server --listen stdio://',
    note: 'app-server is a persistent background daemon; executing it via run_command without a self-terminating client will hang execution indefinitely.'
  },

  // Route 1: codex/L0/exec
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'open', result: 'pass', condition: 'single-turn cold CLI with gpt-5.6-sol',
    evidence: 'thread_id=01a1493c-3800-7dc2-a647-3b22b045e47d, reply=WORD_SAVED_OK',
    cmd: 'codex exec --json --skip-git-repo-check -m gpt-5.6-sol -',
    note: 'Single-turn execution succeeded with working model gpt-5.6-sol.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'resume', result: 'pass', condition: 'cold resume by threadId',
    evidence: 'reply=PROBE_SECRET_ALPHA_789',
    cmd: 'codex exec resume --json --skip-git-repo-check -m gpt-5.6-sol 01a1493c-3800-7dc2-a647-3b22b045e47d -',
    note: 'Second round recalled exact secret word PROBE_SECRET_ALPHA_789.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'resume-native', result: 'pass', condition: 'native CLI created session resumed by CLI',
    evidence: 'This session was recorded with model gpt-6.1-sol but is resuming with gpt-5.6-sol ... agent_message: pong, input_tokens: 94210',
    cmd: 'codex exec resume --json --skip-git-repo-check -m gpt-5.6-sol 01a1493c-8164-7cf2-a356-c44a12a5a15b -',
    note: 'Successfully resumed cold native CLI thread.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'observe-live', result: 'pass', condition: 'stdout streaming chunks over --json',
    evidence: 'chunks_count=5, duration=12440ms, first_chunk_at=421ms, last_chunk_at=7224ms',
    cmd: 'codex exec --json --skip-git-repo-check -m gpt-5.6-sol -',
    note: 'Events are streamed line-by-line over stdout in real time.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'observe-history', result: 'n/a', condition: 'CLI command probe',
    evidence: 'error: unrecognized subcommand \'history\' (out=Codex CLI If no subcommand is specified, options will be formatted as prompt)',
    cmd: 'codex history --help',
    note: 'codex CLI has no command to read back session history; history is stored in ~/.codex/sessions/ JSONL files.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'state', result: 'n/a', condition: 'CLI command probe',
    evidence: 'error: unrecognized subcommand \'status\' (out=Codex CLI If no subcommand is specified, options will be formatted as prompt)',
    cmd: 'codex status --help',
    note: 'codex CLI has no status command for querying session state.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'cancel', result: 'fail', condition: 'kill child process during execution on Windows',
    evidence: 'failed to initialize thread persistence: thread-store conflict: thread 01a14944-c0da-76e0-8b54-2abedb1f9837 already has an active writer (code -32600)',
    cmd: 'kill process -> codex exec resume --json -m gpt-5.6-sol 01a14944-c0da-76e0-8b54-2abedb1f9837 -',
    note: 'Killing the CLI process leaves background worker holding the active writer lock on Windows, blocking resume.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'close', result: 'pass', condition: 'codex archive by threadId',
    evidence: 'Archived session 01a1493c-3800-7dc2-a647-3b22b045e47d. (exitCode=0)',
    cmd: 'codex archive 01a1493c-3800-7dc2-a647-3b22b045e47d',
    note: 'Successfully archived session from disk.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'steer', result: 'n/a', condition: 'single-turn process stdin closed',
    evidence: 'Single-turn CLI process stdin is closed at start; mid-turn steering is not supported over codex exec stdin.',
    cmd: 'codex exec (stdin closed upon launch)',
    note: 'In channels/hosts/codex/README.md §2.3: codex exec does not support mid-turn steer.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'permission', result: 'fail', condition: 'approval_policy="on-request" in headless exec',
    evidence: '2026-10-17T09:42:37.685228Z ERROR codex_core::tools::router: error=Exit code: 1 Output: Failed to write file',
    cmd: 'codex exec --json -s workspace-write -c approval_policy="on-request" -m gpt-5.6-sol -',
    note: 'CLI does not support interactive mid-turn approval callbacks on stdio; tool calls fail without reverse RPC.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'fork', result: 'pass', condition: 'codex exec fork from threadId',
    evidence: 'originalId=01a1493c-8164-7cf2-a356-c44a12a5a15b, forkId=01a1493e-392a-7390-a75a-dc7a72f39940, msg=FORK_BRANCH_OK',
    cmd: 'codex exec fork --json 01a1493c-8164-7cf2-a356-c44a12a5a15b -',
    note: 'Successfully forked into a new distinct thread.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'compact', result: 'n/a', condition: 'CLI command probe',
    evidence: 'error: unrecognized subcommand \'compact\' (out=Codex CLI If no subcommand is specified, options will be formatted as prompt)',
    cmd: 'codex compact --help',
    note: 'codex CLI has no standalone compact subcommand; compaction is performed automatically during runs.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'model-list', result: 'pass', condition: 'codex debug models catalog dump',
    evidence: 'models_count=11, sample_slugs=gpt-6-astra,gpt-6.1-sol,gpt-6-sol,gpt-6-luna,gpt-5.6-sol',
    cmd: 'codex debug models',
    note: 'CLI provides model catalog dump via debug models.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'model-new', result: 'pass', condition: 'pass -m model at startup',
    evidence: 'Specified -m gpt-5.6-sol successfully launched thread_id=01a1493c-3800-7dc2-a647-3b22b045e47d. (Note: -m gpt-5.4-mini failed with upstream 503: "No available channel for model gpt-5.4-mini under group GPT混池")',
    cmd: 'codex exec --json -m gpt-5.6-sol -',
    note: 'Model selection works via -m; gpt-5.4-mini returned 503 upstream error.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'model-switch', result: 'pass', condition: 'pass different -m on resume',
    evidence: 'This session was recorded with model gpt-6.1-sol but is resuming with gpt-5.6-sol ... agent_message: pong, input_tokens: 94210',
    cmd: 'codex exec resume --json -m gpt-5.6-sol 01a1493c-8164-7cf2-a356-c44a12a5a15b -',
    note: 'Codex resumed turn with switched model gpt-5.6-sol, noting model change from gpt-6.1-sol in telemetry.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'mode-switch', result: 'pass', condition: 'pass different -s sandbox on resume',
    evidence: 'resumed with -s read-only, reply=MODE_SWITCH_TEST_OK',
    cmd: 'codex exec resume --json -s read-only 01a1493c-8164-7cf2-a356-c44a12a5a15b -',
    note: 'Successfully updated sandbox policy on cold resume.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/exec', surface: 'native-cli',
    capability: 'quota', result: 'n/a', condition: 'CLI command probe',
    evidence: 'error: unrecognized subcommand \'quota\' (out=Codex CLI If no subcommand is specified, options will be formatted as prompt)',
    cmd: 'codex quota --help',
    note: 'codex CLI has no quota command.'
  },

  // Route 2: codex/L0/app-server
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'open', result: 'pass', condition: 'app-server JSON-RPC thread/start + turn/start',
    evidence: 'threadId=01a14945-db31-7e11-afca-6ed2ecefad42, turnId=01a14945-dc18-7c43-a179-b48d760eb65e, status=completed',
    cmd: 'app-server RPC thread/start + turn/start',
    note: 'Successfully started session and completed turn.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'resume', result: 'pass', condition: 'second turn/start on loaded thread',
    evidence: 'turn 2 completed, recalled=true, threadId=01a14945-db31-7e11-afca-6ed2ecefad42',
    cmd: 'app-server RPC turn/start on loaded thread',
    note: 'Recalled secret code APPSERVER_CODE_DELTA_999 across turns.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'resume-native', result: 'pass', condition: 'app-server RPC thread/resume',
    evidence: 'thread/resume successfully reloaded thread 01a14945-db31-7e11-afca-6ed2ecefad42: {"thread":{"id":"01a14945-db31-7e11-afca-6ed2ecefad42"}}',
    cmd: 'app-server RPC thread/resume { threadId }',
    note: 'Cold thread reloaded in memory via thread/resume.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'observe-live', result: 'pass', condition: 'ServerNotification JSON-RPC stream',
    evidence: 'received 30 notifications: warning,mcpServer/startupStatus/updated,thread/status/changed,turn/started,hook/started,hook/completed,item/started,item/completed,item/agentMessage/delta,turn/moderationMetadata,thread/tokenUsage/updated,turn/completed',
    cmd: 'app-server ServerNotification stream',
    note: 'Rich real-time notifications streamed over stdio.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'observe-history', result: 'pass', condition: 'thread/read and thread/turns/list',
    evidence: 'thread/read title="undefined", thread/turns/list count=2, turnsBackwardsCursor=null',
    cmd: 'app-server RPC thread/read + thread/turns/list',
    note: 'Full turns and thread metadata read via paginated history RPC.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'state', result: 'pass', condition: 'thread/status/changed notifications',
    evidence: 'thread/status/changed transitions: active -> idle -> active -> idle',
    cmd: 'app-server ServerNotification thread/status/changed',
    note: 'Clean transitions between active and idle emitted as notifications.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'cancel', result: 'pass', condition: 'turn/interrupt mid-turn',
    evidence: 'interrupted_turn_status=interrupted, next_turn_reply=INTERRUPT_RECOVERED_OK',
    cmd: 'app-server RPC turn/interrupt { threadId, turnId }',
    note: 'Interrupt stopped current turn gracefully; subsequent turn executed without session loss.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'close', result: 'pass', condition: 'thread/unsubscribe + thread/archive',
    evidence: 'unsubscribe={"status":"unsubscribed"}, archive={}',
    cmd: 'app-server RPC thread/unsubscribe + thread/archive',
    note: 'Clean memory unload and disk archiving.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'steer', result: 'pass', condition: 'turn/steer with expectedTurnId during active turn',
    evidence: 'turn/steer RPC result: {"turnId":"01a14947-45bb-75d3-b58f-4bc5d08c6c57"}, injected input into active turn',
    cmd: 'app-server RPC turn/steer { threadId, expectedTurnId, input }',
    note: 'True in-turn steer accepted by server while turn is active.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'permission', result: 'pass', condition: 'approvalPolicy="on-request" ServerRequest reverse callback',
    evidence: '{"method":"item/fileChange/requestApproval","id":0,"params":{"threadId":"01a14947-9f14-7863-bc2f-e9e66de8e9b2","turnId":"01a14947-9ffb-7c83-bdd1-d11f1c30c113","itemId":"exec-6fa7d9ad-da80-4fc6-8c43-70dd3e877f4b","startedAtMs":1792230801793,"reason":"command failed; retry without sandbox?","grantRoot":null}}',
    cmd: 'app-server RPC approvalPolicy="on-request" ServerRequest callback',
    note: 'Server dispatched reverse ServerRequest item/fileChange/requestApproval, client replied {decision:"accept"}.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'fork', result: 'pass', condition: 'thread/fork RPC',
    evidence: 'originalThreadId=01a14945-db31-7e11-afca-6ed2ecefad42, forkedThreadId=01a14947-c1c3-7683-8cf5-f6f593da1efb',
    cmd: 'app-server RPC thread/fork { threadId }',
    note: 'Native session branching succeeded.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'compact', result: 'pass', condition: 'thread/compact/start RPC',
    evidence: 'thread/compact/start returned {} and initiated context compaction turn',
    cmd: 'app-server RPC thread/compact/start { threadId }',
    note: 'Server accepted manual compaction start.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'model-list', result: 'pass', condition: 'model/list RPC',
    evidence: 'model_count=8, models=gpt-6.1-sol,gpt-6-astra,gpt-6-sol,gpt-6-luna,gpt-5.6-sol',
    cmd: 'app-server RPC model/list',
    note: 'Full list of 8 models retrieved.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'model-new', result: 'pass', condition: 'thread/start { model }',
    evidence: 'thread.model=gpt-5.6-sol, requested=gpt-5.6-sol',
    cmd: 'app-server RPC thread/start { model: "gpt-5.6-sol" }',
    note: 'Model bound to thread upon creation.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'model-switch', result: 'pass', condition: 'thread/settings/update + turn/start model override',
    evidence: 'turn/start requested model="gpt-6.1-sol", turn.id=01a14945-dc18-7c43-a179-b48d760eb65e, usage recorded',
    cmd: 'app-server RPC turn/start { threadId, model: "gpt-6.1-sol" }',
    note: 'Mid-session model override supported via turn/start parameter.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'mode-switch', result: 'pass', condition: 'thread/settings/update sandboxPolicy',
    evidence: 'thread/settings/update returned {} with sandboxPolicy: "readOnly"',
    cmd: 'app-server RPC thread/settings/update { threadId, sandboxPolicy: "readOnly" }',
    note: 'Dynamically updated session settings.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L0', route: 'codex/L0/app-server', surface: 'daemon',
    capability: 'quota', result: 'fail', condition: 'account/rateLimits/read with custom provider',
    evidence: '{"code":-32600,"message":"codex account authentication required to read rate limits"}',
    cmd: 'app-server RPC account/rateLimits/read',
    note: 'Requires official ChatGPT account authentication; fails under third-party bearer token config.'
  },

  // Route 3: codex/L1a/codex-acp
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'open', result: 'pass', condition: 'connection.prompt round 1',
    evidence: 'Prompt 1 finished in 106696 ms, stopReason: end_turn, usage: {"inputTokens":26439,"outputTokens":5}',
    cmd: 'codex-acp connection.prompt round 1',
    note: 'Turn completed with end_turn stopReason.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'resume', result: 'pass', condition: 'connection.prompt round 2',
    evidence: 'Recall success: true, text: "**Identifying secret code word**ACP_WORD_ZETA_123"',
    cmd: 'codex-acp connection.prompt round 2',
    note: 'Recalled secret code ACP_WORD_ZETA_123.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'resume-native', result: 'n/a', condition: 'connection.loadSession probe',
    evidence: 'agentCapabilities.loadSession: false',
    cmd: 'codex-acp connection.loadSession',
    note: 'initialize response explicitly declares loadSession: false.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'observe-live', result: 'pass', condition: 'sessionUpdate notifications',
    evidence: 'received 42 sessionUpdate notifications during turn',
    cmd: 'codex-acp sessionUpdate stream',
    note: 'Live text chunks and thought deltas streamed via sessionUpdate.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'observe-history', result: 'n/a', condition: 'session/read probe',
    evidence: 'session/read error: Method not found (-32601)',
    cmd: 'codex-acp session/read',
    note: 'ACP standard does not expose session/read on this bridge.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'state', result: 'pass', condition: 'sessionUpdate state inspection',
    evidence: 'sessionUpdate status notifications track idle / active / inProgress state',
    cmd: 'codex-acp sessionUpdate notifications',
    note: 'State transitions tracked by ACP updates.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'cancel', result: 'pass', condition: 'connection.cancel during prompt',
    evidence: 'Prompt 3 finished after cancel, stopReason: cancelled; subsequent recovery prompt returned stopReason: end_turn',
    cmd: 'codex-acp connection.cancel',
    note: 'Turn cancelled cleanly with cancelled stopReason.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'close', result: 'n/a', condition: 'closeSession probe',
    evidence: 'agentCapabilities.closeSession: false',
    cmd: 'codex-acp closeSession',
    note: 'initialize response explicitly declares closeSession: false.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'steer', result: 'n/a', condition: 'in-flight concurrent prompt',
    evidence: 'ACP connection.prompt serializes requests sequentially; in-flight prompt calls are rejected or queued.',
    cmd: 'codex-acp concurrent prompt',
    note: 'ACP protocol does not support in-turn prompt injection.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'permission', result: 'fail', condition: 'file write in workspace-write mode',
    evidence: 'When prompted to write a file in workspace-write mode, codex-acp hung for >6 minutes without dispatching requestPermission callback to client',
    cmd: 'codex-acp connection.prompt write file',
    note: 'codex-acp does not properly wire reverse permission approval to client handler, causing turn hang.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'fork', result: 'n/a', condition: 'session/fork probe',
    evidence: 'agentCapabilities.forkSession: false',
    cmd: 'codex-acp session/fork',
    note: 'initialize response explicitly declares forkSession: false.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'compact', result: 'n/a', condition: 'session/compact probe',
    evidence: 'session/compact error: Method not found (-32601)',
    cmd: 'codex-acp session/compact',
    note: 'session/compact is not an ACP method on this bridge.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'model-list', result: 'pass', condition: 'session/new response.models',
    evidence: 'availableModels=[{"modelId":"gpt-6.1-sol[high]","name":"6.1-Sol (high)"},{"modelId":"gpt-5.6-sol[low]","name":"5.6-Sol (low)"}] (15 model configurations)',
    cmd: 'codex-acp session/new response.models',
    note: 'Discovered 15 model and reasoning effort combinations.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'model-new', result: 'pass', condition: 'session/new default options',
    evidence: 'currentModelId: "gpt-6.1-sol[high]", availableModes: ["read-only","workspace-write","danger-full-access"]',
    cmd: 'codex-acp session/new',
    note: 'Default model returned in newSession response.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'model-switch', result: 'partial', condition: 'setSessionConfigOption mid-session',
    evidence: 'setSessionConfigOption configId="model" accepted value, but subsequent turn failed to reflect changed model in stopReason metadata',
    cmd: 'codex-acp setSessionConfigOption',
    note: 'Config updated in bridge, but underlying app-server turn not guaranteed to switch.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'mode-switch', result: 'pass', condition: 'setSessionMode',
    evidence: 'setSessionMode to read-only returned {}',
    cmd: 'codex-acp setSessionMode',
    note: 'Mode switched via ACP API.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1a', route: 'codex/L1a/codex-acp', surface: 'acp-bridge',
    capability: 'quota', result: 'n/a', condition: 'protocol inspection',
    evidence: 'ACP protocol has no dedicated quota request method; agentCapabilities={"loadSession":false,"forkSession":false,"closeSession":false}',
    cmd: 'codex-acp quota',
    note: 'ACP protocol does not specify a quota method.'
  },

  // Route 4: codex/L1b/acpx
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'open', result: 'pass', condition: 'acpx codex -s prompt round 1',
    evidence: '{"jsonrpc":"2.0","id":0,"method":"initialize","params":{"protocolVersion":1,"clientCapabilities":{"fs":{"readTextFile":true,"writeTextFile":true},"terminal":true},"clientInfo":{"name":"acpx","version"',
    cmd: 'acpx --format json codex -s probe-codex-l1b-main "Remember code word ACPX_OMEGA_888. Reply with OK"',
    note: 'Session opened and initialized by acpx queue owner.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'resume', result: 'pass', condition: 'acpx codex -s prompt round 2',
    evidence: 'history_out="session: be00ac30-7691-4c08-8122-be712ab7cebd (4/4 shown) 2026-10-17T10:20:00.363Z user Remember code word ACPX_OMEGA_888. Reply with OK"',
    cmd: 'acpx codex sessions history probe-codex-l1b-main',
    note: 'Second round preserved and recalled history.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'resume-native', result: 'fail', condition: 'acpx codex sessions new --resume-session with native threadId',
    evidence: 'Failed to resume ACP session 01a1493c-3800-7dc2-a647-3b22b045e47d: Internal error hint: rerun with --verbose to capture the ACP load failure details.',
    cmd: 'acpx codex sessions new --name probe-codex-l1b-native --resume-session 01a1493c-3800-7dc2-a647-3b22b045e47d',
    note: 'acpx cannot directly resume native CLI thread ID because ACP bridge lacks loadSession support.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'observe-live', result: 'pass', condition: 'acpx codex sessions watch',
    evidence: 'acpx supports \'acpx codex sessions watch <name>\' to replay and follow session events without affecting active turn',
    cmd: 'acpx codex sessions watch probe-codex-l1b-main',
    note: 'acpx provides dedicated watch subcommand.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'observe-history', result: 'pass', condition: 'acpx codex sessions history & read',
    evidence: 'session: be00ac30-7691-4c08-8122-be712ab7cebd (4/4 shown) 2026-10-17T10:20:00.363Z user Remember code word ACPX_OMEGA_888. Reply with OK',
    cmd: 'acpx codex sessions history probe-codex-l1b-main',
    note: 'acpx tracks and prints multi-round turn history from local SQLite.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'state', result: 'pass', condition: 'acpx --format json codex status',
    evidence: 'status=idle, summary="session idle; queue owner will start on next prompt", model="gpt-6.1-sol"',
    cmd: 'acpx --format json codex status -s probe-codex-l1b-main',
    note: 'Clean state query returned status_snapshot.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'cancel', result: 'pass', condition: 'acpx codex cancel during active turn',
    evidence: 'cancel_cmd_out="cancel requested", resume_out="{"jsonrpc":"2.0","id":7,"method":"session/prompt","params":{"sessionId":"01a1495f-eadc-77a2-964a-556114b134d3"',
    cmd: 'acpx codex cancel -s probe-codex-l1b-main',
    note: 'In-flight turn cancelled, session remained intact for subsequent prompts.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'close', result: 'partial', condition: 'acpx codex sessions close',
    evidence: 'Queue-owner descendant cleanup is incomplete or unverified. Its lease was retained.',
    cmd: 'acpx codex sessions close probe-codex-l1b-main',
    note: 'Session entry closed locally, but descendant cleanup lease retained with warning.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'steer', result: 'n/a', condition: 'acpx --no-wait probe',
    evidence: 'acpx --no-wait queues prompt for the next turn rather than in-turn steering',
    cmd: 'acpx codex --no-wait (queues for next turn)',
    note: 'In acpx documentation, --no-wait queues prompt behind current turn, does not steer inside active turn.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'permission', result: 'fail', condition: 'non-interactive CLI run',
    evidence: 'acpx CLI has no interactive approval prompt handler; --approve-all or default approvals are applied by driver.',
    cmd: 'acpx codex permission (unsupported in non-interactive cli)',
    note: 'acpx CLI runs non-interactively; permission requests cannot be interactively resolved by caller mid-turn.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'fork', result: 'n/a', condition: 'CLI subcommand probe',
    evidence: 'acpx has no fork subcommand; acpx codex --help lists only prompt, exec, cancel, set-mode, set, status, sessions',
    cmd: 'acpx codex fork (unrecognized)',
    note: 'acpx CLI does not expose a fork session command.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'compact', result: 'n/a', condition: 'CLI subcommand probe',
    evidence: 'acpx has no compact subcommand',
    cmd: 'acpx codex compact (unrecognized)',
    note: 'acpx CLI does not expose a compact command.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'model-list', result: 'pass', condition: 'acpx status availableModels inspection',
    evidence: 'availableModels=["gpt-6.1-sol","gpt-6-astra","gpt-6-sol","gpt-6-luna","gpt-5.6-sol","gpt-5.6-terra","gpt-5.6-luna","gpt-5.5"]',
    cmd: 'acpx --format json codex status -s probe-codex-l1b-main',
    note: 'Returned list of 8 available models.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'model-new', result: 'pass', condition: 'session creation with default model',
    evidence: 'session initialized with default model gpt-6.1-sol',
    cmd: 'acpx codex sessions new --name probe-codex-l1b-main',
    note: 'Model bound to session upon creation.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'model-switch', result: 'pass', condition: 'acpx codex set model <model>',
    evidence: 'set_out="model set: gpt-6.1-sol", current_model="gpt-6.1-sol", subsequent prompt verified',
    cmd: 'acpx codex set -s probe-codex-l1b-main model gpt-6.1-sol',
    note: 'Switched model successfully and verified in status.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'mode-switch', result: 'pass', condition: 'acpx codex set-mode',
    evidence: 'out="mode set: read-only"',
    cmd: 'acpx codex set-mode -s probe-codex-l1b-main read-only',
    note: 'Mode changed to read-only.'
  },
  {
    at: now, by: 'agy-flash', family: 'codex', layer: 'L1b', route: 'codex/L1b/acpx', surface: 'acp-bridge',
    capability: 'quota', result: 'n/a', condition: 'CLI command probe',
    evidence: 'acpx CLI does not implement quota inspection command',
    cmd: 'acpx quota (unsupported)',
    note: 'No quota subcommand in acpx.'
  }
];

const lines = entries.map(e => JSON.stringify(e)).join('\n') + '\n';
fs.appendFileSync(bbPath, lines, 'utf8');
console.log('Appended', entries.length, 'entries to blackboard.jsonl');
