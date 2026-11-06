# DateGuessr

DateGuessr is a browser-based daily puzzle in which players use progressive clues and proximity feedback to guess the exact date of a historical event.

## Project structure

- `src/App.tsx` — app shell: header, game screen, and help dialog.
- `src/components/` — presentational components (`GameScreen`, `DateForm`, `GuessHistory`, `ResultPanel`, `Header`, `HelpDialog`).
- `src/hooks/useGame.ts` — game state, persistence, and mode switching.
- `src/lib/game.ts` — date parsing, puzzle selection, and game rules.
- `src/lib/events.ts` — typed access to the event catalog.
- `src/lib/storage.ts` — versioned localStorage keys and helpers.
- `src/lib/game.test.ts` — game-rule tests.
- `src/data/events.json` — sourced historical-event catalog.
- `docs/` — product documentation and conventions.

## Conventions

- [Conventional Commits](docs/conventional-commits.md)
- [Visual hierarchy](docs/visual-hierarchy.md)
