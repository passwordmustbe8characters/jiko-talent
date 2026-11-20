// Talks to the private admin API. The login token lives in this browser only.
const API = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const KEY = 'jiko_admin_token';

export const getToken = () => localStorage.getItem(KEY);
export const setToken = (token) => localStorage.setItem(KEY, token);
export const clearToken = () => localStorage.removeItem(KEY);

export async function api(path, { method = 'GET', body } = {}) {
  const token = getToken();
  const res = await fetch(`${API}/api/admin${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty response */ }

  if (res.status === 401 && path !== '/login') {
    clearToken();
    window.dispatchEvent(new Event('jiko-admin-logout')); // expired token: back to the login screen
  }
  if (!res.ok) throw new Error(data?.error ?? `Request failed (${res.status})`);
  return data;
}
