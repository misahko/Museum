const V_KEY       = 'museum_visitors_v1';
const G_KEY       = 'museum_guestbook_v1';
const SEEN_KEY    = 'museum_seen_v1';    // sessionStorage — resets when tab closes
const RECENT_KEY  = 'museum_recent_v1'; // localStorage — persists across sessions
const MAX_RECENT  = 20;

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}
function loadSeen() {
  try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
}

/**
 * Record a museum as recently visited.
 * Keeps the 20 most recent unique museums, newest first.
 * Backend: POST /api/users/me/recent  { museumId, name }
 */
export function recordRecent(museumId, name) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    const entry = { id: museumId, name, visitedAt: new Date().toISOString() };
    const filtered = list.filter(e => e.id !== museumId); // remove old entry if exists
    const updated = [entry, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {}
}

/**
 * Get recently visited museums, newest first.
 * Backend: GET /api/users/me/recent
 */
export function getRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]'); } catch { return []; }
}

/**
 * Remove a single entry from recent history.
 * Backend: DELETE /api/users/me/recent/:museumId
 */
export function removeRecent(museumId) {
  try {
    const list = JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]');
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.filter(e => e.id !== museumId)));
  } catch {}
}

/**
 * Clear all recent history.
 * Backend: DELETE /api/users/me/recent
 */
export function clearRecent() {
  localStorage.removeItem(RECENT_KEY);
}

/**
 * Record a visit from the public gallery.
 * Only increments if this browser session hasn't visited the museum yet.
 * Backend: POST /api/museums/:id/visit
 */
export function recordVisit(museumId) {
  const seen = loadSeen();
  if (seen.includes(museumId)) return getVisits(museumId); // already counted this session
  seen.push(museumId);
  sessionStorage.setItem(SEEN_KEY, JSON.stringify(seen));
  const obj = load(V_KEY);
  obj[museumId] = (obj[museumId] ?? 0) + 1;
  localStorage.setItem(V_KEY, JSON.stringify(obj));
  return obj[museumId];
}

export function getVisits(museumId) {
  return load(V_KEY)[museumId] ?? 0;
}

export function addEntry(museumId, author, message) {
  const obj = load(G_KEY);
  if (!obj[museumId]) obj[museumId] = [];
  obj[museumId].unshift({
    id: Date.now().toString(),
    author: author.trim() || 'Anonymous',
    message: message.trim(),
    date: new Date().toISOString(),
  });
  obj[museumId] = obj[museumId].slice(0, 100);
  localStorage.setItem(G_KEY, JSON.stringify(obj));
  return obj[museumId];
}

export function getEntries(museumId) {
  return load(G_KEY)[museumId] ?? [];
}
