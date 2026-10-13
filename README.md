# Agent Architecture Hub

**Write your multi-agent team down. Then watch what it actually does.**

English | [简体中文](README.zh-CN.md)

Most multi-agent setups live in prompts and in people's heads. Hub gives the orchestration a home as plain Markdown — who is on the team, who answers to whom, what the process is, which tools and models each one gets — and then holds it up against reality: a recorded run, or a real Codex / Claude Code session on your machine. Where the two disagree, you can see it.

![A team, drawn from a handful of Markdown files](docs/img/overview.jpg)

## Why you might want it

Multi-agent systems drift. The plan says the reviewer reads the researcher's output; in the runs, the builder just asks the researcher. There is a quality gate nobody ever fails. An agent is defined and never gets any work. When the orchestration is scattered across prompts, none of this shows.

Hub treats the orchestration as a real, *written* thing — documents you can read, diff and review — and compares it with facts. Every difference becomes a finding: a line that was never used, a handoff no document declares, a document that never reached the agent who needed it.

## A short tour

Everything below is a screenshot of the small sample cases that ship in `hub/cases/` — nothing mocked up. (The trajectory is a real failure recorded in a public dataset, Who&When; those cases are kept outside the repository.)

**It starts as a folder of Markdown.** The picture above is `hub/cases/feature_sprint/`: a few files saying who is on the team, how they are grouped and what the process is. Departments fold into one card and open into their members; click anyone to see their role, whom they watch and which documents they should have received.

<table>
<tr>
<td width="50%"><img src="docs/img/route.jpg" alt="One case instance's route, lit up in gold"><br><b>Follow one piece of work.</b> Pick a case instance and the path it really took lights up in gold, handoffs numbered; everything it never touched fades back.</td>
<td width="50%"><img src="docs/img/health.jpg" alt="Written against what happened, and the health list"><br><b>See where the plan and the facts part ways.</b> Solid: written and happened. Dashed: written, never used. Orange: happened, written nowhere. The health tab turns that into a to-do list.</td>
</tr>
<tr>
<td width="50%"><img src="docs/img/run.jpg" alt="The decisions of one run, as a tree, with input and output"><br><b>Go down to a single decision.</b> Double-click an agent: what it decided, what it weighed, what it called, with the real input and output next to it.</td>
<td width="50%"><img src="docs/img/trajectory.jpg" alt="The trajectory of a recorded failed run, record by record"><br><b>Replay a run record by record.</b> A recorded failure, who handed what to whom, the step the dataset marks as the mistake flagged. Nothing is drawn that the record does not support.</td>
</tr>
<tr>
<td width="50%"><img src="docs/img/process.jpg" alt="The business process with its gates"><br><b>Read the process, not just the org chart.</b> Stages, gates, who judges each gate, where work is sent back or escalated to a person.</td>
<td width="50%"><img src="docs/img/light.jpg" alt="The light theme"><br><b>Light or dark.</b> Both are first-class; the page follows whichever you pick and remembers it.</td>
</tr>
</table>

## Little things that turn out to matter

- **Honest about what it knows.** Simulated facts are labelled as simulated wherever they show. A handoff is drawn only when a record says it happened, never guessed from "B spoke after A". What nobody measured says 未采集 instead of showing a zero.
- **Your sessions stay yours.** Codex, Claude Code, OpenCode, Gemini CLI, Factory and ZCode sessions are read on your machine, parsed into one contract, searchable step by step, and never uploaded. Secret-looking strings are masked on the way in.
- **A link is a view.** Case, view, granularity, time cut, selection — all of it lives in the address bar, so you can send someone exactly what you are looking at.
- **You can move things.** Drag cards and department titles; the page remembers it per case, and one button puts everything back.
- **One command.** `npm start` brings up the page, the sessions API and the Trace viewer together. If the port is taken, it picks the next one and tells you.
- **Built to grow.** Every seam is a registry: a new kind of case on disk, a new source of facts, a new view, a new picture on the canvas is one registration, not a patch.
- **It tests itself on a lot of cases.** A check can draw every case it is pointed at — 1,141 machine-written ones in the author's corpus — and counts empty frames, nameless cards and broken text. That is how the page learned never to draw an empty shell.

## Quick start

Needs Node.js 24 or newer.

```bash
npm run setup     # once: installs the dependencies and builds the Trace viewer
npm start         # the whole observatory on http://127.0.0.1:8899/
```

On Windows, `start.bat` does both and opens the browser. `npm start -- --port 9000` picks another port.

There is one service and one address: the page, the sessions API and the Trace viewer (`/trace/`) come from the same process, so they are always up together. The page is not meant to be opened from disk or from a static host — it reads its cases from the service, and says so when it cannot reach one.

Keys: `1`–`4` and `T` switch views, `F` fits the window, `?` explains everything on the page. The granularity (department / group / individual) and the comparison (*definition* / *both* / *facts*) are separate controls, so switching a view changes one or two things and the cards move in place.

