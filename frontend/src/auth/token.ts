import type { AxiosInstance } from 'axios';

// The API lives on a different site than the frontend (onrender.com vs vercel.app),
// so its session cookie is a third-party cookie that Safari, iOS, Brave and
// incognito windows block. We keep the JWT here and send it as a Bearer header.
const KEY = 'vega_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | undefined | null) {
  if (!token) return;
  try {
    localStorage.setItem(KEY, token);
  } catch {
    /* storage unavailable: the cookie remains as fallback */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

// After Google sign-in the backend redirects to `/#token=...`. Store it and clean the URL.
export function captureTokenFromUrl() {
  const match = window.location.hash.match(/(?:^#|&)token=([^&]+)/);
  if (!match) return;
  setToken(decodeURIComponent(match[1]));
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
}

export function attachAuthHeader(instance: AxiosInstance) {
  instance.interceptors.request.use((config) => {
    const token = getToken();
    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });
}
