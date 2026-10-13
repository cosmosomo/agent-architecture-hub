# Contributing

Thank you for looking at the project. Issues and pull requests are welcome, in English or 中文.

## Set up

Node.js 24 or newer.

```bash
npm run setup     # installs the workspace dependencies and builds the Trace viewer
npm start         # the observatory on http://127.0.0.1:8899/
```

The page has no build step: it is classic scripts listed in `index.html`, served as they are. Edit a file under `hub/` and reload. Changes under `trace/apps/viewer` need `npm run build`.

## Before you open a pull request

```bash
npm test             # node checks of the model and scenes, case documents, drawn cases, and the workspace tests
npm run typecheck    # TypeScript for trace/ and the viewer
```

CI runs the same, plus the build. A change that touches parsing should also pass `node hub/tools/check_shells.js` (and `--all` when you have the reference corpus).

## How the code is organised

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) first. In short:

- `hub/js/core` is the model, `hub/js/sources` the parsers, `hub/js/obs` the canvas and panels, `hub/js/shell` the page around them. The page only knows the model; parsers and renderers never know each other.
- Every seam is a registry (`HUB.catalog.recognize`, `HUB.model.addSource`, `HUB.facts.register`, `HUB.views.register`, `HUB.render.register`, `HUB.fromTraces.readers`). A new kind of input or picture is a registration, not a patch to existing code.
- `trace/` is the sessions workspace in TypeScript. Adapters are pure functions of file contents; they never read the file system.

## Conventions

- Match the surrounding code: classic scripts, one IIFE per file that hangs one object on `window.HUB`; no new dependency without a strong reason.
- Do not draw what is not there: no empty frames, no handoff inferred from who spoke next, no zero where nothing was measured (write 未采集). `check_shells.js` exists to catch the first kind.
- A parser keeps what it does not understand (it appears as raw fields) instead of dropping it.
- Tests that need real agent sessions use hand-made fixtures. Never commit a real session, a transcript or a path from your machine.
- Commit messages: `area: what changed and why`, in the imperative. One logical change per commit.

## Adding a case

A folder under `hub/cases/` with a `meta.md`; see "Writing a case" in the [README](README.md) and [docs/hub-graph-format.md](docs/hub-graph-format.md). Small, hand-written cases are welcome. Machine-written corpora belong in `hub/cases/_reference/`, which is not part of the repository.

## Reporting a security problem

Please do not open a public issue; see [SECURITY.md](SECURITY.md).
