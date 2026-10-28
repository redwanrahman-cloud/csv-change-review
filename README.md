# CSV Change Review

Turn two CSV exports into a clear, reviewable change report.

**[Watch the demonstration](https://clips.agent-native.com/r/XMbJNyOl302f)** · [Local setup and checks](docs/DEVELOPMENT.md)

CSV Change Review helps people inspect inventory and price changes without losing the source evidence. It preserves identifiers such as `001`, separates added and removed rows from changed cells, and keeps suggested explanations separate from review decisions.

## The workflow

1. Paste the before and after CSVs and validate their columns.
2. Select a key, then compare and save the review.
3. Inspect each change and follow a suggested group's links to its evidence.
4. Add a correction or review decision, save it, and reopen the persisted review.
5. Export the report as HTML or Markdown.

The demo uses a small synthetic inventory: Notebook changes from 4.00 to 4.50, Eraser is removed, and Ruler is added. It shows live comparison and correction persistence, followed by saved agent suggestions from an earlier run.

## Built with Agent-Native

The interface and external agent use the same typed actions to read reviews and stage evidence-linked suggestions. Suggested groups are labeled **PROPOSED**. Review decisions use a separate UI-only action, so the agent tool cannot approve its own suggestions.

Exact revision checks reject conflicting writes. Draft protection asks before discarding unsaved text and keeps stale reviews blocked until fresh evidence is loaded. Exports escape user-supplied text.

## Try it locally

Requires Node.js >=22.22 and pnpm **10.29.1**.

```sh
cd app
pnpm install --frozen-lockfile
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8087 --strictPort
```

Open `http://127.0.0.1:8087/home`, validate the supplied synthetic inputs, select `id`, and compare. Keep the sibling `domain/` directory when cloning or moving the application.

This release is a local, single-user prototype. The demonstrated agent integration uses the external action route; embedded chat is not configured. Cold startup can be slow on memory-constrained machines. See the development guide for setup details and scope.

## Project structure

- `app/` — interface, shared actions, persistence and application tests.
- `domain/` — deterministic CSV engine and its tests.
- `fixtures/` — synthetic test cases.
- `licenses/` — retained third-party license notice.

## Original development and credits

Development for this entry began on **27 October 2026**. It builds on the official [Agent-Native](https://github.com/BuilderIO/agent-native) standalone chat scaffold and its Core, Toolkit and AgentKit packages, alongside React, React Router, Vite, PGlite and other libraries.

The CSV comparison engine, evidence-linked review workflow, persistence and revision controls, proposal staging, draft recovery and exports were developed for this project. See [third-party notices](THIRD_PARTY_NOTICES.md) for dependency attribution and the retained license notice.
