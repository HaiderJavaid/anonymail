# Anonymail

Anonymail is a privacy-first Chrome extension that creates one disposable inbox, generates a separate signup password, fills signup forms, and keeps incoming mail in a side panel or dashboard tab.

## Development

```bash
pnpm install
pnpm dev
pnpm dev:site
```

The extension is loaded from `apps/extension/.output/chrome-mv3` in Chrome Developer Mode. The landing page runs separately through Astro.

## Checks

```bash
pnpm build
pnpm typecheck
pnpm lint
pnpm test
pnpm zip
```

## Netlify

The static site is configured through `netlify.toml`.

- Build command: `pnpm zip && pnpm --filter @anonymail/site build`
- Publish directory: `apps/site/dist`

`pnpm zip` creates the latest extension ZIP and copies it into the site before Astro builds, so `/downloads/anonymail-beta.zip` always points to the current beta package.

Read [`docs/HANDOFF.yaml`](docs/HANDOFF.yaml) first when resuming work.
