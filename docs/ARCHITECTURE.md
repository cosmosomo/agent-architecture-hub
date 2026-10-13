# Architecture

Agent Architecture Hub is a debugger for written orchestration. It has one spine and everything else hangs off it:

```mermaid
flowchart LR
  subgraph sources["sources — turn something into a definition"]
    docs["case documents<br/>.md folders"]
    graph["hub-graph<br/>.json"]
    sim["built-in sample teams"]
    sess["local sessions<br/>(/api)"]
  end
  facts["facts providers<br/>simulated · recorded traces"]
  model["unified model<br/>definition | facts | analysis"]
  state["observation state<br/>HUB.store"]
  scene["scene builders<br/>(pure functions)"]
  stage["stage + layers<br/>one canvas"]
  panels["panels, side pages,<br/>status bar"]

  docs --> model
  graph --> model
  sim --> model
  sess --> model
  facts --> model
  model --> state
  state --> scene --> stage
  state --> panels
  stage -. "select, open, drag" .-> state
  panels -. "act" .-> model
```

Three ideas carry the design:

1. **Definition and facts are two axes.** A *source* builds the definition — what the collaboration is written to be. The facts — what happened — come from a *facts provider*, chosen independently (a simulation, a recorded trace, a session log). The analysis, a third layer, is computed from the two and is what the health check and the comparison read. Nothing in a view invents a number.
2. **The page knows only the model.** Parsers sit in front of it (`js/sources/`), the canvas behind it (`js/obs/`). A new kind of input is a parser; a new kind of picture is a renderer; neither touches the other.
3. **The state is the address.** What you are looking at — case, subject, granularity, focus, time cut, comparison, lines, selection — is one small object (`HUB.store`), mirrored into the URL hash. A scene is a pure function of (model, state, analysis, viewport), so a link reproduces the picture.

## The three abstractions

The model describes a collaboration with three things and the lines between them:

- **information** — documents with an audience and a layer (consensus, private, map), what each individual should know;
- **agents** — the *individuals* (agents, the human, the channel maintainer), grouped into departments and groups, each with a role, a trigger, a view of whom it watches;
- **capability channels** — what the individuals call on: model channels, tool channels, function channels (an outside capability with an owner and a session), with a concurrency limit, a quota, a tier (`basic`, `shared`, `native`).

Lines are of four types — `task` (dispatch, deliver, roundtrip, report), `info` (reads the output of), `watch`, `channel` (uses, maintains). On top of that sits the **process**: stages with steps, and gates (decided by a rule, an agent or the human) with pass / fail / escalate exits.

## Layers of the system

| Layer | What it is | Where |
|---|---|---|
| fixed | the model, the analysis, the observation state, the views, the renderers | `hub/js/core`, `hub/js/obs`, `hub/js/shell` |
| per task | the orchestration documents of one team | `hub/cases/<case>/` |
| per source | adapters that turn some system's output into the model or the session contract | `hub/js/sources`, `trace/packages/adapters` |

## Directory map

```text
index.html            the page: a skeleton the modules fill in; also the one list of scripts and their order
hub/
  data/
    base.js           the built-in agent catalogue, the 62 sample teams (nodes, edges), lookup tables
    zh.js             Chinese names and one-line descriptions of those
    icons.js          pictograms and colours of the built-in agents and teams
    world.js          the stages, model limits and function channels the sample teams are placed in
    sim-text.js       the simulator's decision texts
  js/core/            util (helpers, event bus) · store · analysis · model · catalog · facts · views · collab · to-trace
  js/sources/         casedef (sample team → definition) · sim · from-docs · from-hub-graph · from-traces · from-trace
  js/shell/           camera (pan, zoom, fit) · shell (sidebar tabs, toast, theme, starfield)
  js/obs/             main (the controller) · stage · scene-org · scene-process · cards · avatar · drag ·
                      side · presets · sessions · panel · panels · timeline · guide · trace · collab
  css/                shell (the base look) · obs · panels · collab
  tools/              node checks: they load the same scripts as the page, in the order index.html lists them
  vendor/hub-trace.js the Trace view as one script (built from trace/apps/viewer)
  cases/              the cases; cases/_reference/ is the shelved corpus (not in the repository)
trace/                npm workspace: contract · adapters · otel · cli (the service) · viewer
concept/              the standalone concept board
docs/                 this file, hub-graph-format.md, orchestration-granularity.md, parsing-design.md (a design, not built), ROADMAP.md (what comes next)
```

