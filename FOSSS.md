# FOSSS — Free & Open Source Software from SEP

> **FOSSS: the second S is for SEP.**

This document is the development brief for building FOSSS, a static landing page showcasing
open-source projects released to the public by SEPeers. It replaces the outdated static site
currently living in the `sep` GitHub organization. Follow this document as the source of truth
for scope, architecture, and brand decisions. Where this doc is silent, prefer the simplest
option that keeps v1 shippable.

---

## 1. What we're building

A single-page (plus archive) static site, hosted on **GitHub Pages**, that:

1. Lists public repositories in the `sep` GitHub org that have **opted in** via the
   `sep-oss` repo topic.
2. Rebuilds itself **weekly** via GitHub Actions (plus on push and manual dispatch),
   re-fetching the repo list at build time.
3. Maintains a small committed state file (`data/registry.json`) recording when each repo
   was first seen, giving us our own dating history (GitHub topics carry no timestamps).
4. Preserves the **current contents of the old site** under `/archive/`, formatting intact.
5. Carries SEP's corporate look and feel (palette, typography, hexagon motifs) — tokens
   specified in §7.

**Explicitly out of scope for v1** (see §9 for the v2 parking lot): detail pages per repo,
automated "still relevant?" issue pings, staleness indicators in the UI, non-repo artifacts
(npm/PyPI packages), search backends, analytics.

---

## 2. Tech stack

- **Astro** (latest stable) — static output mode. No SSR, no adapters.
- **GitHub Actions** for build + deploy to GitHub Pages (`withastro/action` or the standard
  `actions/upload-pages-artifact` + `actions/deploy-pages` pair — prefer the official Astro
  action unless it fights the registry-commit step, in which case compose manually).
- **No client-side JavaScript** unless a feature genuinely needs it. The repo grid is plain
  HTML rendered at build time. If a language/topic filter is added, implement it as a single
  small Astro island; everything else ships zero JS.
- Plain CSS or scoped Astro styles with CSS custom properties for the brand tokens. Tailwind
  is permitted but not required — don't add it just for this.
- Node LTS. Keep dependencies minimal; no GitHub SDK needed — plain `fetch` against the REST
  API is sufficient.

---

## 3. Data pipeline (build time)

All GitHub API access happens **at build time inside the Actions runner**. The published site
makes zero API calls from visitors' browsers.

### 3.1 Fetch

- `GET https://api.github.com/orgs/sep/repos?per_page=100&type=public` — paginate until
  exhausted.
- Authenticate with the workflow's built-in `GITHUB_TOKEN` (5,000 req/hr — we'll use a
  handful). Send `Accept: application/vnd.github+json`. Topics are included in the standard
  repo objects; no separate topics endpoint call is needed.
- Fail the build loudly on API errors — a silent empty page is worse than a red workflow run.

### 3.2 Filter (inclusion rules)

A repo appears on FOSSS iff **all** of:

- `topics` contains `sep-oss`  ← the opt-in switch; this is the whole curation model
- `archived == false`
- `private == false` (should be guaranteed by the query, but assert anyway)

No star/recency heuristics. Inclusion is a deliberate act by the repo owner: add the topic to
appear, remove it to delist.

> **Amended 2026-09-11**: the original `fork == false` rule was dropped. Adding the topic to
> an org repo already requires deliberate action by someone with org access, so the topic is
> curation enough — and this lets SEPeers fork a personal project into the org to have it
> listed. Note the card shows the org fork's own star count and push date, not the upstream's.

### 3.3 Sort & render

- Default sort: `pushed_at` descending (most recently active first). Keep this in one obvious
  constant so it's easy to change.
