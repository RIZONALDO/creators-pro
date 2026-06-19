/**
 * Cliente HTTP base. Encapsula fetch com baseURL, JSON e token de auth.
 * Quando VITE_USE_MOCK=true, a camada de endpoints (index.ts) NÃO chama isto —
 * ela resolve a partir do mock em memória. Troque a flag para usar o backend real.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

let authToken: string | null = localStorage.getItem('cp_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('cp_token', token);
  else localStorage.removeItem('cp_token');
}

export function getAuthToken() {
  return authToken;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).message ?? msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
