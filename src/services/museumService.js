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
 *
 * Storage layout (single localStorage key):
 *   STORE_KEY → { [userId]: { museums: Museum[] } }
 *
 * Museum shape:
 *   { id, name, rooms, roomCount, published, createdAt, updatedAt }
 */

const STORE_KEY = "museum_data_v1";

// ── Storage helpers ────────────────────────────────────────────────────────────

function load() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) ?? "{}");
  } catch {
    return {};
  }
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
      .flatMap((u) => u.museums ?? [])
      .filter((m) => m.published)
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  },

  /** Find a museum by ID regardless of owner (used for QR links). */
  async getMuseumById(id) {
    const data = load();
    for (const u of Object.values(data)) {
      const m = (u.museums ?? []).find((m) => m.id === id);
      if (m) return m;
    }
    return null;
  },

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Create and persist a new museum for the user. Returns the saved museum. */
  async create(userId, { name, rooms, roomCount, tags }) {
    const data = load();
    const museum = {
      id: crypto.randomUUID(),
      name,
      rooms,
      roomCount: roomCount ?? rooms.length,
      tags: tags ?? [],
      published: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      versions: [],
    };
    const updated = writeUserMuseums(data, userId, [
      museum,
      ...userMuseums(data, userId),
    ]);
    save(updated);
    return museum;
  },

  /** Permanently delete a museum and all its versions. */
  async remove(userId, museumId) {
    const data = load();
    const museums = userMuseums(data, userId).filter((m) => m.id !== museumId);
    save(writeUserMuseums(data, userId, museums));
  },

  /** Rename a museum. Returns the updated museum. */
  async rename(userId, museumId, newName) {
    const data = load();
    const museums = userMuseums(data, userId).map((m) =>
      m.id === museumId
        ? { ...m, name: newName.trim(), updatedAt: new Date().toISOString() }
        : m,
    );
    save(writeUserMuseums(data, userId, museums));
    return museums.find((m) => m.id === museumId);
  },

  /** Toggle published flag. Returns the updated museum. */
  async setPublished(userId, museumId, published) {
    const data = load();
    const museums = userMuseums(data, userId).map((m) =>
      m.id === museumId
        ? { ...m, published, updatedAt: new Date().toISOString() }
        : m,
    );
    save(writeUserMuseums(data, userId, museums));
    return museums.find((m) => m.id === museumId);
  },
};
