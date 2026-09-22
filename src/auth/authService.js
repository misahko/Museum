// Auth service — currently backed by localStorage.
// To connect a real backend, replace each function body:
//   login   → POST /api/auth/login
//   register → POST /api/auth/register
//   logout  → POST /api/auth/logout  (+ clear token)
//   getUser → GET  /api/auth/me      (or decode JWT)

import { apiFetch } from "../services/apiService";

const USERS_KEY = "museum_users_v1";
const SESSION_KEY = "museum_session_v1";

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
  /**
   * Log in with email + password.
   * Resolves to { id, name, email } on success.
   * Rejects with an Error whose .message is user-facing.
   */
  async login(email, password) {
    const users = loadUsers();
    const user = users.find(
      (u) => u.email.toLowerCase() === email.trim().toLowerCase(),
    );
    if (!user || user.password !== password)
      throw new Error("Incorrect email or password.");
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
    const users = loadUsers();
    if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase()))
      throw new Error("An account with this email already exists.");
    const user = {
      id: crypto.randomUUID(),
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
    };
    saveUsers([...users, user]);
    const session = { id: user.id, name: user.name, email: user.email };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /** Log out and clear the session. */
  logout() {
    sessionStorage.removeItem(SESSION_KEY);
  },

  /**
   * Update display name.
   * Backend: PATCH /api/users/:id  { name }
   */
  async updateName(userId, newName) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found.");
    users[idx].name = newName.trim();
    saveUsers(users);
    const session = {
      id: users[idx].id,
      name: users[idx].name,
      email: users[idx].email,
    };
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  /**
   * Change password — requires current password for verification.
   * Backend: POST /api/users/:id/change-password  { currentPassword, newPassword }
   */
  async updatePassword(userId, currentPassword, newPassword) {
    const users = loadUsers();
    const idx = users.findIndex((u) => u.id === userId);
    if (idx === -1) throw new Error("User not found.");
    if (users[idx].password !== currentPassword)
      throw new Error("Current password is incorrect.");
    if (newPassword.length < 6)
      throw new Error("New password must be at least 6 characters.");
    users[idx].password = newPassword;
    saveUsers(users);
  },

  /**
   * Permanently delete account — requires password confirmation.
   * Backend: DELETE /api/users/:id  { password }
   */
  async deleteAccount(userId, password) {
    const users = loadUsers();
    const user = users.find((u) => u.id === userId);
    if (!user) throw new Error("User not found.");
    if (user.password !== password) throw new Error("Incorrect password.");
    saveUsers(users.filter((u) => u.id !== userId));
    sessionStorage.removeItem(SESSION_KEY);
  },
};
