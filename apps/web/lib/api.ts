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
    throw new Error(message);
  }

  return res.json();
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
};