Scripts are classic IIFEs that hang one object on `window.HUB`; there is no bundler for the page. `index.html` lists them in load order, and `hub/tools/load.js` reads that same list (`pageScripts`), so the node checks and the browser can never disagree about the order.

## The unified model (`HUB.model.current`)

```text
model
  id, name, summary, source {kind}, factSource {kind, ...}, synthetic, clock, cmp, rev
  def     individuals, groups, relations, channels, docs, process {stages, gates, flows}, versions
  facts   cases, tasks, runs, decisions, calls, handoffs, deliveries, turns,
          gateEvents, channelEvents, versionEvents, actions, messages
  idx     Maps by id and by relation (runsByInd, handoffsByCase, membersDeep, ...)
```

- `HUB.model.addSource({id, owns, build | load})` — a source says which ids it owns and builds (or loads, asynchronously) a model. The built-in ones: `sim` (sample teams), `docs` (case folders), `graph` (hub-graph files), `sessions` (a real session or a tree of sub-agents from the local service).
- `HUB.facts.register(provider)` — a source never decides its facts. When its definition is built it calls `HUB.facts.provide(model, ctx)`: the **baseline** provider (the simulator) always answers; **recorded** providers (`applies(model, ctx)`) replace it when the case brings a record (a `traces/` folder).
- `model.cmp` says how far definition and facts can be compared (`full`, `written`, `none`); the wording of every finding that depends on it comes from `HUB.util.cmpWord`.
- `model.clock` says how times are read: `null` (a simulated clock: day 1, 09:42), a number (the real start time of a session; times are real dates) or `'ordinal'` (a record with only an order: the *n*-th record, not a time).
- `HUB.model.an(state, model)` is the analysis, cached per time cut: per-individual / group / relation / step / gate / channel statistics, `factOnly` handoffs, `unusedRelations`, `neverDispatched`, the health findings, what needs a person.
- `HUB.model.perform(kind, ...)` is how the page acts (talk, interject, urge, reassign, redeliver, edit the rules, pause a channel, approve). Each action is recorded as a fact, the analysis is recomputed, the page refreshes.

## Finding cases: the catalog

`HUB.catalog` walks the directory listings the service serves under `/hub/cases/` and finds what is there; **nothing is registered**. What an entry *is* is decided by recognizers — a folder with a `meta.md` is a Markdown case, a `.json` is a hub-graph — and a source that loads that kind registers a recognizer next to its `addSource`. A new kind of local input is one `HUB.catalog.recognize` and one `HUB.model.addSource`.

A folder whose name starts with `_` is a shelf: listed closed, read when opened, skipped by the default checks (`--all` includes it). A folder with very many sub-folders is taken to hold one kind of thing, so only its first sub-folder is classified.

## The Markdown orchestration protocol

Case documents are parsed by `js/sources/from-docs.js`; the page never reads Markdown directly. A document opens with a frontmatter (`hub: "1.0"`, `kind`, `case`); objects are `# @id [type] #tag` followed by `key: value` lines and lists; tags are `namespace/value`. Unknown fields are not dropped: they are kept and shown as raw fields in the details. [hub-graph-format.md](hub-graph-format.md) specifies the JSON form of the same model and the extension rules (unknown types degrade, versions migrate in the parser).

## Observation state and views

`HUB.store` holds the state, its history (back / forward), the URL hash codec and `subscribe(fn)`. `HUB.views` are *presets of the state*: registering `{id, name, question, apply(state, model) → patch, test(state)}` makes a button appear in the top bar. The registered views are ① the full collaboration, ② departments, ③ one case's route, ④ the business process, and the collaboration trajectory (`T`). A saved "my view" is a state snapshot in `localStorage`.

## Scenes, renderers and the canvas

A **scene** is `{subject, cards, frames, links, bbox, ...}` — positions and what to draw, no DOM. `HUB.render.register(subject, renderer)` is the registry; a renderer has a `scene(model, state, analysis, view)` function (the stage draws it), a `layer {mount(ctx), render(state, model)}` (it owns an element on the canvas), or both.

