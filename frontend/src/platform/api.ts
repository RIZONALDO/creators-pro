import { ApiError } from '@/api/client';
import { getActiveBaseUrl } from '@/api/client';

const PLATFORM_TOKEN_KEY = 'cp_platform_token';

export function getPlatformToken(): string | null {
  return localStorage.getItem(PLATFORM_TOKEN_KEY);
}

export function setPlatformToken(token: string | null) {
  if (token) localStorage.setItem(PLATFORM_TOKEN_KEY, token);
  else localStorage.removeItem(PLATFORM_TOKEN_KEY);
}

async function platformRequest<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getPlatformToken();
  const res = await fetch(`${getActiveBaseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let msg = res.statusText;
    let code: string | undefined;
    try {
      const data = await res.json();
      msg = data.message ?? msg;
      code = data.code;
    } catch { /* ignore */ }
    throw new ApiError(res.status, msg, code);
  }

  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface PlatformAdmin {
  id: string;
  name: string;
  email: string;
  totp_enabled?: boolean;
}

export interface TenantSummary {
  id: string;
  name: string;
  slug: string;
  status: string;
  plan_id: string | null;
  lifetime: boolean;
  created_at: string;
  user_count: number;
}

export interface TenantDetail extends TenantSummary {
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  trial_ends_at: string | null;
  plan_override: Record<string, unknown> | null;
  metrics: { users: number; creators: number; tasks: number };
}

export interface Plan {
  id: string;
  name: string;
  billing_type: 'monthly' | 'yearly' | 'one_time' | 'manual';
  price_cents: number;
  currency: string;
  stripe_product_id: string | null;
  stripe_price_id: string | null;
  max_gestores: number | null;
  max_creators: number | null;
  active: boolean;
  created_at: string;
}

export const platformApi = {
  auth: {
    login: (email: string, password: string) =>
      platformRequest<{ token: string; admin: PlatformAdmin } | { next: 'totp'; adminId: string }>(
        'POST', '/platform/auth/login', { email, password }
      ),
    verifyTotp: (adminId: string, code: string) =>
      platformRequest<{ token: string; admin: PlatformAdmin }>('POST', '/platform/auth/totp', { adminId, code }),
    me: () =>
      platformRequest<PlatformAdmin>('GET', '/platform/auth/me'),
    setupTotp: () =>
      platformRequest<{ secret: string; qrDataUrl: string }>('POST', '/platform/auth/totp/setup'),
    confirmTotp: (secret: string, code: string) =>
      platformRequest<{ ok: boolean }>('POST', '/platform/auth/totp/confirm', { secret, code }),
    disableTotp: (code: string) =>
      platformRequest<{ ok: boolean }>('DELETE', '/platform/auth/totp', { code }),
  },
  tenants: {
    list: () =>
      platformRequest<TenantSummary[]>('GET', '/platform/tenants'),
    get: (id: string) =>
      platformRequest<TenantDetail>('GET', `/platform/tenants/${id}`),
    create: (input: { name: string; adminName: string; adminEmail: string; adminPassword: string }) =>
      platformRequest<TenantSummary>('POST', '/platform/tenants', input),
    updateStatus: (id: string, status: string) =>
      platformRequest<TenantDetail>('PATCH', `/platform/tenants/${id}/status`, { status }),
    delete: (id: string) =>
      platformRequest<{ ok: boolean }>('DELETE', `/platform/tenants/${id}`),
    updatePlan: (id: string, input: { planId: string | null; lifetime?: boolean; planOverride?: Record<string, unknown> | null }) =>
      platformRequest<TenantDetail>('PATCH', `/platform/tenants/${id}/plan`, input),
  },
  plans: {
    list: () =>
      platformRequest<Plan[]>('GET', '/platform/plans'),
    get: (id: string) =>
      platformRequest<Plan>('GET', `/platform/plans/${id}`),
    create: (input: {
      name: string;
      billingType: string;
      priceCents: number;
      currency?: string;
      maxGestores?: number | null;
      maxCreators?: number | null;
      syncStripe?: boolean;
    }) => platformRequest<Plan>('POST', '/platform/plans', input),
    update: (id: string, input: { name?: string; priceCents?: number; maxGestores?: number | null; maxCreators?: number | null }) =>
      platformRequest<Plan>('PUT', `/platform/plans/${id}`, input),
    delete: (id: string) =>
      platformRequest<{ ok: boolean }>('DELETE', `/platform/plans/${id}`),
    syncStripe: (id: string) =>
      platformRequest<{ plan: Plan; stripe: { product: unknown; price: unknown } }>('POST', `/platform/plans/${id}/sync-stripe`),
  },
};
