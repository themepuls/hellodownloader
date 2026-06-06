'use client';

import { GoogleOAuthProvider } from '@react-oauth/google';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api';

type GoogleAuthConfig = {
  enabled: boolean;
  clientId: string;
  loading: boolean;
};

const GoogleAuthContext = createContext<GoogleAuthConfig>({
  enabled: false,
  clientId: '',
  loading: true,
});

const envClientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID?.trim() ?? '';

export function GoogleAuthProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<GoogleAuthConfig>({
    enabled: Boolean(envClientId),
    clientId: envClientId,
    loading: !envClientId,
  });

  useEffect(() => {
    if (envClientId) return;

    let cancelled = false;
    void apiClient.auth
      .googleConfig()
      .then((res) => {
        if (cancelled) return;
        setConfig({
          enabled: res.enabled && Boolean(res.clientId),
          clientId: res.clientId ?? '',
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setConfig({ enabled: false, clientId: '', loading: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(() => config, [config]);

  if (config.loading) {
    return (
      <GoogleAuthContext.Provider value={value}>{children}</GoogleAuthContext.Provider>
    );
  }

  if (!config.enabled || !config.clientId) {
    return (
      <GoogleAuthContext.Provider value={value}>{children}</GoogleAuthContext.Provider>
    );
  }

  return (
    <GoogleAuthContext.Provider value={value}>
      <GoogleOAuthProvider clientId={config.clientId}>{children}</GoogleOAuthProvider>
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth(): GoogleAuthConfig {
  return useContext(GoogleAuthContext);
}

/** @deprecated use useGoogleAuth().enabled */
export function isGoogleAuthConfigured(): boolean {
  if (envClientId) return true;
  return false;
}
