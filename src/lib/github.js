/**
 * Build-time GitHub data pipeline (FOSSS.md §3). All API access happens here,
 * at build time — the published site makes zero API calls from browsers.
 */

const ORG = 'sep';
const OPT_IN_TOPIC = 'sep-oss';

/**
 * Where a card's primary link points: the repo's GitHub Pages site when it has
 * one, else the repo itself. Org project sites live at sep.github.io/<name>/
 * (GitHub redirects from there when a custom domain is configured) — except
 * this very repo, whose Pages site is the org root.
 */
export const primaryUrl = (repo) =>
  !repo.has_pages ? repo.html_url
  : repo.name === 'sep.github.io' ? 'https://sep.github.io/'
  : `https://sep.github.io/${repo.name}/`;

/** Default sort: most recently pushed first. Swap this to change the grid order. */
export const sortRepos = (repos) =>
  [...repos].sort((a, b) => Date.parse(b.pushed_at) - Date.parse(a.pushed_at));

// Forks qualify too: adding the topic to an org repo is already a deliberate
// act, so the topic is the whole curation model (rule amended 2026-09-11).
const qualifies = (repo) =>
  (repo.topics ?? []).includes(OPT_IN_TOPIC) &&
  repo.archived === false &&
  repo.private === false;

/**
 * Fetch every public repo in the org (paginated) and return the qualifying
 * set, sorted. Throws on any API failure — a red build beats a silent empty page.
 */
export async function fetchQualifyingRepos({ token = process.env.GITHUB_TOKEN } = {}) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'fosss-build',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const repos = [];
  for (let page = 1; ; page++) {
    const url = `https://api.github.com/orgs/${ORG}/repos?per_page=100&type=public&page=${page}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      throw new Error(`GitHub API ${res.status} ${res.statusText} for ${url}: ${await res.text()}`);
    }
    const batch = await res.json();
    repos.push(...batch);
    if (batch.length < 100) break;
  }

  return sortRepos(repos.filter(qualifies));
}
