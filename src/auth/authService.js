// Auth service — currently backed by localStorage.
// To connect a real backend, replace each function body:
//   login   → POST /api/auth/login
//   register → POST /api/auth/register
//   logout  → POST /api/auth/logout  (+ clear token)
//   getUser → GET  /api/auth/me      (or decode JWT)

import { apiFetch, API, TOKEN_KEY } from "../services/apiService";

const USERS_KEY = "museum_users_v1";
export const SESSION_KEY = "museum_session_v1";
const SEED_USERS = [
  {
    id: "seed-1",
    name: "Alice Researcher",
    email: "alice@test.com",
    password: "alice123",
  },
  {
    id: "seed-2",
    name: "Bob Curator",
    email: "bob@test.com",
    password: "bob123",
  },
  {
    id: "seed-3",
    name: "Admin",
    email: "admin@test.com",
    password: "admin123",
  },
];

function loadUsers() {
  try {
    const stored = JSON.parse(localStorage.getItem(USERS_KEY) ?? "[]");
    // Merge seed users — add any that aren't already present
    const merged = [...stored];
    for (const seed of SEED_USERS) {
      if (!merged.some((u) => u.id === seed.id)) merged.push(seed);
    }
    return merged;
  } catch {
    return SEED_USERS;
  }
}
function saveUsers(users) {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const authService = {
  getUser() {
    try {
      return JSON.parse(sessionStorage.getItem(SESSION_KEY));
    } catch {
      return null;
    }
  },
  /**
   * Log in with email + password.
   * Resolves to { id, name, email } on success.
   * Rejects with an Error whose .message is user-facing.
   */
  async login(email, password) {
    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, password: password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();

    const user = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);

    const session = { id: user.id, name: user.name, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Create a new account and immediately log in.
   * Resolves to { id, name, email } on success.
   * Rejects with an Error whose .message is user-facing.
   */
  async register(name, email, password) {
    const res = await fetch(`${API}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();

    const user = data.user;
    localStorage.setItem(TOKEN_KEY, data.token);

    const session = { id: user.id, name: user.name, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /** Log out and clear the session. */
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
  },

  /**
   * Update display name.
   * Backend: PATCH /api/users/:id  { name }
   */
  async updateName(userId, newName) {
    const res = await apiFetch("/users/me", {
      method: "PATCH",
      body: JSON.stringify({ name: newName.trim() }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    const data = await res.json();

    const user = data.user;

    const session = {
      id: user.id,
      name: user.name,
      email: user.email,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Change password — requires current password for verification.
   * Backend: POST /api/users/:id/change-password  { currentPassword, newPassword }
   */
  async updatePassword(userId, currentPassword, newPassword) {
    const res = await apiFetch("/users/change-password", {
      method: "POST",
      body: JSON.stringify({
        password: currentPassword,
        newPassword: newPassword,
      }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }
  },

  /**
   * Permanently delete account — requires password confirmation.
   * Backend: DELETE /api/users/:id  { password }
   */
  async deleteAccount(userId, password) {
    const res = await apiFetch("/users/me", {
      method: "DELETE",
      body: JSON.stringify({ password: password }),
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error);
    }

    this.logout();
  },
};
