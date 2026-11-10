# Contributing to Senlo

Thanks for taking the time to contribute. Senlo is a small project with a single maintainer, so clear, focused contributions are genuinely appreciated.

- Looking for something to work on? Start with issues labelled [`good first issue`](https://github.com/IgorFilippov3/senlo/labels/good%20first%20issue), then [`help wanted`](https://github.com/IgorFilippov3/senlo/labels/help%20wanted).
- Have a question or an idea that is not a concrete task yet? Use [Discussions](https://github.com/IgorFilippov3/senlo/discussions).
- Want to take an issue? Comment on it first so two people do not build the same thing.

## Contributor License Agreement

Before your first pull request can be merged, you need to sign the [Contributor License Agreement](./CLA.md). An automated check will prompt you on the pull request itself: you sign by posting one comment. It takes a few seconds and covers all of your future contributions.

**Why this exists.** Senlo is licensed under AGPL-3.0 and the core will stay open source. A managed, hosted version exists too, and that model only works if one party can license the codebase on different terms. Without a CLA, every contributor holds copyright over their own patch, which means no licensing decision can ever be made again without tracking down every person who ever sent a pull request.

**What it does and does not do.** You keep the copyright to your work. The CLA is a licence grant, not a transfer of ownership: you can still use, publish, or relicense your own code anywhere else. What it gives the maintainer is the right to distribute your contribution under terms other than AGPL, which is what makes the hosted version possible.

If you are contributing on behalf of a company, ask your legal team about the employer clause in section 4 before signing.

## Run it locally in 5 minutes

You need Node.js 20.12+, pnpm 10 (`corepack enable` picks the pinned version), and Docker for Postgres and Redis.

```bash
git clone https://github.com/<you>/senlo.git && cd senlo
pnpm install

# 1. Postgres and Redis
docker run -d --name senlo-pg -p 5432:5432 \
  -e POSTGRES_USER=senlo -e POSTGRES_PASSWORD=senlo -e POSTGRES_DB=senlo \
  postgres:15-alpine
docker run -d --name senlo-redis -p 6379:6379 redis:7-alpine

# 2. Environment: the web app and the worker read apps/web/.env,
#    drizzle-kit (db:push) reads .env in the repo root
cp deploy/vps/env.example apps/web/.env
echo 'DATABASE_URL=postgresql://senlo:senlo@localhost:5432/senlo' > .env
```

In `apps/web/.env` set at least:

```bash
DATABASE_URL=postgresql://senlo:senlo@localhost:5432/senlo
REDIS_URL=redis://localhost:6379
AUTH_SECRET="<openssl rand -base64 32>"
APP_URL="http://localhost:3001"
```

Then:

```bash
pnpm db:push     # apply the schema
pnpm db:backfill-stats  # daily statistics from existing history (once)
pnpm db:upgrade-automations  # automations to the versioned format (once)
# if db:push stops on a duplicate key in workflow_executions, run first:
# pnpm db:upgrade-automations --before-push
pnpm dev         # web app on http://localhost:3001
pnpm worker      # queues and automations, in a second terminal
```

Open http://localhost:3001, create an account, and you land in an example project with ready-made templates. To actually send mail, add a provider on the **Providers** page; a free Resend account or a local SMTP catcher such as Mailpit is enough.

## Tests and type checking

Tests use [Vitest](https://vitest.dev) and need no database or Redis.

```bash
pnpm test:core      # packages/core: services, renderer, blocks, queues
pnpm test:editor    # packages/editor: editor state
pnpm test:next      # packages/next: route handlers, loaders, actions
pnpm test           # all of the above

pnpm test:core:update     # refresh renderer snapshots after an intended change
pnpm test:editor:update
```

Type checking: every package's `build` script is `tsc --noEmit`.

```bash
pnpm -r --filter "./packages/*" run build   # all packages
pnpm --filter web exec tsc --noEmit         # the Next.js app
```

A pull request should pass the tests of every package it touches and the type check. If you change rendered HTML on purpose, update the snapshots and say so in the PR.

## Repository layout

```
apps/web                     Next.js app: pages, route files, worker entrypoint
packages/core                domain types, services, email renderer, mail adapters, queues
packages/db                  Drizzle schema and repositories
packages/next                Next.js glue: route handlers, server actions, loaders
packages/editor              visual email editor
packages/ui                  shared component library
packages/features            shared business screens (providers, dashboard, API docs...)
packages/automation-builder  workflow canvas
```

## Project rules

These are checked in review, so following them up front saves everyone a round trip.

**Import packages only through their `exports`.** Each `package.json` lists its public entry points; deep imports like `@senlo/core/src/...` are not allowed.

| Entry | What it is for |
| --- | --- |
| `@senlo/core` | types, renderer, validation: safe in browser code |
| `@senlo/core/server` | services and mail adapters, server code only |
| `@senlo/core/queue` | BullMQ queues and workers |
| `@senlo/next`, `@senlo/next/client` | route handlers and server actions / client hooks |
| `@senlo/features`, `@senlo/features/api-docs`, `@senlo/features/workflow-editor` | business screens |

**Types across packages go through `import type`.** This keeps Node code out of client bundles and avoids circular imports. Client-side packages (`editor`, `ui`, `features`, `automation-builder`) may import runtime values from the `@senlo/core` root only, never from `/server` or `/queue`.

**Logic lives in core services.** Business rules, validation and anything that touches the database belong in a service in `packages/core/src/services`. Route files in `apps/web/app/api` are one line (`export const { POST } = routes.triggered;`); the handlers in `packages/next/src/routes.ts` parse the request, call a service and map the result. If you are writing an `if` about business rules in a route or a component, it probably belongs in a service.

**UI is data-agnostic.** Components in `packages/ui`, `packages/editor` and `packages/features` get data through props, navigate through link-renderer props, and never import `next/*`. Only `packages/next` and `apps/web` know about Next.js.

**Database access.** Repositories in `packages/db` receive the database instance through their constructor; do not import a global `db`.

**Bump the patch version.** If you change anything in `packages/<name>`, bump that package's patch version in its `package.json` (`0.0.70` → `0.0.71`). One bump per package per PR is enough.

**Email rendering.** Email clients handle `box-shadow` poorly. For hard shadows (blur 0), always add a fallback using individual borders, and always include `px` units in `box-shadow` strings so the editor preview matches.

**Commit messages** follow Conventional Commits with the package as the scope:

```
feat(core): add Brevo mailer
fix(editor): keep column widths after undo
docs(readme): list Brevo as a provider
test(core): cover PostmarkMailer error mapping
```

Scopes: `core`, `db`, `next`, `editor`, `ui`, `features`, `automation-builder`, `web`, `deploy`, `docs`, `readme`.

## Adding a delivery provider

Senlo sends through the user's own provider. A provider PR is self-contained and a good way to learn the codebase. Use the Postmark adapter as the reference: it is a plain `fetch` call with no SDK. Touch these places, in this order:

1. **Type.** Add the value to `EmailProviderType` in `packages/core/src/domain.ts` and to `emailProviderTypeEnum` in `packages/db/src/schema.ts` (run `pnpm db:push` locally).
2. **Mailer.** Create `packages/core/src/services/mail/<name>Mailer.ts` implementing `IMailer` from `packages/core/src/ports.ts`. Map `SendMailOptions` (`from`, `to`, `subject`, `html`, `text`, `replyTo`, `tags`, `headers`) to the provider's API and return `{ success, messageId }` or `{ success: false, error }`; never throw for an API error. If the provider cannot carry custom headers (`List-Unsubscribe`), say so in a comment as `sesMailer.ts` does.
3. **Factory.** Add a `case` to `MailerFactory.create` in `packages/core/src/services/mail/index.ts` and export the mailer from the same file.
4. **Config.** In `packages/core/src/services/emailProviderService.ts` add the type to `EMAIL_PROVIDER_TYPES`, any new fields to `EmailProviderInputSchema`, every new credential key to `EMAIL_PROVIDER_SECRET_KEYS` (otherwise it is sent to the browser), and a `case` to both `buildProviderConfig` (required fields and their error messages) and `mergeProviderConfig` (an empty secret keeps the stored one).
5. **UI form.** In `packages/features/src/providers/EmailProviderDialog.tsx` add a `SelectItem` and a `{type === "<NAME>" && (...)}` block with the fields.
6. **Tests.** Add `packages/core/src/__tests__/<name>-mailer.test.ts`: stub `fetch` with `vi.stubGlobal`, assert the request body and headers, and cover a success and an API error. Extend `email-provider-service.test.ts` with the required-fields case.
7. **Docs.** Add the provider to the provider lists in `README.md` (Quick Start and "Why Senlo?").
8. **Versions.** Bump `@senlo/core`, `@senlo/db` and `@senlo/features`.

Delivery events (bounces, complaints, opens) are a separate, optional PR: a webhook adapter in `packages/core/src/services/webhook/` (see `postmark.ts`), a handler in `packages/next/src/routes.ts` (see `webhookPostmark`), and a route file `apps/web/app/api/webhooks/<name>/route.ts`.

## Pull requests

- One logical change per pull request. Large mixed PRs are hard to review and tend to sit unmerged.
- Open or comment on an issue first for anything substantial, so we agree on the approach before you spend time on it.
- Describe what changed and why; the template has a short checklist. If it touches the editor or the automation canvas, a screenshot or short clip helps a lot.
- The maintainer writes the changelog entry when merging, so you do not need to.

## Using AI tools

You are welcome to use AI assistance. You remain responsible for every line you submit: it must be your original work, you must understand it, and you must be entitled to grant the licences in the CLA. Pull requests that are clearly unreviewed machine output will be closed.

## Reporting bugs

Use the bug report form. Include the version or commit you are on, your deployment method, what you expected, what happened, and relevant logs (`docker compose logs -f app` or `worker`). Redact API keys and provider credentials.

## Security

Do not report security issues in public issues. Email the maintainer at the address on the [GitHub profile](https://github.com/IgorFilippov3) instead.

## Licence

By contributing, you agree that your contributions are licensed under AGPL-3.0 and are subject to the [CLA](./CLA.md).
