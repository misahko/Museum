/**
 * Museum service — localStorage-backed.
 *
 * Backend integration guide (replace each method body):
 *   getMyMuseums(userId)           → GET  /api/users/:userId/museums
 *   getGallery()                   → GET  /api/museums?published=true
 *   getMuseumById(id)              → GET  /api/museums/:id
 *   create(userId, data)           → POST /api/users/:userId/museums
 *   remove(userId, museumId)       → DELETE /api/museums/:museumId
 *   rename(userId, museumId, name) → PATCH /api/museums/:museumId  { name }
 *   setPublished(userId, id, bool) → PATCH /api/museums/:museumId  { published }
 *   saveVersion(userId, museumId)  → POST  /api/museums/:museumId/versions
 *   getVersions(userId, museumId)  → GET   /api/museums/:museumId/versions
 *   restoreVersion(uid, mid, vid)  → POST  /api/museums/:museumId/versions/:versionId/restore
 *   deleteVersion(uid, mid, vid)   → DELETE /api/museums/:museumId/versions/:versionId
 *
 * Storage layout (single localStorage key):
 *   STORE_KEY → { [userId]: { museums: Museum[] } }
 *
 * Museum shape:
 *   { id, name, rooms, roomCount, published, createdAt, updatedAt, versions: Version[] }
 *
 * Version shape:
 *   { id, label, rooms, savedAt }
 */

const STORE_KEY = 'museum_data_v1';
const MAX_VERSIONS = 10;

// ── Storage helpers ────────────────────────────────────────────────────────────

function load() {
  try { return JSON.parse(localStorage.getItem(STORE_KEY) ?? '{}'); } catch { return {}; }
}
function save(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}
function userMuseums(data, userId) {
  return data[userId]?.museums ?? [];
}
function writeUserMuseums(data, userId, museums) {
  return { ...data, [userId]: { ...data[userId], museums } };
}

// ── Public API ─────────────────────────────────────────────────────────────────

export const museumService = {

  // ── Read ──────────────────────────────────────────────────────────────────

  /** All museums belonging to the given user. */
  async getMyMuseums(userId) {
    return userMuseums(load(), userId);
  },

  /** All museums marked as published (across all users). */
  async getGallery() {
    const data = load();
    return Object.values(data)
      .flatMap(u => u.museums ?? [])
      .filter(m => m.published)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  /** Find a museum by ID regardless of owner (used for QR links). */
  async getMuseumById(id) {
    const data = load();
    for (const u of Object.values(data)) {
      const m = (u.museums ?? []).find(m => m.id === id);
      if (m) return m;
    }
    return null;
  },

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Create and persist a new museum for the user. Returns the saved museum. */
  async create(userId, { name, rooms, roomCount }) {
    const data = load();
    const museum = {
      id: crypto.randomUUID(),
      name,
      rooms,
      roomCount: roomCount ?? rooms.length,
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
    };
    const updated = writeUserMuseums(data, userId, [museum, ...userMuseums(data, userId)]);
    save(updated);
    return museum;
  },

  /** Permanently delete a museum and all its versions. */
  async remove(userId, museumId) {
    const data = load();
    const museums = userMuseums(data, userId).filter(m => m.id !== museumId);
    save(writeUserMuseums(data, userId, museums));
  },

  /** Rename a museum. Returns the updated museum. */
  async rename(userId, museumId, newName) {
    const data = load();
    const museums = userMuseums(data, userId).map(m =>
      m.id === museumId ? { ...m, name: newName.trim(), updatedAt: new Date().toISOString() } : m
    );
    save(writeUserMuseums(data, userId, museums));
    return museums.find(m => m.id === museumId);
  },

  /** Toggle published flag. Returns the updated museum. */
  async setPublished(userId, museumId, published) {
    const data = load();
    const museums = userMuseums(data, userId).map(m =>
      m.id === museumId ? { ...m, published, updatedAt: new Date().toISOString() } : m
    );
    save(writeUserMuseums(data, userId, museums));
    return museums.find(m => m.id === museumId);
  },

  // ── Versions ──────────────────────────────────────────────────────────────

  /** Save current state of a museum as a named version. Returns the new version. */
  async saveVersion(userId, museumId, label) {
    const data = load();
    const museum = userMuseums(data, userId).find(m => m.id === museumId);
    if (!museum) throw new Error('Museum not found');

    const version = {
      id: crypto.randomUUID(),
      label: label ?? `Version ${(museum.versions?.length ?? 0) + 1}`,
      rooms: museum.rooms,
      savedAt: new Date().toISOString(),
    };

    const versions = [version, ...(museum.versions ?? [])].slice(0, MAX_VERSIONS);
    const museums = userMuseums(data, userId).map(m =>
      m.id === museumId ? { ...m, versions } : m
    );
    save(writeUserMuseums(data, userId, museums));
    return version;
  },

  /** Get all saved versions for a museum (newest first). */
  async getVersions(userId, museumId) {
    const museums = await museumService.getMyMuseums(userId);
    return museums.find(m => m.id === museumId)?.versions ?? [];
  },

  /**
   * Restore a version — saves current state as a new version first,
   * then replaces rooms with the chosen version's rooms.
   * Returns the updated museum.
   */
  async restoreVersion(userId, museumId, versionId) {
    await museumService.saveVersion(userId, museumId, 'Before restore');
    const data = load();
    const museum = userMuseums(data, userId).find(m => m.id === museumId);
    const version = museum?.versions?.find(v => v.id === versionId);
    if (!museum || !version) throw new Error('Not found');

    const museums = userMuseums(data, userId).map(m =>
      m.id === museumId
        ? { ...m, rooms: version.rooms, roomCount: version.rooms.length, updatedAt: new Date().toISOString() }
        : m
    );
    save(writeUserMuseums(data, userId, museums));
    return museums.find(m => m.id === museumId);
  },

  /** Delete a single version. */
  async deleteVersion(userId, museumId, versionId) {
    const data = load();
    const museums = userMuseums(data, userId).map(m =>
      m.id === museumId
        ? { ...m, versions: (m.versions ?? []).filter(v => v.id !== versionId) }
        : m
    );
    save(writeUserMuseums(data, userId, museums));
  },
};
