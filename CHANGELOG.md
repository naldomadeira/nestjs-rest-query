# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0

### Added

- First public open source release as `nestjs-rest-query` on npm.
- `RestQuery*` API rename roadmap (planned for next major).
- TypeORM support (Prisma and Drizzle coming soon).

### Changed

- Package renamed from `@multitechbr/nestjs-dynamic-query-builder` (private GitLab) to `nestjs-rest-query` (public npm).
- License changed from ISC to **MIT**.

### Removed

- GitLab CI configuration (replaced by GitHub Actions).
- Internal `@multitechbr` registry references.

See [MIGRATION.md](./MIGRATION.md) for the upgrade path from the internal package.
