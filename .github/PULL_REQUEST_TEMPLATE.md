## What and why

<!-- What does this change, and why? Link the issue: "Closes #123". -->

## How to check it

<!-- Steps a reviewer can follow. Screenshots or a short clip for editor and canvas changes. -->

## Checklist

- [ ] Tests added or updated, and `pnpm test:core` / `test:editor` / `test:next` pass for the packages I touched
- [ ] Type check passes: `pnpm -r --filter "./packages/*" run build` (and `pnpm --filter web exec tsc --noEmit` if `apps/web` changed)
- [ ] Patch version bumped in `package.json` of every package under `packages/` I changed
- [ ] Imports go through package `exports`; types across packages use `import type`
- [ ] Docs updated where users would look (README, env.example, API reference) or not needed
- [ ] I have signed the [CLA](https://github.com/IgorFilippov3/senlo/blob/main/CLA.md) (the bot will ask on this PR)
