const API = "http://localhost:3000";
const TOKEN_KEY = "token_v1";

export async function apiFetch(path, options) {
  const token = localStorage.getItem(TOKEN_KEY);

  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${TOKEN_KEY}` } : {}),
      ...options.headers,
    },
  });

  if (res.status == 401) {
    localStorage.removeItem(TOKEN_KEY);
    window.location.href = "/";
  }

  return res;
}
