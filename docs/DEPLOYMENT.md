# Deployment

## GitHub

This workspace should be pushed to a GitHub repository before connecting Netlify.

```bash
git init
git add .
git commit -m "Prepare Anonymail beta for Netlify"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/anonymail.git
git push -u origin main
```

## Netlify

Create a Netlify site from the GitHub repository.

- Framework preset: Astro.
- Base directory: empty.
- Build command: `pnpm zip && pnpm --filter @anonymail/site build`.
- Publish directory: `apps/site/dist`.
- Node version: `22`.
- Site subdomain: choose the available Netlify site name in the dashboard.

The beta download URL is `/downloads/anonymail-beta.zip`. Netlify creates that ZIP during the build, then Astro copies it into the published site.
