# Contributing

Thanks for your interest in contributing to nestjs-rest-query!

## Local setup

Requires Node 20+ and pnpm 9+.

- pnpm install
- pnpm build
- pnpm test

## Common commands

- pnpm test — run unit tests
- pnpm test:cov — with coverage
- pnpm lint — eslint
- pnpm typecheck — type-check only
- pnpm s02:dev — sample app (postgres)
- pnpm docs:dev — docs site

## Branching

- main is protected. Create feature branches: feat/xyz, fix/xyz, docs/xyz, chore/xyz.

## Commit style

We use Conventional Commits (feat:, fix:, docs:, chore:, refactor:, test:).

## Changesets

Every PR that changes published behavior must include a changeset:

- pnpm changeset
- Pick patch / minor / major
- Describe the user-visible change in 1-2 lines
- Commit the generated .changeset/\*.md file

## PR checklist

- [ ] Tests added or updated
- [ ] Docs updated (README / docs app)
- [ ] Changeset added (if user-visible)
- [ ] pnpm lint && pnpm typecheck && pnpm test passing
- [ ] No breaking changes without major bump

## Releasing

Maintainers only. Merging the auto-generated "chore: release" PR publishes to npm.
