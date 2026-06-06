'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Download, Shield, Zap } from 'lucide-react';
import { VideoUrlBar } from '@/components/downloader/VideoUrlBar';
import { DEFAULT_HOME_CONTENT, type HomeHeroContent } from '@hellodownloader/shared-types';

const PERK_ICONS = [Download, Ban, Zap, Shield];

type HomeHeroProps = {
  hero?: Partial<HomeHeroContent>;
};

export function HomeHero({ hero: heroProp }: HomeHeroProps) {
  const hero = { ...DEFAULT_HOME_CONTENT.hero, ...heroProp };
  const router = useRouter();
  const [url, setUrl] = useState('');

  const handleDownload = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    router.push(`/download?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="relative overflow-x-hidden px-4 pb-12 pt-10 sm:px-6 sm:pb-16 sm:pt-14 md:pb-20 md:pt-16 lg:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.15),_transparent_50%)]" />
      <div className="container relative mx-auto max-w-6xl min-w-0">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-12">
          <div className="min-w-0 text-center lg:text-left">
            <span className="mb-4 inline-flex max-w-full items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary sm:mb-6 sm:px-4 sm:py-1.5 sm:text-sm">
              {hero.badge}
            </span>
            <h1 className="mb-4 text-[1.65rem] font-bold leading-[1.15] tracking-tight break-words sm:mb-6 sm:text-4xl sm:leading-tight md:text-5xl lg:text-6xl">
              {hero.title}{' '}
              <span className="bg-gradient-to-r from-blue-400 via-primary to-purple-400 bg-clip-text text-transparent">
                {hero.titleHighlight}
              </span>
            </h1>
            <p className="mb-6 max-w-xl text-sm leading-relaxed text-muted-foreground sm:mb-8 sm:text-base md:text-lg lg:mx-0 mx-auto">
              {hero.subtitle}
            </p>

            <VideoUrlBar
              value={url}
              onChange={setUrl}
              onSubmit={handleDownload}
              variant="hero"
              showTerms
            />

            <div className="mt-6 grid grid-cols-1 gap-3 sm:mt-8 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-3 lg:flex lg:flex-wrap lg:justify-start lg:gap-6">
              {hero.perks.map((label, i) => {
                const Icon = PERK_ICONS[i] ?? Download;
                return (
                  <div
                    key={`${label}-${i}`}
                    className="flex items-center justify-center gap-2 text-xs text-muted-foreground sm:justify-start sm:text-sm"
                  >
                    <Icon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="min-w-0">{label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="relative mx-auto w-full min-w-0 max-w-md lg:max-w-none">
            <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-secondary to-card p-4 shadow-2xl sm:p-6">
              <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-slate-700 to-slate-900">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600')] bg-cover bg-center opacity-60" />
                <div className="relative z-10 flex h-12 w-12 items-center justify-center rounded-full bg-white/20 backdrop-blur sm:h-14 sm:w-14">
                  <div className="ml-1 h-0 w-0 border-y-[7px] border-l-[12px] border-y-transparent border-l-white sm:border-y-8 sm:border-l-[14px]" />
                </div>
              </div>

              <div className="absolute right-2 top-6 hidden h-9 w-9 items-center justify-center rounded-xl bg-red-600 text-xs font-bold shadow-lg sm:flex sm:h-10 sm:w-10 sm:-right-4 sm:top-8">
                ▶
              </div>
              <div className="absolute left-1 bottom-14 hidden h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-xs shadow-lg sm:flex sm:h-10 sm:w-10 sm:-left-2 sm:bottom-16">
                IG
              </div>
              <div className="absolute right-1 bottom-6 hidden h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold shadow-lg sm:flex sm:h-10 sm:w-10 sm:-right-2 sm:bottom-8">
                f
              </div>

              <div className="mt-3 space-y-1.5 rounded-xl border border-border bg-muted/60 p-2.5 sm:mt-4 sm:space-y-2 sm:p-3">
                {hero.mockOptions.map((opt) => (
                  <div
                    key={opt}
                    className="flex items-center justify-between rounded-lg px-2.5 py-1.5 text-xs hover:bg-accent sm:px-3 sm:py-2 sm:text-sm"
                  >
                    <span className="min-w-0 truncate">{opt}</span>
                    <span className="shrink-0 text-primary">↓</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
