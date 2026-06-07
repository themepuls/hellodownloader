import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  credits: number;
}

interface UserState {
  user: User | null;
  accessToken: string | null;
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  logout: () => void;
  updateUser: (partial: Partial<User>) => void;
}

function setAuthHintCookie(active: boolean) {
  if (typeof document === 'undefined') return;
  if (active) {
    document.cookie = 'hd-auth-hint=1; path=/; max-age=604800; SameSite=Lax';
  } else {
    document.cookie = 'hd-auth-hint=; path=/; max-age=0; SameSite=Lax';
  }
}

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('accessToken', accessToken);
          localStorage.setItem('refreshToken', refreshToken);
          setAuthHintCookie(true);
        }
        set({ user, accessToken });
      },
      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setAuthHintCookie(false);
        }
        set({ user: null, accessToken: null });
      },
      updateUser: (partial) =>
        set((s) => ({ user: s.user ? { ...s.user, ...partial } : null })),
    }),
    {
      name: 'hellodownloader-user',
      onRehydrateStorage: () => (state) => {
        if (state?.accessToken && typeof window !== 'undefined') {
          localStorage.setItem('accessToken', state.accessToken);
          setAuthHintCookie(true);
        }
      },
    },
  ),
);
