# Conventional Commits

Follow [Conventional Commits 1.0.0-beta.2](https://www.conventionalcommits.org/en/v1.0.0-beta.2/).

```text
<type>[optional scope]: <description>

[optional body]

[optional footer]
```

- Use `feat` for new features and `fix` for bug fixes.
- Other types such as `docs`, `style`, `refactor`, `perf`, `test`, and `chore` are allowed.
- Put breaking changes at the start of the body or footer as `BREAKING CHANGE: <description>`.
- Put issue references and other metadata in the footer, for example `Fixes #123`.

## Atomic commits

Every commit must contain the smallest complete behavior change that is straightforward to review and revert. Prefer function-sized changes over whole features or implementation stages.

- A typical commit adds or changes one function, one validation rule, or one narrowly scoped behavior, together with its tests.
- Break a feature or stage into several small commits. A stage/PR may contain multiple commits; do not bundle the entire stage into one commit by default.
- Keep required callers, tests, fixtures, contracts, documentation, and dependency/lockfile updates with the behavior they support. Do not split tightly coupled changes just to meet a one-function or one-file limit.
- Split independent features, fixes, refactors, documentation, formatting, and dependency changes into separate commits. Do not include unrelated cleanup or opportunistic edits.
- Order commits so each builds and passes its relevant tests independently. Keep a failing test and the implementation that fixes it in the same commit.
- Before staging, identify the separate behaviors in the working tree. Stage and review one behavior at a time; use a message describing only that change.

For example, separate round-start state, guess retry deduplication, final-score aggregation, and rematch creation into distinct commits, each with its required tests and wiring.
