# Guess the Date Duel implementation plan

This plan splits the duel PRD into small, independently verifiable stages. Implement **one stage per session/PR** so later work does not need to stay in context.

## Working rules

- At the start of a stage, read `AGENTS.md`, this plan, and only the relevant PRD sections and files.
- Keep the app buildable at every stage. Remove the existing single-player path only after the duel client replaces it.
- Define safe DTOs and validation before adding HTTP or Socket.IO handlers.
- Historical answers and the full event catalog must become server-only before multiplayer gameplay ships.
- Use npm workspaces, one Node.js process, and in-memory room state. Do not add a database, Redis, Docker orchestration, accounts, chat, matchmaking, or other post-MVP work.
- End each stage by running its focused tests plus the repository build, then update the checklist below.

## Three-person delivery

Use these ownership boundaries to keep work parallel and merge conflicts small.

| Developer | Primary ownership | Main stages |
|---|---|---|
| **A — Contracts and game domain** | `shared/src/**`, `server/src/game/**`, domain unit tests | Stage 2 contracts/rules and domain work needed by Stages 5–6 |
| **B — Server and content** | `server/src/content/**`, `server/src/routes/**`, `server/src/rooms/**`, `server/src/socket/**`, `server/src/index.ts`, server integration tests | Stages 2–6 backend and Stage 9 backend hardening |
| **C — Client** | `client/src/**`, client tests and styles | Stage 2 client safety, Stages 7–8, and Stage 9 client hardening |

### Coordination rules

- Developer A owns shared protocol types and error codes. B and C consume them rather than creating duplicate request/response types.
- A keeps game functions pure; B owns room state, timers, HTTP, and Socket.IO orchestration around those functions.
- C does not import server-only modules or event answers.
- A dependency change includes the relevant workspace `package.json` and root `package-lock.json` in the same commit. Rebase and regenerate the lockfile with `npm install`; do not hand-merge it.
- Cross-owner changes are split into coordinated atomic commits. The owner of a path makes the edit.
- Every branch must pass its focused tests and `npm run build` before merge.

### Parallel work order

1. **Contract gate:** A first merges the answer-safe shared DTOs, package exports, and structured error codes.
2. **Stage 2 in parallel:**
   - A implements dates, feedback, clue progression, scoring, best-guess selection, and tiebreaker tests.
   - B adds the event schema, server catalog loader, validation tests, and server-side catalog copy.
   - C, after B's catalog commit, removes client answer imports/catalog data and leaves a buildable duel shell; C may then start Home/Lobby presentational components against shared DTO fixtures.
3. **Lobby in parallel:** B implements Stages 3–4 while C builds and then connects the Home/Lobby flow. A handles only requested contract or domain changes.
4. **Gameplay in parallel:** A owns game-rule changes, B owns Stages 5–6 orchestration, and C owns the round/results client from Stage 8.
5. **Hardening:** A validates content/rule coverage, B handles reconnect/security/cleanup, and C handles client recovery/accessibility. Finish with joint two-browser testing.

## Stages

### Stage 0 — Repository cleanup

**Scope**
- Remove generated output and stale TypeScript emissions: `dist/`, `*.tsbuildinfo`, `vite.config.js`, and `vite.config.d.ts`.
- Ignore those artifacts so they do not return as repository noise.
- Keep the required configs, lockfile, PRD, and the 55-event catalog.

**Done when**
- The existing tests and production build still pass without relying on stale emitted config files.

### Stage 1 — Workspace skeleton

**Read:** PRD sections 6, 7, and 14.

**Scope**
- Convert the repository to minimal npm workspaces: `client`, `server`, and `shared`.
- Move the current Vite app into `client` without changing behavior.
- Add only the package scripts and TypeScript configs needed to build and test each workspace.

**Done when**
- Root install, test, and build commands work; the existing single-player client still runs.

### Stage 2 — Contracts and server game kernel

**Read:** PRD sections 3, 4, 9, 10, and 12.

**Scope**
- Define shared, answer-safe HTTP/socket DTOs and structured error codes.
- Add server-only event validation and move the catalog out of the client bundle.
- Implement strict ISO date validation (1600–2099), UTC day differences, feedback thresholds, clue progression, scoring, best-guess selection, and tiebreakers.
- Add focused unit tests for every PRD boundary.

