# Guess the Date

Guess the Date Duel is a browser game in which two players use clues and proximity feedback to guess historical dates over five timed rounds.

## Project structure

- `client/` — React/Vite browser app.
- `client/src/App.tsx` — app shell and browser room session.
- `client/src/components/` — home, lobby, round and results screens.
- `client/src/hooks/useLobby.ts` — Socket.IO connection, match state and actions.
- `client/src/lib/duel-date.ts` — date input validation and formatting.
- `client/src/lib/rooms.ts` — room HTTP calls, invites and session storage.
- `server/` — Node.js backend workspace, game rules, and server-only event catalog.
- `shared/` — shared TypeScript workspace.
- `docs/` — product documentation and conventions.

## Conventions

- [Commit convention](docs/commit-convention.md)
- [Testing convention](docs/testing-convention.md)
- [Visual hierarchy convention](docs/visual-hierarchy-convention.md)
