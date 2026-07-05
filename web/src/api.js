export async function api(path, opts = {}) {
  const init = { method: opts.method || (opts.body ? 'POST' : 'GET') };
  if (opts.body instanceof FormData) {
    init.body = opts.body;
  } else if (opts.body) {
    init.headers = { 'Content-Type': 'application/json' };
    init.body = JSON.stringify(opts.body);
  }
  let res;
  try {
    res = await fetch('/api' + path, init);
  } catch {
    // NFR-2: graceful offline failure for writes
    throw new Error(navigator.onLine === false
      ? "You're offline — this will work again once you're connected."
      : 'Could not reach the server. Try again in a moment.');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong');
  return data;
}

export function timeAgo(sqlDate) {
  const d = new Date(sqlDate.replace(' ', 'T') + 'Z');
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (s < 90) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400 * 1.5) return `${Math.round(s / 3600)} hr ago`;
  if (s < 86400 * 14) return `${Math.round(s / 86400)} days ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export function fmtDate(iso, withYear = false) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}${withYear ? ', ' + y : ''}`;
}
export function fmtRange(start, end) {
  if (!start || !end) return '';
  const [ys] = start.split('-').map(Number);
  const [ye] = end.split('-').map(Number);
  return `${fmtDate(start, ys !== ye)} – ${fmtDate(end, true)}`;
}
