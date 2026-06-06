'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { GoogleLogin, type CredentialResponse } from '@react-oauth/google';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';
import { useGoogleAuth } from '@/components/providers/GoogleAuthProvider';
import { cn } from '@/lib/utils';

type GoogleSignInButtonProps = {
  mode?: 'login' | 'register';
  redirectTo?: string;
  onError?: (message: string) => void;
  className?: string;
};

export function GoogleSignInButton({
  mode = 'login',
  redirectTo,
  onError,
  className,
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const setAuth = useUserStore((s) => s.setAuth);
  const { enabled } = useGoogleAuth();
  const [loading, setLoading] = useState(false);

  if (!enabled) {
    return null;
  }

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      onError?.('Google did not return a sign-in token');
      return;
    }

    setLoading(true);
    try {
      const res = (await apiClient.auth.google(response.credential)) as {
        accessToken: string;
        refreshToken: string;
        user: Parameters<typeof setAuth>[0];
      };
      setAuth(res.user, res.accessToken, res.refreshToken);
      const dest =
        redirectTo ?? (res.user.role === 'ADMIN' ? '/admin' : '/dashboard');
      router.push(dest);
    } catch (e) {
      onError?.(e instanceof Error ? e.message : 'Google sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className={cn(
        'flex w-full flex-col items-center',
        loading && 'pointer-events-none opacity-60',
        className,
      )}
    >
      <GoogleLogin
        onSuccess={(response) => void handleSuccess(response)}
        onError={() => onError?.('Google sign-in was cancelled or failed')}
        theme="outline"
        size="large"
        text={mode === 'register' ? 'signup_with' : 'signin_with'}
        shape="rectangular"
        width={320}
      />
    </div>
  );
}

export function AuthDivider() {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <span className="w-full border-t border-border" />
      </div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">or continue with email</span>
      </div>
    </div>
  );
}
