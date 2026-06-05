'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastMessage = {
  id: string;
  type: 'success' | 'error';
  message: string;
};

function nextToastId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ToastStack({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  useEffect(() => {
    if (toasts.length === 0) return;
    const latest = toasts[toasts.length - 1];
    const timer = setTimeout(() => onDismiss(latest.id), 4000);
    return () => clearTimeout(timer);
  }, [toasts, onDismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'flex items-start gap-2 rounded-lg border px-4 py-3 text-sm shadow-lg backdrop-blur-md',
            toast.type === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100'
              : 'border-red-500/30 bg-red-500/10 text-red-100',
          )}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-emerald-400" />
          ) : (
            <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-red-400" />
          )}
          <span>{toast.message}</span>
        </div>
      ))}
    </div>
  );
}

export function useToast() {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((type: 'success' | 'error', message: string) => {
    const entry: ToastMessage = { id: nextToastId(), type, message };
    setToasts((prev) => [...prev.slice(-2), entry]);
  }, []);

  const success = useCallback((message: string) => push('success', message), [push]);
  const error = useCallback((message: string) => push('error', message), [push]);

  return {
    toasts,
    dismiss,
    success,
    error,
  };
}
