/**
 * Cliente HTTP base. Encapsula fetch com baseURL, JSON e token de auth.
 * Quando VITE_USE_MOCK=true, a camada de endpoints (index.ts) NÃO chama isto —
 * ela resolve a partir do mock em memória. Troque a flag para usar o backend real.
 */
const ENV_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api';

/**
 * O IP de LAN da máquina de dev já mudou mais de uma vez nesta sessão (DHCP) — sem isto, toda
 * troca de IP quebra a conexão até alguém editar o .env e reiniciar o Vite. Em vez de depender só
 * do .env, tenta localhost (mesma máquina) e os IPs de LAN já vistos, e fixa o primeiro que responder.
 */
// https (não http): a página em si carrega por https (certificado mkcert) quando acessada pelo IP
// da rede — fetch pra um host http a partir de uma página https é bloqueado (mixed content).
const FALLBACK_HOSTS = ['https://localhost:3001', 'https://192.168.100.47:3001', 'https://192.168.100.35:3001', 'https://192.168.100.46:3001', 'https://10.0.2.14:3001'];
export const CANDIDATE_BASE_URLS = Array.from(new Set([ENV_BASE_URL, ...FALLBACK_HOSTS]));

const BASE_URL_STORAGE_KEY = 'cp_api_base_url';
let activeBaseUrl = localStorage.getItem(BASE_URL_STORAGE_KEY) ?? CANDIDATE_BASE_URLS[0]!;

/** Host atualmente resolvido — `api/socket.ts` reaproveita pra conectar no mesmo host do REST. */
export function getActiveBaseUrl(): string {
  return activeBaseUrl;
}

function rememberBaseUrl(url: string) {
  if (url === activeBaseUrl) return;
  activeBaseUrl = url;
  localStorage.setItem(BASE_URL_STORAGE_KEY, url);
}

const FALLBACK_TIMEOUT_MS = 2500;

/** Tenta o host ativo primeiro; se a rede estiver inalcançável (não é erro HTTP, é fetch rejeitando), passa pro próximo candidato e fixa o que responder. */
async function fetchWithFallback(path: string, init: RequestInit): Promise<Response> {
  const ordered = [activeBaseUrl, ...CANDIDATE_BASE_URLS.filter((u) => u !== activeBaseUrl)];
  let lastErr: unknown;
  for (const base of ordered) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FALLBACK_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}${path}`, { ...init, signal: controller.signal });
      rememberBaseUrl(base);
      return res;
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

let authToken: string | null = localStorage.getItem('cp_token');
let refreshToken: string | null = localStorage.getItem('cp_refresh_token');

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) localStorage.setItem('cp_token', token);
  else localStorage.removeItem('cp_token');
}

export function setRefreshToken(token: string | null) {
  refreshToken = token;
  if (token) localStorage.setItem('cp_refresh_token', token);
  else localStorage.removeItem('cp_refresh_token');
}

export function getAuthToken() {
  return authToken;
}

export function getRefreshToken() {
  return refreshToken;
}

/** Registrado pelo AppProvider — chamado quando o refresh falha (a sessão expirou de fato). */
let onSessionExpired: (() => void) | null = null;
export function setOnSessionExpired(cb: (() => void) | null) {
  onSessionExpired = cb;
}

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
  }
}

// Evita disparar vários POST /auth/refresh em paralelo se várias requisições baterem 401 ao mesmo tempo.
let refreshPromise: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  if (!refreshToken) return false;
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetchWithFallback('/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        setAuthToken(data.token);
        setRefreshToken(data.refresh_token);
        return true;
      } catch {
        return false;
      }
    })();
    refreshPromise.finally(() => { refreshPromise = null; });
  }
  return refreshPromise;
}

async function request<T>(method: string, path: string, body?: unknown, isRetry = false): Promise<T> {
  const res = await fetchWithFallback(path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Token de acesso expirado (15min) — tenta renovar uma vez com o refresh_token antes de desistir.
  // /auth/login e /auth/refresh nunca entram aqui: um 401 ali é credencial/refresh inválido, não expiração.
  if (res.status === 401 && !isRetry && path !== '/auth/login' && path !== '/auth/refresh') {
    const refreshed = await tryRefresh();
    if (refreshed) return request<T>(method, path, body, true);
    setAuthToken(null);
    setRefreshToken(null);
    onSessionExpired?.();
  }

  if (!res.ok) {
    let msg = res.statusText;
    let code: string | undefined;
    let details: Record<string, unknown> | undefined;
    // backend real responde { error: { code, message, details? } } — mock antigo esperava { message } direto.
    try {
      const body = (await res.json()).error;
      msg = body?.message ?? msg;
      code = body?.code;
      details = body?.details;
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg, code, details);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Toda listagem do backend real vem como { data, meta? } — aqui já devolve só o array. */
async function requestList<T>(path: string): Promise<T[]> {
  const res = await request<{ data: T[] }>('GET', path);
  return res.data;
}

/** GET de arquivo binário (export de relatório em PDF/Excel) — mesmo fallback de host, sem JSON.parse. */
async function requestBlob(path: string, isRetry = false): Promise<Blob> {
  const res = await fetchWithFallback(path, {
    headers: { ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}) },
  });

  if (res.status === 401 && !isRetry) {
    const refreshed = await tryRefresh();
    if (refreshed) return requestBlob(path, true);
    setAuthToken(null);
    setRefreshToken(null);
    onSessionExpired?.();
  }

  if (!res.ok) {
    let msg = res.statusText;
    try { msg = (await res.json()).error?.message ?? msg; } catch { /* ignore */ }
    throw new ApiError(res.status, msg);
  }
  return res.blob();
}

/**
 * POST multipart/form-data com progresso real (upload de anexo/foto). `fetch` não expõe progresso
 * de upload de forma simples (sem stream de request body, que tem suporte limitado) — por isso só
 * esta função usa XMLHttpRequest, que tem `upload.onprogress` nativo. Usa o host já resolvido
 * (não refaz o fallback de candidatos: por essa altura a sessão já tem um host funcionando).
 */
function uploadWithProgress<T>(path: string, form: FormData, onProgress?: (pct: number) => void, isRetry = false): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${activeBaseUrl}${path}`);
    if (authToken) xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);

    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      (async () => {
        if (xhr.status === 401 && !isRetry) {
          const refreshed = await tryRefresh();
          if (refreshed) return uploadWithProgress<T>(path, form, onProgress, true);
          setAuthToken(null);
          setRefreshToken(null);
          onSessionExpired?.();
        }

        if (xhr.status >= 200 && xhr.status < 300) {
          try { return xhr.responseText ? JSON.parse(xhr.responseText) : undefined; } catch { return undefined; }
        }

        let msg = xhr.statusText;
        try { msg = JSON.parse(xhr.responseText).error?.message ?? msg; } catch { /* ignore */ }
        throw new ApiError(xhr.status, msg);
      })().then(resolve, reject);
    };

    xhr.onerror = () => reject(new ApiError(0, 'Falha de rede.'));
    xhr.send(form);
  });
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  getList: <T>(path: string) => requestList<T>(path),
  getBlob: (path: string) => requestBlob(path),
  uploadWithProgress: <T>(path: string, form: FormData, onProgress?: (pct: number) => void) => uploadWithProgress<T>(path, form, onProgress),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