| Subject | Renderer | What it draws |
|---|---|---|
| `org` | `scene-org.js` | departments, groups and individuals in tiers, the capability layer below, the four line types |
| `process` | `scene-process.js` | stages, steps, gates and the flows between them |
| `exec` | `trace.js` (layer) | one run's decisions and calls, drawn by the Trace view |
| `collab` | `collab.js` (layer) | the trajectory of one case instance, record by record |

`HUB.obsStage` draws a scene: elements are keyed (`i:<individual>`, `g:<folded group>`, `b:<open group's frame>`, `c:<channel>`, ...), reused between scenes and tweened from where they were; new ones grow from the first old position their `anchor` names, removed ones shrink into theirs. `HUB.camera` (pan, zoom, fit) moves the whole world. `HUB.obsDrag` keeps hand-made moves as offsets on top of the computed layout. Card HTML is registered per `kind` in `cards.js` (`HUB.obsCards.extra`, `extraFrame`) — a new kind of node is one template.

## The sessions workspace (`trace/`)

An npm workspace in TypeScript, run directly by Node (type stripping, no build step for the service).

- `packages/contract` — the session contract (steps, turns, sessions) and its validators; the overview and statistics folds.
- `packages/adapters` — one `SourceAdapter` per agent CLI (Codex, Claude Code, OpenCode, Gemini CLI, Factory, ZCode): `matchFile`, `createParser` / `parseBundle`; pure functions that never touch the file system. A shared `TurnBuilder` does what all of them need (open a turn, pair tool calls with results, close, fold statistics, mask secrets).
- `packages/otel` — the OpenTelemetry (OTLP) export of a session.
- `apps/cli` — the service (`serve`: page, `/api`, `/trace/`) and the command line (`scan`, `list`, `show`, `index`); a search index over every step.
- `apps/viewer` — the Trace viewer (React), also built as one script, `hub/vendor/hub-trace.js`, that the observatory embeds.

`js/sources/from-trace.js` and `js/core/to-trace.js` are the two directions between a session and the unified model, so a real multi-agent run is drawn by the same views as a written one. `js/core/annotate.js` turns the decision records a case writes over a session (`turn`, `steps`, a root session in `meta.md`) into the contract's annotation set, the coarse-grained layer the Trace view draws over the session's own steps.

## Checks

```bash
npm test               # node checks (below) + the workspace tests
npm run typecheck      # tsc over trace/ and the viewer
node hub/tools/test_model.js     # every sample team builds a model with a sane analysis
node hub/tools/test_scenes.js    # every team, many states: finite geometry, links end at drawn things, no overlaps, drag
node hub/tools/check_from_docs.js [--all]   # case documents parse and assemble
node hub/tools/check_collab.js [--all]      # the trajectory view's data, for every case with a record
node hub/tools/check_escape.js              # a hostile case document stays text: no tag of its own in any drawn or rendered markup
node hub/tools/check_shells.js [--all]      # case documents -> what is drawn: no empty frames, faceless cards, broken text; counts unconnected nodes
```

`--all` includes the shelved reference corpus. The checks load the page's scripts in a `vm` context (no DOM), so they run in CI without a browser.

## Extension points, in one place

| Add | Do |
|---|---|
| a kind of case on disk | `HUB.catalog.recognize(kind, test, title)` + `HUB.model.addSource(...)` |
| a way to get facts | `HUB.facts.register({id, applies, provide})` |
| a view (a preset of the state) | `HUB.views.register(...)` |
| a subject, or a picture of your own | `HUB.render.register(subject, {scene | layer})` |
| a kind of card | a template in `HUB.obsCards.extra` / `extraFrame` |
| a trace-reader for a recorded dataset | an entry in `HUB.fromTraces.readers`, matched on the case's `source:` |
| a log format of another agent CLI | a `SourceAdapter` in `trace/packages/adapters`, added to `ADAPTERS` |
| a built-in sample team | a node/edge list in `hub/data/base.js` and its names in `zh.js` |

## Security model

The service is local by construction: it binds `127.0.0.1`, checks the `Host` header against its own address, sends no CORS headers, allows only `GET`/`HEAD`, serves a fixed set of paths (the page, `/hub/`, `/concept/`, `/trace/`, `/api/`), confines static files to their directory and rejects traversal (including encoded). Sessions never leave the machine; the parser masks secret-like strings. The page carries a Content-Security-Policy that allows only its own scripts and Google Fonts for typefaces.
