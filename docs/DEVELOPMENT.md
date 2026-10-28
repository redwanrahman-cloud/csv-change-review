# Local development

## Prerequisites

Use Node.js >=22.22 and pnpm 10.29.1 with the committed lockfile. The repository contains sibling `app/`, `domain/` and `fixtures/` directories. The application imports the domain engine directly, so preserve this structure.

From `app/`, install with `pnpm install --frozen-lockfile`, then start the installed Vite entry:

```sh
node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 8087 --strictPort
```

Open `http://127.0.0.1:8087/home`. Use one process at a time: local PGlite storage cannot be owned by parallel app processes. A fresh checkout has an empty database; review IDs visible in the demo belong to its recording session. Create your own review through the interface. No recording-session database or credentials are distributed.

Cold initialization may take a minute or longer and can initially return 503. Wait for the actual CSV controls. This prototype has known startup and memory constraints; it is not a production or multi-user deployment. Supported production authentication/database configuration is separate from local development.

## Checks

From repository root:

```sh
node --test domain/tests/csv.test.mjs
```

The exported engine suite passed 34/34 tests at publication. From `app/`, after dependency installation:

```sh
node node_modules/@agent-native/core/bin/agent-native.js typecheck
node node_modules/@agent-native/core/bin/agent-native.js doctor
node node_modules/vitest/vitest.mjs run shared/csv-review.test.ts shared/csv-review.persistence.test.ts shared/csv-proposals.test.ts app/lib/csv-review-drafts.test.ts actions/view-screen.test.ts
```

Development verification covered isolated SQL persistence/concurrency, draft/context behavior, typecheck/doctor and browser review/recovery flows. These records do not imply exhaustive coverage or a fresh CI run for every clone.

## Agent integration

`open-csv-review` returns the immutable source evidence and current revision. `stage-csv-proposals` stores bounded evidence-linked groups using that exact revision. Re-read before writing after a conflict. The external-agent route was exercised during development; the demo opens suggestions saved by that earlier run rather than generating new ones live.

The manual proposal form stages supplied text directly. Embedded chat is not configured in this release. A fresh checkout does not automatically connect an inference provider or reproduce the recording's saved groups.

`review-csv-evidence` is UI-only and hidden from agent tools. This framework boundary is not a multi-user authorization system. Treat CSV and suggestion text as untrusted. Unsaved drafts remain in mounted-screen memory, and cross-tab freshness is conditional; exact-revision checks protect writes. File import, every secondary route, adversarial security and sustained reliability are not exhaustively covered.