**Done when**
- The catalog validates at startup/tests, game-rule tests pass, and no correct date is importable by client code.

### Stage 3 — HTTP rooms and lobby state

**Read:** PRD sections 7, 8, and 11.

**Scope**
- Add Fastify with `GET /health`, room creation, join, and safe lobby metadata routes.
- Add `RoomManager` with cryptographic room codes, per-player credentials, two-player capacity, sanitized nicknames, and lobby expiry.
- Test routes with Fastify injection; reject full, missing, expired, and malformed requests.

**Done when**
- Two players can create/join a private room and a third cannot; responses never expose stored token material or event answers.

### Stage 4 — Socket attachment, readiness, and countdown

**Read:** PRD sections 3.1, 7.1, and 9.

**Scope**
- Add Socket.IO attachment/authentication, safe room snapshots, presence, ready toggles, and sync.
- Start one server-owned three-second countdown only when both players are connected and ready.
- Add two-client integration tests, including unauthorized attachment and duplicate countdown prevention.

**Done when**
- Both clients receive the same scheduled start timestamp and only sanitized state.

### Stage 5 — One authoritative playable round

**Read:** PRD sections 3, 4, 9, and 11.

**Scope**
- Select one server-side event and broadcast clue 1 with absolute start/end timestamps.
- Accept up to six distinct valid guesses before the deadline.
- Return private temperature/direction feedback and private clue unlocks.
- Deduplicate `requestId` retries and resolve the round once when both finish or time expires.

**Done when**
- Integration tests prove synchronized deadlines, private feedback, no duplicate attempt consumption, and no answer leakage before results.

### Stage 6 — Five-round match and results

**Read:** PRD sections 3.1, 4, 5, and 9.

**Scope**
- Run five distinct rounds with eight-second result intervals.
- Compute server-owned round totals, cumulative scores, exact-solve counts, errors, tiebreakers, and final winner/draw.
- Add rematch creation and spoiler-free share data.

**Done when**
- A deterministic integration test completes exactly five rounds with one result per round and one final result.

### Stage 7 — Duel home and lobby client

**Read:** PRD sections 2, 5 (Home/Lobby), 8, and 9.1.

**Scope**
- Replace the entry flow with nickname, create-room, and join-room actions.
- Support invite URLs without putting player credentials in the URL.
- Add the socket connection/attach/sync hook and lobby UI with player, ready, disconnected, full, and expired states.

**Done when**
- Two browser sessions can reach the synchronized countdown using the UI.

### Stage 8 — Round, results, and final client

**Read:** PRD section 5 and the server DTOs from Stages 2–6.

**Scope**
- Reuse the current accessible date fields and visual primitives where they fit.
- Add the server-corrected timer, clues, private guess history, opponent status, waiting state, round results, final results, rematch, and share text.
- Remove daily/unlimited mode, client-side answer imports, and obsolete localStorage game state only after the duel flow works.

**Done when**
- The complete match is playable on desktop and mobile with keyboard-accessible controls and no answer data in the frontend build.

### Stage 9 — Reliability, security, and release check

**Read:** PRD sections 7.2, 9.1, 11, 12, and 15.

**Scope**
- Add reattach/reconnect, single active socket per credential, 30-second disconnect forfeits, stale-room sweeps, timer cleanup, caps/rate limits, CORS allowlisting, and graceful shutdown.
- Verify the 55 events meet the final server schema and flag manual source/content review separately.
- Add deployment/environment notes and run two-device/WebSocket smoke tests.

**Done when**
- Reliability integration tests and the MVP launch checklist pass on the intended single-instance deployment.

## Progress

- [x] Stage 0 — Repository cleanup
- [x] Stage 1 — Workspace skeleton
- [x] Stage 2 — Contracts and server game kernel
  - [x] Shared contracts and pure game rules, including round scoring, match totals, and tiebreakers.
  - [x] Server catalog schema, loader, and validation.
  - [x] Remove client catalog/answer imports before multiplayer ships; buildable duel placeholder replaces the single-player entry point.
