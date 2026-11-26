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

Use **one commit per independently reviewable function or behavior**. If a task changes three independent functions, deliver three commits, even if the functions live in the same file. A single behavior that requires several functions to work together still belongs in one commit.

- For documentation, split by review topic rather than file. For example, record dates verified by existing citations separately from recommendations to replace citations.
- Keep required callers, tests, fixtures, contracts, documentation, and dependency/lockfile updates with the behavior they support. Do not split tightly coupled changes just to meet a one-function or one-file limit.
- Split independent features, fixes, refactors, documentation, formatting, and dependency changes into separate commits. Do not include unrelated cleanup or opportunistic edits.
- Order commits so each builds and passes its relevant tests independently. Keep a failing test and the implementation that fixes it in the same commit.
- Before staging, identify the separate behaviors in the working tree. Stage and review one behavior at a time; use a message describing only that change.

For example, separate round-start state, guess retry deduplication, final-score aggregation, and rematch creation into distinct commits, each with its required tests and wiring.
