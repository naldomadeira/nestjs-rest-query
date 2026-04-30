# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | ✅        |

Older internal versions (published as `@multitechbr/nestjs-dynamic-query-builder`) are not supported.

## Reporting a Vulnerability

**Please do not open a public issue for security vulnerabilities.**

Email: **naldomadeira@gmail.com**

Include:

- Affected version(s)
- Steps to reproduce
- Potential impact
- Suggested fix (if any)

You will receive an acknowledgement within 48 hours and a status update within 7 days. Coordinated disclosure timelines will be discussed case by case.

## Security model

`nestjs-rest-query` is whitelist-first: every filterable, sortable, selectable, includable, or searchable field must be explicitly declared in `RulesConfig` per endpoint. Any query parameter not on the whitelist is silently ignored.

This is the primary defense against unsafe field exposure. Consumers are responsible for:

- Keeping `RulesConfig` minimal (least privilege).
- Not exposing internal columns (e.g. password hashes, internal flags) in `fields` or `sorts`.
- Layering authentication/authorization (e.g. NestJS guards) above the query builder.
- Validating tenant scoping on the controller before the query reaches the service.