- [x] Stage 3 — HTTP rooms and lobby state
- [x] Stage 4 — Socket attachment, readiness, and countdown
  - Countdown deadline is published and included in snapshots; Stage 5 executes it.
- [x] Stage 5 — One authoritative playable round
  - Server-owned countdown/deadline timers, private clues/feedback, bounded retries, early/timeout scoring, and result recovery on sync.
  - One-round lifecycle is extended to the full match in Stage 6.
  - Real WebSocket clients cover early finish and a real 60-second timeout. See Stage 8 for local browser coverage; deployed proxy flows remain unverified.
- [x] Stage 6 — Five-round match and results
  - Five distinct event IDs, eight-second intervals, cumulative scores, final winner/draw, and spoiler-free share text.
  - Sync recovers round and final results; rematch creates one retry-safe fresh lobby per requester without moving sockets automatically.
  - Controlled-clock real-client integration completes exactly five rounds with one result each and one final result. Pure score tests cover all tiebreaker priorities.
- [x] Stage 7 — Duel home and lobby client
  - One Chrome session created a room and another joined via a code-only invite. Both saw the same countdown and reached match start through the local Vite proxy.
- [x] Stage 8 — Round, results, and final client
  - Two isolated Chrome sessions (desktop and a 375px mobile viewport) completed all five rounds through the local Vite proxy, including keyboard guesses, private feedback, reload recovery, result sharing, and joining a rematch.
  - The production JavaScript contained no IDs, titles, dates, or clues from the 55-event catalog.
- [ ] Stage 9 — Reliability, security, and release check
  - Keep the current server single-process and non-public until origin allowlisting, connection/per-IP/guess limits, forfeits, and periodic cleanup are implemented.
  - Catalog schema validation and the [55-entry date review](catalog-date-review.md) are complete. Two milestones remain unsigned; see the [catalog review handoff](#catalog-review-handoff) before launch.

### Catalog review handoff

Reviewed all 55 entries for clue progression and obvious date spoilers, and checked their cited links. No clue spells out its full answer date. A scan of the current production client JavaScript found no catalog IDs, titles, first clues, or answer dates. The following are content follow-ups, not blockers for Stage 7:

| Entry | Follow-up for the catalog owner |
|---|---|
| `first-website` | Name the dated milestone precisely: Tim Berners-Lee's [public Usenet post about the Web](https://www.w3.org/People/Berners-Lee/1991/08/art-6484.txt), not necessarily the first day the site went online. Update title, explanation, clue 5, and source together. |
| `penicillin-discovered` | Verify the exact day before shipping. The [historical review](https://pmc.ncbi.nlm.nih.gov/articles/PMC5403050/) supports 1928 but does not establish September 28. If a reliable day-specific source cannot be found, replace the event with a dateable milestone. |
| `berlin-wall-opens`, `bandung-conference`, `ghana-independence` | Replace the Berlin citation, which redirects to an unrelated story about Latvia's president. Bandung redirects to the museum homepage, and Ghana cites a government homepage; use event-specific sources. For Ghana, remove the broad "first sub-Saharan African colony" claim unless the replacement source supports a narrower, qualified statement. |
| `first-human-spaceflight` | Clue 1 already identifies the milestone, and clue 3 confuses automatic flight control with control from the ground. Open with a broader clue and use a sourced fact about Vostok's automatic controls later. |
| `apollo-11-moon-landing`, `everest-first-ascent`, `curiosity-lands-on-mars` | Move the near-identifying hints later: the first crewed trip to another world (clue 1), the highest point on Earth (clue 1), and "seven minutes of terror" (clue 2). Keep the hints about the event distinct from hints about the exact date. |
| `first-earth-day`, `baird-television-demonstration` | Tighten progression: put Earth Day's environmental-law hint before the senator's name, and Baird's moving-image hint before naming the Royal Institution. |

**Before launch:** Apply the [date review's citation recommendations](catalog-date-review.md). Reframe `first-website` around the dated announcement and resolve or replace `penicillin-discovered`. The date review does not clear the clue issues above; recheck difficulty in the two-browser playtest after Stage 8.
