# CSV Change Review

An Agent-Native prototype for reviewing CSV changes with deterministic evidence, separate agent suggestions and explicit human control.

**[Watch the public demonstration](https://clips.agent-native.com/r/XMbJNyOl302f)** (silent, with chapters). This is a local single-user prototype using synthetic inventory, not a hosted production service.

## What it does

- Compare bounded CSV inputs by a chosen key, preserving strings such as leading-zero identifiers.
- Show added/removed rows and changed cells as deterministic evidence.
- Persist review notes and exact revisions, rejecting conflicting writes.
- Display evidence-linked suggestions as **PROPOSED / unverified**, separate from human decisions.
- Protect unsaved drafts during refresh, source edits and stale-review recovery.
- Export escaped HTML or Markdown.

The recorded demonstration validates and compares synthetic CSVs, saves/reloads a pending correction, then opens suggestions from a **previously recorded external native-agent run**. It does not pretend to perform fresh live inference. Built-in chat/provider inference remains unverified. No agent Accept/Reject decision is represented as the creator's approval.

## Repository layout

- `app/`: Agent-Native application, shared actions, persistence and tests.
- `domain/`: dependency-free CSV comparison engine and tests.
- `fixtures/`: synthetic engine cases.
- `licenses/` and `THIRD_PARTY_NOTICES.md`: scaffold/dependency attribution.

## Run locally

Use Node.js >=22.22 and pnpm **10.29.1**, matching the project lockfile. Keep the sibling `domain/` folder: app imports it directly.

```sh
cd app
pnpm install --frozen-lockfile
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8087 --strictPort
```

Open `http://127.0.0.1:8087/home`. Use synthetic data only and one app process at a time; the local PGlite database is not shared between parallel processes. A fresh checkout starts empty: IDs shown in the recorded demo refer to that recording's local database, which is intentionally not included. Generate a new review through Validate sources and Compare and save.

The default fixture changes Notebook price 4.00 to 4.50, removes Eraser key 003 and adds Ruler key 004. Select key `id`.

The development server may take a minute or longer to initialize and hydrate on a constrained machine. One early request can return 503 while Nitro initializes. Wait for the actual CSV controls rather than assuming a listening port means the page is ready. Memory pressure can prevent a reliable session; cold startup and sustained reliability remain limitations.

## Checks

From repository root:

```sh
node --test domain/tests/csv.test.mjs
```

After installing app dependencies, from `app/`:

```sh
node node_modules/@agent-native/core/bin/agent-native.js typecheck
node node_modules/@agent-native/core/bin/agent-native.js doctor
node node_modules/vitest/vitest.mjs run shared/csv-review.test.ts shared/csv-review.persistence.test.ts shared/csv-proposals.test.ts app/lib/csv-review-drafts.test.ts actions/view-screen.test.ts
```

Historical verification includes deterministic engine tests, isolated SQL persistence/concurrency guards, draft/context tests, typecheck/doctor, actual Chrome recovery checks and the recorded workflow. This statement does not claim fresh CI or all-path coverage on every checkout.

## Agent route and limitations

The supported action surface includes `open-csv-review` and `stage-csv-proposals`; the separately recorded external native assistant read evidence, staged bounded evidence-linked groups with an exact revision and read them back. Stored text alone does not authenticate a model run or its exact model identity. A new install does not automatically configure inference credentials or regenerate the recording's groups. The manual staging form is explicitly not inference.

`review-csv-evidence` is UI-only and hidden from agent tools. This is a framework action boundary, not multi-user production authorization. Inputs and proposal text are untrusted. Drafts live in mounted-screen memory; cross-tab freshness is conditional and revision checks are the write backstop. File import, every secondary route, adversarial security and sustained reliability are not exhaustively verified.

No production deployment is claimed. Production startup requires supported database and authentication configuration; do not bypass those requirements or expose local development storage.

## Origins and publication

Original entry work began 27 October 2026 using the official Agent-Native standalone chat scaffold, Core/Toolkit/AgentKit 0.220.0, React, React Router, Vite, PGlite and other libraries. AI coding and native-agent assistance were used. See THIRD_PARTY_NOTICES.md.

This is a reviewed source snapshot, not the private development history. Credentials, local databases/sessions, account details, internal coordination reports and transcripts are excluded. The repository and clip are project materials; neither is proof of a competition submission receipt.


