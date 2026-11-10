# Temporary duel implementation checkpoint

**Continuing developer: delete this temporary file once the handoff is complete and its remaining tasks are captured in the implementation plan or completed. Remove its README link when deleting it.** Keep durable API behavior in `docs/room-http-api.md` and `docs/socket-lobby-api.md`, not here.

## Stopped at the user's request

Implementation has stopped. At the user's subsequent request, Stage 4 and this checkpoint are committed together under `feat(server): add authenticated socket lobby and countdown`. Before starting Stage 5:

1. Review that commit, especially `server/src/socket/lobby.ts`, `server/src/socket/lobby.test.ts`, and `docs/socket-lobby-api.md`.
2. The final pre-commit checks passed: **84 server + 17 client tests**, all workspace builds, and whitespace checks. These checks include the final unauthenticated-readiness assertion. They were run after the user authorized committing; no further feature implementation was done after the stop request.
3. Keep `.agents/` and `skills-lock.json` out of unrelated commits; they predate this work and remain untracked.
4. Continue with the developer-specific instructions below. Countdown execution, actual round gameplay, and the connected client remain unfinished.

Stages 2–3 are committed through `cfeb688` (preceded by `491b720`, `f654aa4`, and `d966795`). This agent has not pushed. At stop, local `main` and the cached `origin/main` ref match; the live remote was not queried. Existing untracked `.agents/` and `skills-lock.json` were not modified.

### Stage 4 changed files

- Shared contracts: `shared/src/protocol.ts`, `shared/src/errors.ts`.
- Server wiring/state: `server/src/app.ts`, `server/src/rooms/RoomManager.ts`, `server/src/rooms/RoomManager.test.ts`.
- New socket implementation/tests: `server/src/socket/lobby.ts`, `server/src/socket/lobby.test.ts`.
- Dependencies: `server/package.json`, `package-lock.json`.
- Documentation: `README.md`, `docs/guess-the-date-duel-implementation-plan.md`, `docs/room-http-api.md`, new `docs/socket-lobby-api.md`, and this temporary checkpoint.

## Completed: Stage 2 server content

- `server/src/content/events.json` contains the 55 existing events, copied without changing their content.
- `server/src/content/events.ts` exports the validated `events`, server-only `HistoricalEvent` type, and `parseEventCatalog(unknown)`.
- Module loading validates strict event fields, supported real dates, exactly five non-empty clues, source labels and HTTP(S) URLs, difficulty, tags, at least 50 events, and unique IDs. Invalid content throws rather than starting with a partial catalog.
- `server/src/app.ts` imports the loader for startup validation; `server/src/index.ts` starts the HTTP server.
- The schema preserves the existing `explanation`, `sources`, and `tags` format rather than replacing it with the PRD's illustrative `sourceUrl`/`category` shape. Revealed results can use the existing shared DTO fields.
- Zod is now a server dependency; package and lockfile changes belong together.

## Completed: Stage 3 HTTP rooms

- `server/src/app.ts` exports the injectable app; `server/src/index.ts` starts it. Use `npm run dev --workspace @guess-the-date/server` or `npm run start --workspace @guess-the-date/server` (requires dev dependencies, including `tsx`).
- `server/src/rooms/RoomManager.ts` owns in-memory lobbies, cryptographic invitation codes/tokens, hashed token storage, sanitized nicknames, capacity, and expiry. Its `get()` is server-internal and returns private mutable state: never send that object to a client.
- `server/src/routes/rooms.ts` serves create, join, and safe metadata routes; `/health` is registered in the app. All responses disable caching. See `docs/room-http-api.md` for the exact HTTP contract and retry limitations.
- Lobbies expire after 30 idle minutes; a successful join refreshes expiry. Reads do not. Cleanup happens on access/create; storage is capped at 1,000 rooms. Per-IP limits and periodic sweeps remain Stage 9 work.

## Completed: Stage 4 socket lobby

