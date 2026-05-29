const V_KEY       = 'museum_visitors_v1';
const G_KEY       = 'museum_guestbook_v1';
const SEEN_KEY    = 'museum_seen_v1'; // sessionStorage — resets when tab closes

function load(key) {
  try { return JSON.parse(localStorage.getItem(key) ?? '{}'); } catch { return {}; }
}
function loadSeen() {
  try { return JSON.parse(sessionStorage.getItem(SEEN_KEY) ?? '[]'); } catch { return []; }
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
