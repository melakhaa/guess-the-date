# DateGuessr

DateGuessr is a browser-based daily puzzle in which players use progressive clues and proximity feedback to guess the exact date of a historical event.

## Project structure

- `client/` — React/Vite browser app.
- `client/src/App.tsx` — app shell: header, game screen, and help dialog.
- `client/src/components/` — presentational components (`GameScreen`, `DateForm`, `GuessHistory`, `ResultPanel`, `Header`, `HelpDialog`).
- `client/src/hooks/useGame.ts` — game state, persistence, and mode switching.
- `client/src/lib/game.ts` — date parsing, puzzle selection, and game rules.
- `client/src/lib/events.ts` — typed access to the event catalog.
- `client/src/lib/storage.ts` — versioned localStorage keys and helpers.
- `client/src/lib/game.test.ts` — game-rule tests.
- `client/src/data/events.json` — sourced historical-event catalog.
- `server/` — Node.js backend workspace.
- `shared/` — shared TypeScript workspace.
- `docs/` — product documentation and conventions.

## Conventions

- [Commit convention](docs/commit-convention.md)
- [Visual hierarchy convention](docs/visual-hierarchy-convention.md)
