# Contributing

Thanks for helping improve `drizzle-extensions`.

## Development setup

```sh
bun install
bun run check
```

Use `bun run format` and `bun run lint` while developing. The pre-commit hook runs Biome on staged files; the commit-msg hook validates Conventional Commits.

## Pull requests

- Keep the public API focused and tree-shakable.
- Add or update tests for behavior changes.
- Keep Drizzle as a peer dependency; do not bundle it.
- Update the README and changelog when public behavior changes.
- Run `bun run check` before pushing.

Use commit messages such as `feat: add json helpers`, `fix: preserve nullability`, or `docs: clarify installation`.
