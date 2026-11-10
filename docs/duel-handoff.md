# Temporary duel implementation checkpoint

**Continuing developer: delete this file once the handoff is complete and its remaining tasks are captured in the implementation plan or completed.** Keep durable API behavior in `docs/room-http-api.md`, not here.

Work recorded in this checkpoint is committed locally; nothing has been pushed. Existing untracked `.agents/` and `skills-lock.json` were not modified.

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

## Developer B: continue here

1. Implement Stage 4 socket attachment/authentication, safe snapshots, readiness, and a single countdown. Reuse the existing `RoomManager`; extend its waiting-only room type and expiry handling for active phases rather than adding a second store.
2. Import events from `server/src/content/events.ts` when implementing round selection; do not export the catalog through shared code or an HTTP endpoint.
3. Keep orchestration (deadlines, retries, event selection, timers) outside the pure `server/src/game` rules.
4. Select five distinct event IDs per match. Catalog validation does not perform random selection.

## Completed: Stage 2 client answer safety

- `client/src/App.tsx` now renders a duel placeholder with accurate availability messaging and duel instructions; it does not offer nonfunctional room buttons.
- Deleted the client catalog, its accessor, and `useGame`. Legacy rule tests now use synthetic fixtures only.
- Retained the old presentational game components and helpers as migration reference for Stage 8. They are not wired into the app; their single-player rules must not be reused for authoritative duel scoring or date validation.
- Existing localStorage values are left untouched; the new entry point neither reads nor writes them.

## Developer C: continue here

1. Replace the placeholder with Home/Lobby presentation against shared DTO fixtures. HTTP create/join/metadata routes now exist; sockets are still pending. Add a local Vite proxy or coordinated explicit CORS allowlist before cross-origin browser requests.
2. Do not import the server catalog or event type into client code. Use answer-safe shared DTOs and synthetic UI fixtures.
3. In Stage 8, adapt useful date/history components and remove obsolete single-player helpers. The legacy date parser has old date limits and is not duel-ready.

## Remaining blockers and review

- Stages 2–3 are complete. The browser currently shows a placeholder, not a playable game; Stages 4–8 remain necessary before a duel can be played.
- Schema validation is not historical verification: manually review dates, sources, clue ordering, and answer leakage before release. Source URLs are checked for syntax/protocol, not fetched.
- No Socket.IO integration or browser flow is implemented or verified by this checkpoint. The server is not ready for public deployment (CORS, per-IP limits, socket auth, and further hardening remain).

## Verification at this checkpoint

- `npm test`: 69 server + 17 client tests passed; shared has no runtime test files.
- `npm run build`: all workspaces passed.
- `git diff --check`: passed.
- Real local HTTP smoke test: server startup, health, host creation, guest join, third-player rejection, safe metadata, and absence of returned tokens in server logs passed. The test process was shut down afterward.
- Stage 2 production-bundle scan found no catalog IDs, titles, dates, or clues in built client JS/HTML/JSON.
- Postman CLI is not installed; no external workspace or collection was created or published. Tests use the project's prescribed Fastify injection seam.
