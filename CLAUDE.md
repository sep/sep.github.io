# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this repo is

This is `sep/sep.github.io`, the SEP org's GitHub Pages site: **FOSSS**, an Astro static
site listing SEP's open-source repos. **`FOSSS.md` is the development brief and the source
of truth** for scope, architecture, data pipeline, and brand tokens; where it is silent,
prefer the simplest option that keeps v1 shippable. Until 2026 it was "SEP Bits and Bytes",
a 2012-era Jekyll-Bootstrap blog — that site's deployed output is frozen verbatim in
`public/archive/` (served at `/archive/`, with `/archive/`-prefixed paths and an injected
banner), and its source lives in git history before the FOSSS rewrite. Never modernize,
restyle, or regenerate the archive; its period-correct look is intentional (including four
relative links that were already broken on the 2012 site).

`fosss-brand-assets.zip` (repo root, deliberately untracked — don't commit it) holds SEP
brand SVG illustrations (bold + `-light` variants), the icon library, and the SEP logo as
EPS. Copy only the assets actually used into `src/assets/`; never redraw or recolor the
logo. The footer's `sep-logo-snow.svg` was faithfully exported from `SEP_LINEAR_WHITE.eps`
via `gs -dEPSCrop -sDEVICE=pdfwrite` + `pdftocairo -svg`.

## Commands

```sh
npm run dev                    # dev server against the live GitHub API
FOSSS_FIXTURES=1 npm run dev   # against src/lib/fixtures.js, offline
npm run build                  # static build to dist/
npm run update-registry        # refresh data/registry.json locally
```

Node ≥ 20 required (`.nvmrc` says 22); the default shell node here is 16, so prefix with
`PATH="/opt/homebrew/opt/node/bin:$PATH"` (node 25). Unauthenticated GitHub API is fine
locally (60 req/hr); set `GITHUB_TOKEN` (e.g. `$(gh auth token)`) to use 5,000/hr.
Static output only — no SSR, no adapters. Zero client-side JS unless a feature genuinely
needs it (a filter island at most).

## Architecture

- **Build-time data pipeline** (`src/lib/github.js`): fetch all public `sep`-org repos via
  plain `fetch` against the GitHub REST API (no SDK), filter to repos with the `sep-oss`
  topic that are not archived/private (forks qualify — the topic is the curation; the
  brief's original `fork == false` rule was amended 2026-09-11), sort by `pushed_at` desc
  (`sortRepos` is the
  one place order is defined). The published site makes zero API calls from browsers. API
  errors throw and fail the build loudly — keep it that way.
- **`data/registry.json`**: committed state file recording `first_seen` / `last_seen` /
  delisting dates per repo (GitHub topics carry no timestamps). Maintained by
  `scripts/update-registry.mjs`, callable locally and run weekly in CI. Human-read only in
  v1 — no UI built on it. Never silently delete history; delisted repos move to a
  `delisted` section, and a repo that re-opts-in keeps its original `first_seen`.
- **CI**: one workflow, `.github/workflows/build-and-deploy.yml` — push to main +
  `workflow_dispatch` + Monday 11:00 UTC cron. npm ci → update registry → commit it if
  changed (as `github-actions[bot]`, `[skip ci]`) → Astro build → upload artifact → deploy.
  Per-job permissions: build has `contents: write`, deploy has `pages: write` +
  `id-token: write`. Default `GITHUB_TOKEN` only; no PAT. Pages is set to
  `build_type: workflow` (flipped from legacy 2026-09-04) — never switch it back, or Pages
  will Jekyll-build the Astro source.
- **Pages**: `/` (hero + repo card grid + "how to get listed" + footer, all in
  `src/pages/index.astro` + `src/components/RepoCard.astro`) and `/archive/` (the frozen
  old blog). A card's primary link is the repo's own GitHub Pages site when `has_pages`
  (see `primaryUrl` in `src/lib/github.js`), else the repo; a "source on GitHub" meta link
  appears in the Pages case. No per-repo detail pages, no search, no analytics in v1 — FOSSS.md §9 is the
  explicit v2 parking lot; don't build from it.

## Brand rules (FOSSS.md §7 has the full token table)

- Palette as CSS custom properties in one tokens file; usage priority
  Blue (`#294175`) → Violet → Teal → Burgundy → Gold. v1 likely needs only Blue + Violet
  (+ Gold sparingly). Ink `#0e1425` / Snow `#fbfcfe` for dark/light grounds.
- Public Sans everywhere, self-hosted via `@fontsource/public-sans` (400/500/600) —
  no runtime Google Fonts request.
- Hexagons are the decorative motif; use light illustration variants on dark backgrounds,
  bold on light.
- Voice: direct and human; no "world-class"/"cutting-edge"; employees are "SEPeers".

## Archive provenance (context, not a recipe)

`public/archive/` was made once (2026-09-04) by `wget`-mirroring the then-live deployed
site — not by rebuilding Jekyll — then mechanically prefixing root-relative URLs with
`/archive/`, injecting the banner, and copying theme assets from the old repo tree. One
deliberate deviation from verbatim: the deployed pages linked
`/assets/themes//css/style.css` (empty theme name — a config bug that 404'd for years, so
the live blog rendered unstyled); the archive points that href at the `the-program` theme
CSS the templates were built for. Post URLs are extensionless and rely on GitHub Pages
(and Astro preview) resolving `/archive/.../echo` → `echo.html`.
