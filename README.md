# Guess the Date

Guess the exact date of a historical event using progressive clues and proximity feedback.

The current browser app supports daily and unlimited single-player puzzles. **Guess the Date Duel is in development:** a planned two-player, five-round mode with synchronized timers and server-authoritative scoring. Shared contracts and server game rules are implemented, but the multiplayer server and client flow are not yet runnable.

## Get started

Use Node.js 22.12+ and npm. Run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. The development command starts the single-player client only; there is no backend service to start yet.

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
| `server/src/game/` | Pure date validation, feedback, guess acceptance, clue progression, and round-scoring rules |
| `shared/src/` | Shared TypeScript protocol types, constants, and error codes |
| `docs/` | Product requirements, implementation plan, and project conventions |

The historical-event catalog currently lives in `client/src/data/events.json`. Moving answers to server-only storage is part of the duel implementation plan; the existing client is not an authoritative multiplayer game.

## Development guides

- [Duel product requirements](docs/guess-the-date-duel-prd-node-socketio.md)
- [Implementation plan and progress](docs/guess-the-date-duel-implementation-plan.md)
- [Testing convention](docs/testing-convention.md)
- [Commit convention](docs/commit-convention.md)
- [Visual hierarchy convention](docs/visual-hierarchy-convention.md)

Keep changes focused and include tests for new game behavior. Run tests and the build before committing.
