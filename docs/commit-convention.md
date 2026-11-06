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

Every commit must contain one logical change that is straightforward to review and revert.

- Split independent features, fixes, refactors, documentation, formatting, and dependency changes into separate commits.
- Keep the implementation and its required tests, fixtures, types, and lockfile updates together; atomic means one logical change, not one file.
- Do not include unrelated cleanup or opportunistic edits.
- Keep each commit buildable and passing its relevant tests whenever possible.
- Review the staged diff before committing and use a message that describes only that change.
