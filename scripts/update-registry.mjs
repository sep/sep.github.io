#!/usr/bin/env node
/**
 * Maintains data/registry.json (FOSSS.md §3.4): our own record of when each
 * repo first opted in via the `sep-oss` topic, since GitHub topics carry no
 * timestamps. Runs weekly in CI and is safe to run locally:
 *
 *   node scripts/update-registry.mjs
 *
 * Exit code 0 either way; prints "changed" or "unchanged" and writes the file
 * only when something moved. Human-read history — never silently deletes.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { fetchQualifyingRepos } from '../src/lib/github.js';

const REGISTRY_PATH = fileURLToPath(new URL('../data/registry.json', import.meta.url));

const today = new Date().toISOString().slice(0, 10);
const registry = JSON.parse(readFileSync(REGISTRY_PATH, 'utf8'));
const before = JSON.stringify(registry);

const seen = new Set();
for (const repo of await fetchQualifyingRepos()) {
  const key = repo.full_name;
  seen.add(key);
  // A delisted repo that re-adds the topic comes back, keeping its original first_seen.
  const revived = registry.delisted[key];
  if (revived) delete registry.delisted[key];
  const entry = registry.repos[key] ?? revived ?? { first_seen: today };
  delete entry.delisted_on;
  entry.last_seen = today;
  entry.last_pushed_at = repo.pushed_at;
  registry.repos[key] = entry;
}

for (const [key, entry] of Object.entries(registry.repos)) {
  if (!seen.has(key)) {
    delete registry.repos[key];
    registry.delisted[key] = { ...entry, delisted_on: today };
  }
}

if (JSON.stringify(registry) === before) {
  console.log('registry unchanged');
} else {
  writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2) + '\n');
  console.log('registry changed');
}