- `server/src/socket/lobby.ts` implements `room:attach`, `player:ready`, and `room:sync` with strict payload validation, bounded readiness retry caching, safe snapshots, room isolation, and single active socket per player.
- Both connected/ready players receive one shared three-second countdown deadline. Snapshots include `countdownStartsAt` so reattachment can recover it.
- Disconnect/unready cancels a lobby countdown; credential-based socket replacement preserves it. **Countdown completion is not implemented:** Stage 5 must start a round at the stored deadline.
- Shared event callback maps are now available for client/server typing. `ActionAck` failures allow an absent request ID when a malformed request supplied none.
- Socket.IO shutdown is tied to Fastify lifecycle hooks. `socket.io` is a server dependency; `socket.io-client` is a server dev dependency used by real-client integration tests.
- Durable behavior and retry details: `docs/socket-lobby-api.md`.

## Developer B: continue here

1. Implement Stage 5: consume `countdownStartsAt` with a server-owned timer, select a server event, and start one authoritative round. Reuse the existing `RoomManager`; extend its lobby-only room type and expiry handling for active phases rather than adding a second store. Guard ready/disconnect handlers by phase: they currently only handle lobbies and must not reset a playing round.
2. Import events from `server/src/content/events.ts` when implementing round selection; do not export the catalog through shared code or an HTTP endpoint.
3. Keep orchestration (deadlines, retries, event selection, timers) outside the pure `server/src/game` rules.
4. Select five distinct event IDs per match. Catalog validation does not perform random selection.

## Completed: Stage 2 client answer safety

- `client/src/App.tsx` now renders a duel placeholder with accurate availability messaging and duel instructions; it does not offer nonfunctional room buttons.
- Deleted the client catalog, its accessor, and `useGame`. Legacy rule tests now use synthetic fixtures only.
- Retained the old presentational game components and helpers as migration reference for Stage 8. They are not wired into the app; their single-player rules must not be reused for authoritative duel scoring or date validation.
- Existing localStorage values are left untouched; the new entry point neither reads nor writes them.

## Developer C: continue here

1. Replace the placeholder with Home/Lobby presentation against shared DTO fixtures. HTTP create/join/metadata routes and socket attach/ready/sync now exist. Add `socket.io-client` to the client workspace (it is currently only a server test dependency), and use the shared event maps. Add a local Vite proxy or coordinated explicit CORS allowlist before cross-origin browser requests.
2. Do not import the server catalog or event type into client code. Use answer-safe shared DTOs and synthetic UI fixtures.
3. In Stage 8, adapt useful date/history components and remove obsolete single-player helpers. The legacy date parser has old date limits and is not duel-ready.

## Remaining blockers and review

- Stages 2–4 are complete at their stated boundaries. The browser still shows a placeholder, and countdowns do not start gameplay yet; Stages 5–8 remain necessary before a duel can be played.
- Schema validation is not historical verification: manually review dates, sources, clue ordering, and answer leakage before release. Source URLs are checked for syntax/protocol, not fetched.
- Socket.IO lobby integration is verified with real WebSocket clients. Browser flow, polling transport, deployed proxies, and active-match reconnection/forfeit are not verified. The server is not ready for public deployment (CORS/origin allowlisting, per-IP/connection limits, and further hardening remain).

## Final pre-commit verification

- `npm test`: 84 server + 17 client tests passed; shared has no runtime test files.
- Socket tests cover forged credentials, malformed/ack-less messages, unauthenticated actions, room isolation, shared countdowns, duplicate prevention, bounded readiness retries, unready/disconnect cancellation, controller replacement, and shutdown with clients connected. Expiry boundaries use store/HTTP tests rather than advancing the clock of live Socket.IO heartbeat clients.
- `npm run build`: all workspaces passed.
- `git diff --check`: passed.
- Real local HTTP smoke test: server startup, health, host creation, guest join, third-player rejection, safe metadata, and absence of returned tokens in server logs passed. The test process was shut down afterward.
- Stage 2 production-bundle scan found no catalog IDs, titles, dates, or clues in built client JS/HTML/JSON.
- Postman CLI is not installed; no external workspace or collection was created or published. Tests use the project's prescribed Fastify injection seam.
