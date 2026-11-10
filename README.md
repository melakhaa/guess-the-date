# Guess the Date

Guess the exact date of a historical event using progressive clues and proximity feedback.

**Guess the Date Duel is in development:** a two-player, five-round mode with synchronized timers and server-authoritative scoring. Shared contracts, server game rules, a validated server-only catalog, and the HTTP room API are implemented. The browser currently shows a duel placeholder; multiplayer gameplay and the connected UI are not yet runnable. The old single-player entry point has been retired to remove bundled answers.

## Get started

Use Node.js 22.12+ and npm. Run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development command starts the duel placeholder client only. In a second terminal, start the HTTP server:

```sh
npm run dev --workspace @guess-the-date/server
```

The server defaults to `http://127.0.0.1:3001`; `GET /health` reports readiness. See the [room HTTP API](docs/room-http-api.md) for requests, errors, and development limitations. The client is not connected to these routes yet.

## Checks

```sh
npm test        # Run tests across workspaces
npm run build  # Build the client and type-check server/shared
```

Run server game-rule tests on their own:

```sh
npm run test --workspace @guess-the-date/server
```

The production client build is written to `client/dist/`.

## Repository layout

| Path | Purpose |
| --- | --- |
| `client/` | React, TypeScript, and Vite browser app |
| `server/src/routes/`, `server/src/rooms/` | HTTP room endpoints and in-memory lobby state |
| `server/src/content/` | Validated server-only event catalog |
| `server/src/game/` | Pure date validation, feedback, guess acceptance, clue progression, and round-scoring rules |
| `shared/src/` | Shared TypeScript protocol types, constants, and error codes |
| `docs/` | Product requirements, implementation plan, and project conventions |

The historical-event catalog lives in `server/src/content/events.json` and is validated by `server/src/content/events.ts` at module load. Do not import it into client or shared code. Historical accuracy and source availability still require manual review.

## Development guides

- [Duel product requirements](docs/guess-the-date-duel-prd-node-socketio.md)
- [Implementation plan and progress](docs/guess-the-date-duel-implementation-plan.md)
- [Current handoff checkpoint](docs/duel-handoff.md)
- [Testing convention](docs/testing-convention.md)
- [Commit convention](docs/commit-convention.md)
- [Visual hierarchy convention](docs/visual-hierarchy-convention.md)

Keep changes focused and include tests for new game behavior. Run tests and the build before committing.
