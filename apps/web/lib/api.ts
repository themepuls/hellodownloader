/** Browser uses same-origin proxy (next.config rewrites) to avoid CORS. */
const API_URL =
  typeof window !== 'undefined'
    ? (process.env.NEXT_PUBLIC_API_URL ?? '/api/v1')
    : (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api/v1');

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return (
    localStorage.getItem('accessToken') ??
    (() => {
      try {
        const raw = localStorage.getItem('hellodownloader-user');
        if (!raw) return null;
        const parsed = JSON.parse(raw) as { state?: { accessToken?: string } };
        return parsed.state?.accessToken ?? null;
      } catch {
        return null;
      }
    })()
  );
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken();

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message =
      (Array.isArray(err.message) ? err.message.join(', ') : err.message) ??
      err.error ??
      res.statusText;
    if (res.status === 401) {
      throw new Error('Please log in to continue, or try again as a guest.');
    }
    if (res.status === 403) {
      throw new Error('Admin access required.');
    }
    if (res.status === 404) {
      throw new Error('API route not found. Restart the API server (pnpm --filter @hellodownloader/api dev).');
    }
    throw new Error(message);
  }

  return res.json();
}

function adminQs(params: Record<string, string | number | undefined | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const apiClient = {
  auth: {
    register: (data: { email: string; password: string; name?: string }) =>
      api('/auth/register', { method: 'POST', body: JSON.stringify(data) }),
    login: (data: { email: string; password: string }) =>
      api('/auth/login', { method: 'POST', body: JSON.stringify(data) }),
    me: () => api('/auth/me'),
  },
  downloads: {
    metadata: (url: string) =>
      api('/downloads/metadata', { method: 'POST', body: JSON.stringify({ url }) }),
    create: (data: { url: string; type: string; quality?: number; format?: string }) =>
      api('/downloads', { method: 'POST', body: JSON.stringify(data) }),
    status: (id: string) => api(`/downloads/${id}/status`),
    list: (page = 1) => api(`/downloads?page=${page}`),
    get: (id: string) => api(`/downloads/${id}`),
  },
  thumbnails: {
    original: (url: string) =>
      api('/thumbnails/original', { method: 'POST', body: JSON.stringify({ url }) }),
    saveOriginal: (url: string) =>
      api('/thumbnails/original/save', { method: 'POST', body: JSON.stringify({ url }) }),
    createAi: (data: { videoUrl: string; ratio: string; mode: 'adjust' | 'generate'; prompt?: string }) =>
      api('/thumbnails/ai', { method: 'POST', body: JSON.stringify(data) }),
    list: () => api('/thumbnails'),
  },
  credits: {
    balance: () => api('/credits'),
    history: () => api('/credits/history'),
  },
  billing: {
    checkout: () => api('/billing/checkout/stripe', { method: 'POST' }),
    binanceCheckout: () => api('/billing/checkout/binance', { method: 'POST' }),
    sslcommerzCheckout: () => api('/billing/checkout/sslcommerz', { method: 'POST' }),
    subscription: () => api('/billing/subscription'),
    payments: () => api('/billing/payments'),
  },
  users: {
    dashboard: () => api('/users/dashboard'),
  },
  admin: {
    stats: () => api('/admin/stats'),
    listUsers: (p: { page?: number; limit?: number; search?: string; plan?: string; role?: string } = {}) =>
      api(`/admin/users${adminQs(p)}`),
    getUser: (id: string) => api(`/admin/users/${id}`),
    updateUser: (id: string, data: Record<string, unknown>) =>
      api(`/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    resetPassword: (id: string, password: string) =>
      api(`/admin/users/${id}/reset-password`, { method: 'POST', body: JSON.stringify({ password }) }),
    listDownloads: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/downloads${adminQs(p)}`),
    listPlaylists: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/playlists${adminQs(p)}`),
    cancelDownload: (id: string) => api(`/admin/downloads/${id}/cancel`, { method: 'POST' }),
    retryDownload: (id: string) => api(`/admin/downloads/${id}/retry`, { method: 'POST' }),
    deleteDownloadFile: (id: string) => api(`/admin/downloads/${id}/file`, { method: 'DELETE' }),
    listThumbnails: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/thumbnails${adminQs(p)}`),
    getApiSettings: () => api('/admin/api-settings'),
    testOpenAiApi: (data: { apiKey: string; openaiModel: string }) =>
      api('/admin/api-settings/openai/test', { method: 'POST', body: JSON.stringify(data) }),
    saveOpenAiApi: (data: Record<string, unknown>) =>
      api('/admin/api-settings/openai', { method: 'POST', body: JSON.stringify(data) }),
    testFreepikApi: (data: { apiKey: string }) =>
      api('/admin/api-settings/freepik/test', { method: 'POST', body: JSON.stringify(data) }),
    saveFreepikApi: (data: Record<string, unknown>) =>
      api('/admin/api-settings/freepik', { method: 'POST', body: JSON.stringify(data) }),
    savePlanModels: (data: Record<string, unknown>) =>
      api('/admin/api-settings/plan-models', { method: 'PATCH', body: JSON.stringify(data) }),
    saveAiFeatures: (data: Record<string, unknown>) =>
      api('/admin/api-settings/features', { method: 'PATCH', body: JSON.stringify(data) }),
    listPayments: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/payments${adminQs(p)}`),
    paymentsOverview: () => api('/admin/payments/overview'),
    paymentConfigs: () => api('/admin/payments/config'),
    updatePaymentConfig: (
      provider: string,
      data: Record<string, unknown>,
    ) =>
      api(`/admin/payments/config/${provider}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    listSubscriptions: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/subscriptions${adminQs(p)}`),
    listCredits: (p: Record<string, string | number | undefined> = {}) =>
      api(`/admin/credits${adminQs(p)}`),
    storage: () => api('/admin/storage'),
    cleanup: (hours?: number) =>
      api('/admin/storage/cleanup', { method: 'POST', body: JSON.stringify({ hours }) }),
    analytics: () => api('/admin/analytics'),
    system: () => api('/admin/system'),
    settings: () => api('/admin/settings'),
    updateSettings: (data: Record<string, unknown>) =>
      api('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    listContentPages: () => api('/admin/content/pages'),
    getContentPage: (slug: string) => api(`/admin/content/pages/${slug}`),
    updateContentPage: (slug: string, data: Record<string, unknown>) =>
      api(`/admin/content/pages/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createContentPage: (data: { slug: string; title: string }) =>
      api('/admin/content/pages', { method: 'POST', body: JSON.stringify(data) }),
    uploadBranding: async (file: File) => {
      const token = getAccessToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${API_URL}/admin/branding/upload`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: res.statusText }));
        const message =
          (Array.isArray(err.message) ? err.message.join(', ') : err.message) ??
          err.error ??
          res.statusText;
        throw new Error(message);
      }
      return res.json();
    },
  },
  playlists: {
    create: (data: { url: string; quality?: number }) =>
      api('/playlists', { method: 'POST', body: JSON.stringify(data) }),
    status: (id: string) => api(`/playlists/${id}/status`),
    list: () => api('/playlists'),
  },
  ads: {
    config: () => api('/ads/config'),
  },
  content: {
    page: (slug: string) => api(`/content/pages/${slug}`),
  },
};