## Write a case

A case is a folder under `hub/cases/` with a `meta.md` in it. Drop it there and it appears in the **目录** tab — nothing to register.

```text
hub/cases/demo_minimal/
  meta.md      the title and one paragraph
  agents.md    who is in the team
  groups.md    how they are grouped
  process.md   stages and gates
  relations.md, docs.md, scenarios.md, decisions/<agent>.md    (all optional)
```

`agents.md` of the smallest example:

```markdown
---
hub: "1.0"
kind: agents
case: demo_minimal
---

# @worker [individual] #phase/build #role/engineer #hub
name: 执行者
model: claude-sonnet-5-5
role: 按清单把活干完并交付
trigger: 分派任务后启动

# @checker [individual] #phase/qa #role/reviewer
name: 把关者
role: 检查交付是否符合清单，不合格打回
watches: [worker]
```

`# @id [type] #tag` opens an object, `key: value` lines describe it. The page shows as much as it can parse; a document that is only half understood is drawn as far as it goes, and the rest shows up under *raw fields* in the details. A `.json` file in `hub/cases/` in [hub-graph format](docs/hub-graph-format.md) is a case too, and so is any other kind of entry that has a recognizer.

A folder whose name starts with an underscore is a **shelf**: it is listed closed and read only when you open it. That is where machine-written reference cases belong (see `hub/cases/_reference/README.md`); they are not part of the repository.

## Where the facts come from

| Source | What it is |
|---|---|
| Simulated | A deterministic simulation of the written orchestration, labelled *模拟数据* everywhere it shows. The 62 built-in sample teams and cases without records use it. |
| Recorded traces | A `traces/` folder inside a case, read by the reader that matches the case's `source:`. Definition and facts are then independent, so the comparison means something. |
| Local sessions | Codex, Claude Code, OpenCode, Gemini CLI, Factory and ZCode sessions found on your machine, parsed locally into one contract and shown in the **会话** tab and in the Trace viewer (list, call tree, full-text search, statistics). Read-only. Nothing leaves your machine. |

## Extending it

Every seam is a registry, so a new kind of thing is one registration, not a patch:

| To add… | Register… |
|---|---|
| a kind of case on disk | a recognizer (`HUB.catalog.recognize`) and a source (`HUB.model.addSource`) |
| a source of facts | a provider (`HUB.facts.register`) |
| a view | `HUB.views.register` |
| a subject the stage can draw, or a layer of its own | `HUB.render.register` |
| a kind of agent-session log | a `SourceAdapter` in `trace/packages/adapters` |

[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) explains the pieces; [docs/hub-graph-format.md](docs/hub-graph-format.md) specifies the JSON format (in Chinese).

## Security and privacy

- The service listens on `127.0.0.1` only and refuses requests whose `Host` is not its own address (DNS-rebinding guard); it sends no CORS headers, so other sites in your browser cannot read your sessions.
- It is read-only: only `GET`/`HEAD`, static files confined to `hub/`, path traversal rejected (also when encoded twice).
- Sessions are parsed on your machine; the index is cached under `~/.agent-hub/trace` (`HUB_TRACE_HOME` changes it). Secret-looking strings in tool inputs and outputs are masked while parsing.
- The page ships a Content-Security-Policy (`self`, plus Google Fonts for the typefaces). Without network access the page falls back to system fonts.

## Repository layout

```text
index.html          the page
hub/
  js/core/          the model: store, analysis, views, catalog, facts providers
  js/sources/       parsers: the case documents, hub-graph, recorded traces, sessions, the simulator
  js/shell/         the page around the canvas: camera, tabs, theme
  js/obs/           the canvas and the panels: scenes, cards, controls, side pages
  css/, data/       styles; the built-in agents, sample teams and texts
  cases/            the cases (the reference corpus, when you have it, is in cases/_reference/)
  tools/            node checks that run the whole model without a browser
  vendor/           the Trace view as one script (built from trace/apps/viewer)
trace/              the sessions workspace: contract, adapters, OpenTelemetry export, the service, the Trace viewer
concept/            the concept board: a standalone drag-and-drop designer for teams (own data), at /concept/
docs/               architecture, specification, formats
```

`npm test` runs the node checks and the workspace tests; `npm run typecheck` checks the TypeScript.

## Concept board

`/concept/` is the hand-built team board this project grew out of: a single self-contained HTML page for composing a team of agents by dragging, with its own agent and team catalogue. It is the Chinese-localized page, kept as it is and separate from the observatory — its data is not shared.

## License and credits

MIT, see [LICENSE](LICENSE). The visual language of the page, the pictograms and the built-in agent and team catalogue come from [Agent Architecture Designer](https://github.com/TheJacksonCode/Agent-Architecture) by TheJacksonCode (MIT); the observatory around them is this project's.
