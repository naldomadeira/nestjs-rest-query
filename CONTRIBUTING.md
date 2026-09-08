# Contributing

Thanks for your interest in contributing to nestjs-rest-query!

## Local setup

Requires Node 22+ (`engines`) and pnpm 9+.

- pnpm install
- pnpm build
- pnpm test

## Common commands

- pnpm test — run unit tests
- pnpm test:cov — with coverage
- pnpm lint — eslint
- pnpm typecheck — type-check `src/` only
- pnpm typecheck:tests — type-check `tests/`, which `typecheck` does not cover
- pnpm test:integration — the ORM × database matrix, one cell per run (needs `pnpm db:up`)
- pnpm verify:package — build, publint, attw and isolated consumer fixtures
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
- [ ] pnpm lint && pnpm typecheck && pnpm typecheck:tests && pnpm test passing
- [ ] No breaking changes without major bump

## Releasing

Maintainers only. Merging the auto-generated "chore: release" PR publishes to npm, with provenance, via OIDC Trusted Publishing — there is no `NPM_TOKEN`.

Two things about that PR that are not obvious:

- **It is opened by `github-actions[bot]`, so its workflow runs start in `action_required`.** Until a maintainer approves them in the Actions tab, it reports no checks at all and stays `BLOCKED` behind the required ones. That approval is the normal operation here, not a defect: the alternative is a long-lived write credential, which is what Trusted Publishing was adopted to avoid. `release.yml` reads an optional `RELEASE_PAT` if one ever exists, but none is configured on purpose.
- **The repo is currently in changesets pre mode (`alpha`).** Releases publish under the `alpha` dist tag and `latest` stays on `2.x`. Promoting to a stable `3.0.0` is `pnpm changeset pre exit`, then the release PR that follows.
