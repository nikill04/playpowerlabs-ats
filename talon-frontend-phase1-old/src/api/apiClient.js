import { API_BASE_URL } from "./config.js";

const TOKEN_KEY = "talon_auth_token";

function storage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function getAuthToken() {
  return storage()?.getItem(TOKEN_KEY) || "";
}

export function setAuthToken(token) {
  if (token) storage()?.setItem(TOKEN_KEY, token);
}

export function clearAuthToken() {
  storage()?.removeItem(TOKEN_KEY);
}

export function isLoggedIn() {
  return Boolean(getAuthToken());
}

export function authHeaders(headers = {}) {
  const token = getAuthToken();
  return token ? { ...headers, Authorization: `Bearer ${token}` } : { ...headers };
}

async function errorMessage(res) {
  const body = await res.json().catch(() => ({}));
  return body.error || body.message || `Request failed with status ${res.status}`;
}

export async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: authHeaders(options.headers || {}),
  });
  if (res.status === 401) {
    clearAuthToken();
    if (typeof window !== "undefined" && window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
  }
  return res;
}

export async function getJSON(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function postJSON(path, body) {
  const res = await apiFetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}

export async function patchJSON(path, body) {
  const res = await apiFetch(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  if (!res.ok) throw new Error(await errorMessage(res));
  return res.json();
}
