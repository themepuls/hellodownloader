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

function clearStaleAuth() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  import('@/store/userStore').then(({ useUserStore }) => {
    useUserStore.getState().logout();
  });
}

/** Browser uses same-origin proxy (next.config rewrites) to avoid CORS. */
function getApiUrl(): string {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL ?? '/api/v1';
  }
  if (process.env.NEXT_PUBLIC_API_URL?.startsWith('http')) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  return `${process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:4001'}/api/v1`;
}

const DEFAULT_FETCH_TIMEOUT_MS = 30_000;

async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const externalSignal = options.signal;

  if (externalSignal) {
    if (externalSignal.aborted) {
      clearTimeout(timer);
      throw new DOMException('The operation was aborted.', 'AbortError');
    }
    externalSignal.addEventListener('abort', () => controller.abort(), { once: true });
  }

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      if (externalSignal?.aborted) {
        throw new Error('Cancelled');
      }
      throw new Error('Request timed out. Is the API server running on port 4001?');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_FETCH_TIMEOUT_MS,
): Promise<T> {
  const token = getAccessToken();

  const res = await fetchWithTimeout(
    `${getApiUrl()}${path}`,
    {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    },
    timeoutMs,
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message =
      (Array.isArray(err.message) ? err.message.join(', ') : err.message) ??
      err.error ??
      res.statusText;
    if (res.status === 401) {
      clearStaleAuth();
      throw new Error('Please log in to continue, or try again as a guest.');
    }
    if (res.status === 403) {
      throw new Error(message.includes('Admin') ? message : 'Access denied.');
    }
    if (res.status === 404) {
      throw new Error('API route not found. Restart the API server (pnpm --filter @hellodownloader/api dev).');
    }
    if (res.status >= 500) {
      throw new Error(
        'API server error. Restart it with: pnpm --filter @hellodownloader/api dev — then refresh this page.',
      );
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
    google: (idToken: string) =>
      api('/auth/google', { method: 'POST', body: JSON.stringify({ idToken }) }),
    googleConfig: () => api<{ enabled: boolean; clientId: string }>('/auth/google/config'),
    me: () => api('/auth/me'),
  },
  downloads: {
    qualityAccess: () => api('/downloads/quality-access'),
    metadata: (url: string, signal?: AbortSignal) =>
      api(
        '/downloads/metadata',
        { method: 'POST', body: JSON.stringify({ url }), signal },
        120_000,
      ),
    create: (data: {
      url: string;
      type: string;
      quality?: number;
      format?: string;
      metadata?: {
        id?: string;
        title: string;
        thumbnail: string;
        uploader?: string;
        duration?: number;
        formats?: unknown[];
      };
    }) => api('/downloads', { method: 'POST', body: JSON.stringify(data) }),
    status: (id: string, downloadToken?: string) =>
      api(
        `/downloads/${id}/status${
          downloadToken ? `?download_token=${encodeURIComponent(downloadToken)}` : ''
        }`,
      ),
    release: (id: string, downloadToken?: string) =>
      api(
        `/downloads/${id}/release${
          downloadToken ? `?download_token=${encodeURIComponent(downloadToken)}` : ''
        }`,
        { method: 'POST' },
      ),
    list: (page = 1) => api(`/downloads?page=${page}`),
    get: (id: string) => api(`/downloads/${id}`),
  },
  surveys: {
    fourKInterest: (visitorId?: string) =>
      api(`/surveys/four-k-interest${visitorId ? `?visitorId=${encodeURIComponent(visitorId)}` : ''}`),
    submitFourKInterest: (data: { interested: boolean; visitorId?: string }) =>
      api('/surveys/four-k-interest', { method: 'POST', body: JSON.stringify(data) }),
  },
  thumbnails: {
    original: (url: string, signal?: AbortSignal) =>
      api('/thumbnails/original', { method: 'POST', body: JSON.stringify({ url }), signal }),
    features: () => api('/thumbnails/features'),
    saveOriginal: (url: string, hints?: { thumbnailUrl?: string; title?: string }) =>
      api('/thumbnails/original/save', {
        method: 'POST',
        body: JSON.stringify({ url, ...hints }),
      }),
    createAi: (data: {
      videoUrl: string;
      ratio: string;
      mode: 'adjust' | 'generate';
      prompt?: string;
      categorySlug?: string;
      additionalInstructions?: string;
    }, signal?: AbortSignal) =>
      api('/thumbnails/ai', { method: 'POST', body: JSON.stringify(data), signal }),
    generateHeadline: (data: {
      title: string;
      category?: string;
      categorySlug?: string;
      textStyle?: string;
      ratio?: string;
      instructions?: string;
      thumbnailUrl?: string;
    }, signal?: AbortSignal) =>
      api('/thumbnails/headline', { method: 'POST', body: JSON.stringify(data), signal }),
    list: () => api('/thumbnails'),
    get: (id: string) => api(`/thumbnails/${id}`),
  },
  credits: {
    balance: () => api('/credits'),
    history: () => api('/credits/history'),
  },
  billing: {
    paymentMethods: () =>
      api('/billing/payment-methods') as Promise<{
        stripe: boolean;
        binance: boolean;
        sslcommerz: boolean;
        anyEnabled: boolean;
      }>,
    checkout: () => api('/billing/checkout/stripe', { method: 'POST' }),
    binanceCheckout: () => api('/billing/checkout/binance', { method: 'POST' }),
    sslcommerzCheckout: () => api('/billing/checkout/sslcommerz', { method: 'POST' }),
    subscription: () => api('/billing/subscription'),
    payments: () => api('/billing/payments'),
  },
  users: {
    dashboard: (page = 1, limit = 10) =>
      api(`/users/dashboard?page=${page}&limit=${limit}`),
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
    testOpenAiApi: (data: { apiKey?: string; textModel: string }) =>
      api('/admin/api-settings/openai/test', { method: 'POST', body: JSON.stringify(data) }),
    testFalApi: (data: { apiKey?: string }) =>
      api('/admin/api-settings/fal/test', { method: 'POST', body: JSON.stringify(data) }),
    saveAiProviders: (data: Record<string, unknown>) =>
      api('/admin/api-settings/providers', { method: 'POST', body: JSON.stringify(data) }),
    saveAiFeatures: (data: Record<string, unknown>) =>
      api('/admin/api-settings/features', { method: 'PATCH', body: JSON.stringify(data) }),
    listThumbnailPrompts: (p: { type?: string; search?: string } = {}) =>
      api(`/admin/thumbnail-prompts${adminQs(p)}`),
    getThumbnailPrompt: (id: string) => api(`/admin/thumbnail-prompts/${id}`),
    createThumbnailPrompt: (data: Record<string, unknown>) =>
      api('/admin/thumbnail-prompts', { method: 'POST', body: JSON.stringify(data) }),
    updateThumbnailPrompt: (id: string, data: Record<string, unknown>) =>
      api(`/admin/thumbnail-prompts/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    deleteThumbnailPrompt: (id: string) =>
      api(`/admin/thumbnail-prompts/${id}`, { method: 'DELETE' }),
    previewThumbnailPrompt: (data: Record<string, unknown>) =>
      api('/admin/thumbnail-prompts/preview/combined', { method: 'POST', body: JSON.stringify(data) }),
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
    listUploads: () => api('/admin/uploads'),
    getStorageSettings: () => api('/admin/storage-settings'),
    updateStorageSettings: (data: Record<string, unknown>) =>
      api('/admin/storage-settings', { method: 'PATCH', body: JSON.stringify(data) }),
    testStorageR2: () =>
      api<{ ok: boolean; message: string }>('/admin/storage-settings/r2/test', { method: 'POST' }),
    cleanup: (hours?: number) =>
      api('/admin/storage/cleanup', { method: 'POST', body: JSON.stringify({ hours }) }),
    analytics: () => api('/admin/analytics'),
    system: () => api('/admin/system'),
    cookiesStatus: () =>
      api<{ configured: boolean; path: string; updatedAt: string | null }>('/admin/cookies/status'),
    uploadMetaCookies: async (file: File) => {
      const token = getAccessToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${getApiUrl()}/admin/cookies/upload`, {
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
      return res.json() as Promise<{ ok: boolean; message: string }>;
    },
    settings: () => api('/admin/settings'),
    updateSettings: (data: Record<string, unknown>) =>
      api('/admin/settings', { method: 'PATCH', body: JSON.stringify(data) }),
    getAds: () => api('/admin/ads'),
    updateAds: (data: Record<string, unknown>) =>
      api('/admin/ads', { method: 'PATCH', body: JSON.stringify(data) }),
    listContentPages: () => api('/admin/content/pages'),
    getContentPage: (slug: string) => api(`/admin/content/pages/${slug}`),
    updateContentPage: (slug: string, data: Record<string, unknown>) =>
      api(`/admin/content/pages/${slug}`, { method: 'PATCH', body: JSON.stringify(data) }),
    createContentPage: (data: { slug: string; title: string }) =>
      api('/admin/content/pages', { method: 'POST', body: JSON.stringify(data) }),
    getSiteSettings: () => api('/admin/site-settings'),
    updateSiteSettings: (data: Record<string, unknown>) =>
      api('/admin/site-settings', { method: 'PATCH', body: JSON.stringify(data) }),
    uploadBranding: async (file: File) => {
      const token = getAccessToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${getApiUrl()}/admin/branding/upload`, {
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
    uploadAdImage: async (file: File) => {
      const token = getAccessToken();
      const body = new FormData();
      body.append('file', file);
      const res = await fetch(`${getApiUrl()}/admin/ads/upload`, {
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
    create: (data: { url: string; quality?: number }, signal?: AbortSignal) =>
      api('/playlists', { method: 'POST', body: JSON.stringify(data), signal }),
    status: (id: string) => api(`/playlists/${id}/status`),
    list: () => api('/playlists'),
  },
  ads: {
    config: () => api('/ads/config'),
  },
  content: {
    page: (slug: string) => api(`/content/pages/${slug}`),
    siteSettings: () => api('/content/site-settings'),
  },
};
