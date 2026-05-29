# Backend Integration Guide

All data is currently stored in **localStorage**. To connect a real database,
replace the body of each function listed below — the rest of the app stays unchanged.

---

## 1. Authentication — `src/auth/authService.js`

### Session storage
Currently sessions are kept in `sessionStorage` as a plain JSON object.
With a real backend, store a **JWT** (or session cookie) and decode it in `getUser()`.

| Function | Replace with |
|---|---|
| `getUser()` | Decode JWT from `localStorage` / read session cookie |
| `login(email, password)` | `POST /api/auth/login` → receive token → store it |
| `register(name, email, password)` | `POST /api/auth/register` → receive token → store it |
| `logout()` | `POST /api/auth/logout` + remove token |
| `updateName(userId, newName)` | `PATCH /api/users/:userId` `{ name }` |
| `updatePassword(userId, current, newPass)` | `POST /api/users/:userId/change-password` `{ currentPassword, newPassword }` |
| `deleteAccount(userId, password)` | `DELETE /api/users/:userId` `{ password }` |

**Return shape** every auth function resolves to (and must keep):
```js
{ id: string, name: string, email: string }
```

### Example — `login` with JWT
```js
async login(email, password) {
  const res = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error((await res.json()).message ?? 'Login failed.');
  const { token, user } = await res.json();
  localStorage.setItem('museum_token', token);
  return user; // { id, name, email }
},
```

---

## 2. Museums — `src/services/museumService.js`

All methods are `async`. Each maps 1-to-1 to a REST endpoint.

| Function | Endpoint |
|---|---|
| `getMyMuseums(userId)` | `GET /api/users/:userId/museums` |
| `getGallery()` | `GET /api/museums?published=true` |
| `getMuseumById(id)` | `GET /api/museums/:id` |
| `create(userId, data)` | `POST /api/users/:userId/museums` |
| `remove(userId, museumId)` | `DELETE /api/museums/:museumId` |
| `rename(userId, museumId, name)` | `PATCH /api/museums/:museumId` `{ name }` |
| `setPublished(userId, museumId, bool)` | `PATCH /api/museums/:museumId` `{ published }` |
| `saveVersion(userId, museumId, label)` | `POST /api/museums/:museumId/versions` `{ label }` |
| `getVersions(userId, museumId)` | `GET /api/museums/:museumId/versions` |
| `restoreVersion(userId, museumId, versionId)` | `POST /api/museums/:museumId/versions/:versionId/restore` |
| `deleteVersion(userId, museumId, versionId)` | `DELETE /api/museums/:museumId/versions/:versionId` |

**Museum shape** the UI expects:
```js
{
  id:         string,
  name:       string,
  rooms:      Room[],      // 3D room config array
  roomCount:  number,
  tags:       string[],
  published:  boolean,
  createdAt:  string,      // ISO date
  updatedAt:  string,
  versions:   Version[],
}
```

**Version shape:**
```js
{ id: string, label: string, rooms: Room[], savedAt: string }
```

### Auth header helper
Add this helper at the top of `museumService.js` and use it in every `fetch`:
```js
function authHeaders() {
  const token = localStorage.getItem('museum_token');
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}
```

### Example — `create`
```js
async create(userId, { name, rooms, roomCount, tags }) {
  const res = await fetch(`/api/users/${userId}/museums`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ name, rooms, roomCount, tags }),
  });
  if (!res.ok) throw new Error('Failed to create museum.');
  return res.json(); // returns the saved museum object
},
```

---

## 3. Visit tracking — `src/services/museumStore.js`

| Function | Endpoint |
|---|---|
| `recordVisit(museumId)` | `POST /api/museums/:museumId/visit` |
| `getVisits(museumId)` | Read from museum object returned by `getMuseumById` |
| `recordRecent(museumId, name)` | `POST /api/users/me/recent` `{ museumId, name }` |
| `getRecent()` | `GET /api/users/me/recent` |
| `removeRecent(museumId)` | `DELETE /api/users/me/recent/:museumId` |
| `clearRecent()` | `DELETE /api/users/me/recent` |

> `getVisits` can be removed once the visit count is included in the museum object
> returned by the API — just read `museum.visitCount` directly in the UI.

---

## 4. Vite proxy (already configured)

`vite.config.js` already proxies `/api/*` to `localhost:8765`.
Change the `target` to your real backend URL for production:

```js
// vite.config.js
proxy: {
  '/api': {
    target: 'https://your-backend.com',
    changeOrigin: true,
  },
}
```

---

## 5. Database schema suggestion (PostgreSQL)

```sql
-- Users
CREATE TABLE users (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT NOT NULL,
  email      TEXT UNIQUE NOT NULL,
  password   TEXT NOT NULL,           -- bcrypt hash
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Museums
CREATE TABLE museums (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  rooms       JSONB NOT NULL,
  room_count  INT NOT NULL DEFAULT 0,
  tags        TEXT[] DEFAULT '{}',
  published   BOOLEAN DEFAULT false,
  visit_count INT DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Museum versions
CREATE TABLE museum_versions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  museum_id   UUID REFERENCES museums(id) ON DELETE CASCADE,
  label       TEXT NOT NULL,
  rooms       JSONB NOT NULL,
  saved_at    TIMESTAMPTZ DEFAULT now()
);

-- Recent visits (per user)
CREATE TABLE recent_visits (
  user_id    UUID REFERENCES users(id) ON DELETE CASCADE,
  museum_id  UUID REFERENCES museums(id) ON DELETE CASCADE,
  visited_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, museum_id)
);
```

---

## Summary — files to change

| File | What to replace |
|---|---|
| `src/auth/authService.js` | All 7 function bodies |
| `src/services/museumService.js` | All 11 method bodies + add `authHeaders()` |
| `src/services/museumStore.js` | `recordVisit`, `recordRecent`, `getRecent`, `removeRecent`, `clearRecent` |
| `vite.config.js` | Proxy `target` for production |

Nothing else in the codebase needs to change.
