# Testing convention

Use the testing pyramid: many fast unit tests, fewer integration tests, and a small number of end-to-end tests.

## Ownership

- **Developer A — unit tests:** shared contracts and pure functions exported from `server/src/game/index.ts`.
- **Developer B — integration tests:** event loading, HTTP routes, rooms, Socket.IO, timers, idempotency, and match lifecycle.
- **Developers B and C — end-to-end tests:** complete two-browser flows through the deployed-style client and server boundary.

Do not add a higher-level test from a lower-level owner's branch unless the affected owners agree first.

## TDD loop

1. Agree on the public seam being tested and what the test intentionally does not cover.
2. Add one failing behavior test and run it to verify the red state.
3. Add only enough implementation to make that test pass.
4. Repeat with the next behavior as a vertical slice.
5. Perform cleanup only after behavior is green.

## Test quality

- Test observable behavior through public exports, not private helpers or internal call order.
- Keep implementation and its required tests in the same atomic commit.
- Use known examples and literal expected results from the PRD; do not recompute expectations with the implementation's algorithm.
- Mock only external boundaries such as time, randomness, filesystem, or third-party services. Do not mock project-owned modules.
- Keep tests deterministic and independent.

## Required checks

Run the focused workspace test during each TDD cycle. Before committing, run:

```sh
npm test
npm run build
```
