# Guess the Date

Challenge a friend to **Guess the Date Duel**. Use progressive clues and feedback to guess the dates of five historical events before each round ends.

## Get started

Use Node.js 22.12+ and npm. Run these commands from the repository root:

```sh
npm ci
npm run dev --workspace @guess-the-date/server
```

In a second terminal, run `npm run dev` to start Vite. Open the URL it prints, create a room, and open the invite link in a separate browser profile or private window. Both players mark ready to start.

Vite proxies room requests and Socket.IO to `http://127.0.0.1:3001` by default. See the [room HTTP API](docs/room-http-api.md) and [socket lobby API](docs/socket-lobby-api.md) for details. Keep the server local until Stage 9 hardening is complete.

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
| `server/src/routes/`, `server/src/rooms/`, `server/src/socket/` | HTTP rooms, in-memory room/round state, and authenticated socket gameplay |
| `server/src/content/` | Validated server-only event catalog |
| `server/src/game/` | Pure date validation, feedback, guess acceptance, clue progression, and round-scoring rules |
| `shared/src/` | Shared TypeScript protocol types, constants, and error codes |
| `docs/` | Product requirements, implementation plan, and project conventions |

The historical-event catalog lives in `server/src/content/events.json` and is validated by `server/src/content/events.ts` at module load. Do not import it into client or shared code. Historical accuracy and source availability still require manual review.

## Development guides

- [Duel product requirements](docs/guess-the-date-duel-prd-node-socketio.md)
- [Implementation plan and progress](docs/guess-the-date-duel-implementation-plan.md)
- [Testing convention](docs/testing-convention.md)
- [Commit convention](docs/commit-convention.md)
- [Visual hierarchy convention](docs/visual-hierarchy-convention.md)

Keep changes focused and include tests for new game behavior. Run tests and the build before committing.
