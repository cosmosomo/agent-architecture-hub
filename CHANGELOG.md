# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [Semantic Versioning](https://semver.org/). Before 1.0, a minor version may change file formats or APIs.

## [0.4.0] - 2026-10-13

First release as an independent project.

### Added

- **One service.** The page, the sessions API and the Trace viewer are served by one process (`npm start`, default `127.0.0.1:8899`); when the port is taken the next free one is used, `--open` opens the browser, and the page says so when it was not loaded from the service.
- **Automatic parsing.** Cases under `hub/cases/` are discovered by recognizers, with no registry: Markdown orchestration documents, hub-graph JSON, recorded traces (a reader chosen by the case's `source:`), and local sessions of Codex, Claude Code, OpenCode, Gemini CLI, Factory and ZCode. Unknown fields are kept and shown as raw fields.
- **Observation panels.** Four views (full collaboration, departments, case route, business process) and the collaboration trajectory; run detail; sidebar pages for sample teams, the case catalog, structure, health and sessions; the details pane with its actions; nine-panel presentation; time strip with replay; saved views; light and dark themes.
- **Sessions in the case documents.** An individual can name the sessions it ran as (`session:` / `sessions:`). A case can name its root session and write a decision chain over a real session (`turn`, `steps`) as a coarse-grained diary; what does not match the session is left out and listed with the reason.
- **Trace viewer and observatory open each other** at the same session and step.
- **Dragging.** Cards and department frames move by hand; the offsets are kept per case in the browser.
- **Checks.** `check_escape.js` feeds the parser a case made of HTML and fails if any drawn or rendered markup keeps a tag of its own; `check_shells.js` draws every case and counts empty frames, nameless cards, broken text and unconnected nodes; CI runs the node checks, the workspace tests, the typecheck and the build.
- **Documentation.** README (English and 简体中文), architecture, the hub-graph format, a design for LLM-assisted parsing, and a roadmap.
- The original sample page is kept, in Chinese, as the concept board at `/concept/`.

### Changed

- The page is the project's own: a small `index.html`, its own camera, tabs, theme and stylesheet, instead of a layer over another project's page.
- Departments read in tiers; the height of the capability layer counts when the rows are chosen; built-in sample teams open as a plain definition.
- Renderers register by subject; the built-in tables (stages, model limits, simulator texts) are data files; one line-ending rule for the whole repository.

### Fixed

- The text next to a row in the details pane (for example the executors of a stage) was not escaped: a case document could put markup there. It is escaped in one place now, and `check_escape.js` guards it. The page's Content-Security-Policy already blocked script from running.
- A group naming an undefined member no longer stops the case from being drawn.
- A stage without steps is a card, not an empty frame; a card drawn in a frame is anchored to that frame.
- `/trace/` on a plain static server no longer looks like a broken viewer: the page tells you the service is missing.

### Removed

- The material of the project this one grew out of (research notes, agent and command bundles, the plugin manifest and generators, old versions, the install guide, the Pages workflow). It is in the tag `archive/pre-release-20261013`; `git checkout archive/pre-release-20261013 -- <path>` brings any of it back.

[0.4.0]: https://github.com/cosmosomo/agent-architecture-hub/releases/tag/v0.4.0
