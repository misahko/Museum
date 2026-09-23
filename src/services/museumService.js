import {apiFetch} from "./apiService.js";
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

/*function load() {
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
*/
// ── Public API ─────────────────────────────────────────────────────────────────

export const museumService = {
  // ── Read ──────────────────────────────────────────────────────────────────

  /** All museums belonging to the given user. */
  async getMyMuseums(userId) {
    try
    {
      const res = await apiFetch(`/api/users/${userId}/museums`);
      if (!res.ok)
      {
        throw new Error ("Помилка при отриманні музеїв");
      }
      return await res.json();
    }
    catch (err)
    {
      console.error(err);
      return [];
    }
  },

  /** All museums marked as published (across all users). */
  async getGallery() {
    try
    {
      const res = await apiFetch('/api/museums?published=true');
      if (!res.ok)
      {
        throw new Error ("Помилка при отриманні галереї");
      }
      return await res.json();
    }
    catch (err)
    {
      console.error(err);
      return [];
    }
  },

  /** Find a museum by ID regardless of owner (used for QR links). */
  async getMuseumById(id) {
        try
    {
      const res = await apiFetch(`/api/museums/${id}`);
      if (!res.ok)
      {
        throw new Error ("Помилка при отриманні музею");
      }
      return await res.json();
    }
    catch (err)
    {
      console.error(err);
      return [];
    }
  },

  // ── Write ─────────────────────────────────────────────────────────────────

  /** Create and persist a new museum for the user. Returns the saved museum. */
  async create(userId, { name, rooms, roomCount, tags }) {
    try {
      const res = await apiFetch(`/api/users/${userId}/museums`, {
        method: "POST",
        body: JSON.stringify({
          name,
          rooms,
          roomCount: roomCount ?? rooms?.length ?? 0,
          tags: tags ?? [],
        }),
      });

      if (!res.ok) {
        throw new Error("Не вдалося створити музей");
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /** Permanently delete a museum and all its versions. */
  async remove(userId, museumId) {
    try {
      const res = await apiFetch(`/api/museums/${museumId}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        throw new Error("Не вдалося видалити музей");
      }

      return true;
    } catch (err) {
      console.error(err);
      return false;
    }
  },

  /** Rename a museum. Returns the updated museum. */
async rename(userId, museumId, newName) {
  try {
      const res = await apiFetch(`/api/museums/${museumId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: newName.trim(),
        }),
      });

      if (!res.ok) {
        throw new Error("Не вдалося перейменувати музей");
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },

  /** Toggle published flag. Returns the updated museum. */
  async setPublished(userId, museumId, published) {
    try {
      const res = await apiFetch(`/api/museums/${museumId}`, {
        method: "PATCH",
        body: JSON.stringify({
          published,
        }),
      });

      if (!res.ok) {
        throw new Error("Не вдалося змінити статус публікації музею");
      }

      return await res.json();
    } catch (err) {
      console.error(err);
      return null;
    }
  },
};
