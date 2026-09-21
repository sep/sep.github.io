# FOSSS

> The second S is for SEP.

Static landing page showcasing free & open source software released by SEPeers, live at
[sep.github.io](https://sep.github.io/). Built with [Astro](https://astro.build), deployed to
GitHub Pages by CI, rebuilt every Monday.

## How a repo gets listed

Add the `sep-oss` topic to any public, non-archived repo in the
[sep org](https://github.com/sep) — forks included, so personal projects can be forked
into the org to be listed. It appears on the next build (Mondays 11:00 UTC, or
[dispatch the workflow](../../actions/workflows/build-and-deploy.yml) manually). Remove the
topic to delist.

## Development

```sh
npm install
npm run dev              # against the live GitHub API
FOSSS_FIXTURES=1 npm run dev   # against fixture data, offline
npm run build            # static output in dist/
npm run update-registry  # refresh data/registry.json locally
```

Unauthenticated API calls are fine locally (60/hr). CI uses the workflow's `GITHUB_TOKEN`.

## Pieces

- `src/lib/github.js` — build-time fetch + filter of org repos (the site ships zero client JS)
- `data/registry.json` — committed record of when each repo first opted in / delisted;
  maintained weekly by CI, read by humans
- `public/archive/` — frozen snapshot of the old "SEP Bits and Bytes" Jekyll blog, served at
  [/archive/](https://sep.github.io/archive/); its source lives in git history before the
  FOSSS rewrite
- `FOSSS.md` — the original development brief

<sub>SOFTWARE that matters more</sub>
