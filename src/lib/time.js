const UNITS = [
  ['year', 365 * 86400],
  ['month', 30 * 86400],
  ['week', 7 * 86400],
  ['day', 86400],
  ['hour', 3600],
];

/** "updated 3 weeks ago" — humanized time since an ISO timestamp. */
export function humanizeSince(iso, now = Date.now()) {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  for (const [unit, span] of UNITS) {
    const count = Math.floor(seconds / span);
    if (count >= 1) return `updated ${count} ${unit}${count === 1 ? '' : 's'} ago`;
  }
  return 'updated just now';
}