- Each repo renders as a **card that links directly to the repo on GitHub** (no detail pages).
  *(Amended 2026-09-11: when the repo has a GitHub Pages site (`has_pages`), the card's
  primary link points there — `https://sep.github.io/<name>/` — and a small "source on
  GitHub" link in the meta row keeps the repo reachable.)*
  Card contents:
  - Repo name (link)
  - `description` — **only if present**; cards without one render more compactly. Never
    invent or placeholder a description.
  - Primary `language` (if present)
  - Star count (`stargazers_count`)
  - Last push, humanized ("updated 3 weeks ago") from `pushed_at`
- Handle the empty state: if zero repos qualify, render a friendly "nothing tagged yet —
  add the `sep-oss` topic to a public repo to appear here" message, not a blank page.

### 3.4 Registry state file — `data/registry.json`

A committed, append-friendly JSON file the weekly workflow maintains. Purpose: GitHub's API
does not timestamp topics, so this file is our record of *when each repo first opted in* and
what the pipeline last saw. It is currently **read by humans, not by the site** — do not
build UI on it in v1.

Suggested shape (adjust field names if something cleaner emerges, but keep it flat and
diff-friendly):

```json
{
  "repos": {
    "sep/some-tool": {
      "first_seen": "2026-09-08",
      "last_seen": "2026-09-08",
      "last_pushed_at": "2026-08-30T14:11:00Z"
    }
  },
  "delisted": {
    "sep/old-thing": { "first_seen": "2026-09-08", "delisted_on": "2026-11-02" }
  }
}
```

Workflow behavior each run:
- New qualifying repo → add with `first_seen` = today.
- Existing repo still qualifying → update `last_seen` / `last_pushed_at`.
- Previously-listed repo no longer qualifying → move to `delisted` with the date. Never
  silently delete history.
- If the file changed, commit it back to the repo with a `[skip ci]`-style guard or a commit
  message convention so the registry commit doesn't trigger a redundant second build. Use
  `github-actions[bot]` as the committer.

---

## 4. GitHub Actions

One workflow, `.github/workflows/build-and-deploy.yml`, triggered by:

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:
  schedule:
    - cron: "0 11 * * 1"   # Mondays 11:00 UTC ≈ 6/7am Indianapolis
```

Jobs, in order: checkout → fetch + filter repos → update/commit `registry.json` if changed →
Astro build → deploy to Pages.

Notes and gotchas to encode in the workflow:

- **Permissions**: the job needs `contents: write` (registry commit), `pages: write`, and
  `id-token: write` (Pages deploy). Grant per-job, not globally.
- **Scheduled-workflow expiry**: GitHub disables `schedule:` triggers after ~60 days without
  repo activity. The weekly registry commit usually counts as activity and keeps it alive —
  but if a run produces no registry change, there's no commit. Add a comment in the workflow
  noting this, and prefer the simple mitigation: the registry's `last_seen` fields update
  every run, so a weekly commit will in practice always occur while any repo is listed. If
  the org ever has zero listed repos for two months, re-enabling the workflow manually is
  acceptable for v1.
- The default `GITHUB_TOKEN` is sufficient for **reading** public org repos. Do not add a
  PAT; nothing in v1 needs cross-repo write access.

---

## 5. Site structure

```
/                    → FOSSS landing page (hero + repo card grid + footer)
/archive/            → preserved old site, served verbatim (see §6)
```

Landing page anatomy:

- **Hero**: "FOSSS" wordmark treatment, tagline "the second S is for SEP", one sentence of
  what the page is ("Open-source software released by SEPeers"), on a dark Ink/Blue
  background with hexagon decorative elements.
- **Card grid**: responsive, 1-col mobile → 2–3 col desktop.
- **How to get listed**: a short section telling SEPeers the rule — *public repo in the
  `sep` org + `sep-oss` topic = listed next Monday*. This makes the site self-documenting.
- **Footer**: SEP logo (Snow variant on dark), link to sep.com, link to `/archive/`
  ("Looking for the old site?"), link to the FOSSS repo itself.

---

## 6. Archive of the existing site

Preserve the current site's content **and formatting** under `/archive/`.

1. **Identify what's deployed today.** Inspect the existing repo. If it's plain HTML/CSS,
   copy it as-is. If it's Jekyll source (look for `_config.yml`, `_layouts/`), run one final
   `jekyll build` and archive the **built output** (`_site/`), not the source. This is a
   **one-time operation** — the archive is a snapshot, never part of the weekly rebuild.
2. **Location**: put the snapshot in `public/archive/`. Astro copies `public/` to the build
   output verbatim, so it's served untouched at `/archive/`.
3. **Path fixups**: old GitHub Pages sites commonly use root-relative URLs
   (`/css/style.css`, `/about.html`). Rewrite root-relative references to be
   `/archive/`-prefixed (or relative) so nothing 404s under the new prefix. Do this
   mechanically, then verify by crawling/clicking every page and checking the network panel
   for 404s.
4. **Banner**: inject one thin, self-contained banner at the top of each archived HTML page:
   *"📦 You're viewing the archived SEP site — see the current FOSSS page."* linking to `/`.
   Inline its styles (or a single `/archive/_banner.css`) so it can't collide with or depend
   on the new site's CSS. Do not otherwise restyle archived pages — the period-correct look
   is the point.

---

## 7. Brand: look and feel

FOSSS should read unmistakably as SEP. Encode the following as CSS custom properties (e.g.
`--color-ink`, `--color-blue`, …) in one tokens file.

### 7.1 Palette

| Token | Hex | Role |
|---|---|---|
| Ink | `#0e1425` | Dark backgrounds, primary dark text |
| Snow | `#fbfcfe` | Light backgrounds, text on dark |
| Blue Dark | `#1b2a4b` | Deep background variation |
| **Blue Main** | **`#294175`** | **Primary — start here for everything** |
| Blue Mid / Light / Lightest | `#9ab2e4` / `#bccef5` / `#e7edfd` | Tints |
| Violet Main | `#513986` | First accent — callouts, secondary emphasis |
| Violet Mid / Light / Lightest | `#9c7edd` / `#d0baff` / `#eee5ff` | Tints |
| Teal | `#006368` | Second accent, only if needed |
| Burgundy | `#811942` | Third accent, only if needed |
| Gold | `#ffd375` | Highlight, use sparingly |

Usage priority: **Blue → Violet → Teal → Burgundy → Gold**. Do not use all five accents;
v1 likely needs only Blue + Violet + perhaps Gold for one highlight (e.g. star counts).
All dark brand colors (Ink, Blue Main, Violet, Teal, Burgundy) hit 4.5:1 contrast on Snow
and on Gold — stay within those pairings for text.

### 7.2 Typography

- **Public Sans** everywhere (free Google Font — self-host via `@fontsource/public-sans`
  rather than a runtime Google Fonts request).
- Headlines: Public Sans **Medium** (500). Body: **Regular** (400). Emphasis/callouts:
  **SemiBold** (600).
- Fallback stack: `"Public Sans", Arial, sans-serif`.

### 7.3 Motifs & assets

- **Hexagons** are SEP's signature decorative element — use outlined/filled hexagon accents
  in the hero and section dividers rather than inventing new ornament.
- An asset bundle (`fosss-brand-assets.zip`, delivered alongside this doc) contains SEP's
  house-style **illustration SVGs** (bold + light variants; `development-illustration*.svg`
  and `web-illustration*.svg` are natural fits for the hero/empty-state) and the **icon SVG
  library**. Use light variants on dark backgrounds, bold variants on light. Drop what you
  use into `src/assets/`; don't ship the whole library in the build.
- The official SEP logo files are EPS (print vector). For the footer logo, export/trace an
  SVG faithfully from the EPS or request a web SVG from Marketing — **never redraw, recolor,
  or alter the logo**. Logo appears in Snow (`#fbfcfe`) on dark backgrounds, Ink (`#0e1425`)
  on light. No other logo colors exist.

### 7.4 Voice

Direct and human. No "world-class," "cutting-edge," or "best-in-class." Employees are
**SEPeers**. Tagline available if wanted in the footer: *SOFTWARE that matters more*.

---

## 8. Suggested build order

1. Scaffold Astro project; tokens file with palette + Public Sans; base layout.
2. Static repo-card grid against a hardcoded fixture of 3 fake repos (design pass:
   hero, cards, footer, responsive check).
3. Build-time fetch + filter module with the fixture swapped for the real API; empty-state
   handling; error handling that fails the build.
4. `registry.json` read/update logic as a small script callable both locally and in CI.
5. GitHub Actions workflow: build + deploy on push; then add cron + registry commit step.
6. Archive: snapshot old site into `public/archive/`, path fixups, banner, 404 sweep.
7. Polish: meta tags/OpenGraph, favicon (hexagon mark), Lighthouse pass (this site should
   score ~100 across the board — it's static HTML).

Definition of done for v1: site live on GitHub Pages, Monday cron proven with at least one
successful scheduled run committing a registry update, at least one real repo listed via the
`sep-oss` topic, archive browsable with no broken assets.

---

## 9. v2 parking lot (do not build now)

- **Staleness issue-bot**: after N months listed (12) with no push in 6, open an issue on
  the repo ("still good to showcase? close to confirm, remove `sep-oss` to delist").
  Requires a fine-grained PAT or GitHub App with org-wide `issues: write` — an ops decision.
- Staleness/"last confirmed" indicators rendered on cards (data already accrues in
  `registry.json`).
- Client-side language/topic filter island.
- Non-repo artifacts: npm/PyPI packages published by SEPeers.
- Per-project detail pages.
