'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { getVisitorId } from '@/lib/visitor-id';

const THANK_YOU_AUTO_HIDE_MS = 10_000;

type SurveyState =
  | { status: 'loading' }
  | { status: 'idle' }
  | { status: 'submitting'; interested: boolean }
  | { status: 'voted'; interested: boolean; showThanks: boolean };

export function FourKInterestSurvey() {
  const [state, setState] = useState<SurveyState>({ status: 'loading' });

  const dismissThanks = useCallback(() => {
    setState((prev) =>
      prev.status === 'voted' ? { ...prev, showThanks: false } : prev,
    );
  }, []);

  const load = useCallback(async () => {
    try {
      const visitorId = getVisitorId();
      const res = (await apiClient.surveys.fourKInterest(visitorId)) as {
        voted: boolean;
        interested?: boolean;
      };
      if (res.voted && typeof res.interested === 'boolean') {
        setState({ status: 'voted', interested: res.interested, showThanks: false });
      } else {
        setState({ status: 'idle' });
      }
    } catch {
      setState({ status: 'idle' });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (state.status !== 'voted' || !state.showThanks) return;
    const timer = window.setTimeout(dismissThanks, THANK_YOU_AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [state, dismissThanks]);

  const submit = async (interested: boolean) => {
    setState({ status: 'submitting', interested });
    try {
      await apiClient.surveys.submitFourKInterest({
        interested,
        visitorId: getVisitorId(),
      });
      setState({ status: 'voted', interested, showThanks: true });
    } catch {
      setState({ status: 'idle' });
    }
  };

  if (state.status === 'loading') {
    return (
      <div className="flex shrink-0 items-center justify-center rounded-xl border border-border bg-secondary/80 px-4 py-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin mr-2" />
        Loading…
      </div>
    );
  }

  if (state.status === 'voted') {
    if (!state.showThanks) return null;

    return (
      <div className="relative flex shrink-0 items-start gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 pr-10">
        <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-emerald-800 dark:text-emerald-100">
            Thanks for your feedback!
          </p>
          <p className="text-xs text-emerald-800/80 dark:text-emerald-100/70 mt-1">
            You answered{' '}
            <span className="font-semibold">{state.interested ? 'Yes' : 'No'}</span> — we&apos;re
            tracking demand for up to 4K downloads.
          </p>
        </div>
        <button
          type="button"
          onClick={dismissThanks}
          className="absolute right-3 top-3 rounded-md p-1 text-emerald-700/70 transition-colors hover:bg-emerald-500/20 hover:text-emerald-900 dark:text-emerald-200/70 dark:hover:text-emerald-100"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  const submitting = state.status === 'submitting';

  return (
    <div className="shrink-0 rounded-xl border border-primary/25 bg-card px-4 py-4 space-y-3">
      <p className="text-sm font-semibold leading-snug">
        Do you need support for up to 4K video download?
      </p>
      <p className="text-xs text-muted-foreground leading-relaxed">
        1080p, 1440p, and 4K are not available yet. Vote below — works logged in or as a guest.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          disabled={submitting}
          onClick={() => void submit(true)}
          className="min-w-[72px]"
        >
          {submitting && state.interested ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'Yes'
          )}
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={submitting}
          onClick={() => void submit(false)}
          className="min-w-[72px] border-border"
        >
          {submitting && !state.interested ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'No'
          )}
        </Button>
      </div>
    </div>
  );
}
