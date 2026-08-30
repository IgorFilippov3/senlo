# Contributing to Senlo

Thanks for taking the time to contribute. Senlo is a small project with a single maintainer, so clear, focused contributions are genuinely appreciated.

## Contributor License Agreement

Before your first pull request can be merged, you need to sign the [Contributor License Agreement](./CLA.md). An automated check will prompt you on the pull request itself — you sign by posting one comment. It takes a few seconds and covers all of your future contributions.

**Why this exists.** Senlo is licensed under AGPL-3.0 and the core will stay open source. A managed, hosted version is planned, and that model only works if one party can license the codebase on different terms. Without a CLA, every contributor holds copyright over their own patch, which means no licensing decision can ever be made again without tracking down every person who ever sent a pull request.

**What it does and does not do.** You keep the copyright to your work. The CLA is a licence grant, not a transfer of ownership — you can still use, publish, or relicense your own code anywhere else. What it gives the maintainer is the right to distribute your contribution under terms other than AGPL, which is what makes the hosted version possible.

If you are contributing on behalf of a company, ask your legal team about the employer clause in section 4 before signing.

## Getting started

Senlo is a pnpm monorepo. You will need Node.js 20+, pnpm, PostgreSQL, and Redis.

```bash
pnpm install
cp deploy/vps/env.example .env   # then fill in DATABASE_URL, REDIS_URL, AUTH_SECRET
pnpm db:push                      # apply the schema
pnpm dev                          # web app on :3000
pnpm worker                       # background workers, in a second terminal
```

`AUTH_SECRET` can be generated with `openssl rand -base64 32`.

## Repository layout

```
apps/web                     Next.js app — UI, API routes, worker entrypoint
packages/core                domain services, queues, email renderer, provider adapters
packages/db                  Drizzle schema and repositories
packages/editor              visual email editor
packages/ui                  shared component library
packages/features            shared business UI
packages/automation-builder  workflow canvas
```

Business logic belongs in `packages/core`. API routes in `apps/web` should stay thin and delegate to services.

## Project conventions

These are enforced in review, so it saves everyone time to follow them up front:

- **Package versions.** If you change anything inside `packages/`, bump that package's patch version in its `package.json` (`0.0.1` → `0.0.2`).
- **Changelog.** Add an entry to `CHANGELOG.md` under `## [Unreleased]` describing what you added, changed, or fixed.
- **Cross-package imports.** Always use `import type` when importing types between packages. This keeps Node dependencies out of client bundles and avoids circular imports.
- **Type checking.** Run `tsc --noEmit` (the `build` script in each package). Do not commit build output.
- **Database access.** Repositories receive the database instance through their constructor. Do not import a global `db` inside `packages/db`.
- **UI components.** Shared components stay framework-agnostic — data through props, navigation through link renderer props, no direct Next.js imports.
- **Email rendering.** Email clients handle `box-shadow` poorly. For hard shadows (blur 0), always add a fallback using individual borders, and always include `px` units in `box-shadow` strings so the editor preview matches.

## Pull requests

- One logical change per pull request. Large mixed PRs are hard to review and tend to sit unmerged.
- Open an issue first for anything substantial, so we can agree on the approach before you spend time on it.
- Describe what changed and why. If it touches the editor or the automation canvas, a screenshot or short clip helps a lot.
- Make sure `tsc --noEmit` passes across the workspace.

## Using AI tools

You are welcome to use AI assistance. You remain responsible for every line you submit: it must be your original work, you must understand it, and you must be entitled to grant the licences in the CLA. Pull requests that are clearly unreviewed machine output will be closed.

## Reporting bugs

Open an issue with the version or commit you are on, your deployment method, what you expected, what happened, and relevant logs from `docker compose logs -f app` or `worker`. Redact API keys and provider credentials.

## Security

Do not report security issues in public issues. Email the maintainer at the address on the [GitHub profile](https://github.com/IgorFilippov3) instead.

## Licence

By contributing, you agree that your contributions are licensed under AGPL-3.0 and are subject to the [CLA](./CLA.md).
