'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Download, Shield, Zap } from 'lucide-react';
import { VideoUrlBar } from '@/components/downloader/VideoUrlBar';

const perks = [
  { icon: Download, label: 'Free 720p downloads' },
  { icon: Ban, label: 'No ads on Pro' },
  { icon: Zap, label: 'Blazing Fast' },
  { icon: Shield, label: 'Secure & Safe' },
];

export function HomeHero() {
  const router = useRouter();
  const [url, setUrl] = useState('');

  const handleDownload = () => {
    const trimmed = url.trim();
    if (!trimmed) return;
    router.push(`/download?url=${encodeURIComponent(trimmed)}`);
  };

  return (
    <section className="relative overflow-hidden px-4 pb-20 pt-16 md:pt-24">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(124,58,237,0.15),_transparent_50%)]" />
      <div className="container relative mx-auto max-w-6xl">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span className="mb-6 inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-sm font-medium text-primary">
              #1 All-in-One Video Downloader
            </span>
            <h1 className="mb-6 text-4xl font-bold leading-tight tracking-tight md:text-5xl lg:text-6xl">
              Download Videos.{' '}
              <span className="bg-gradient-to-r from-blue-400 via-primary to-purple-400 bg-clip-text text-transparent">
                Fast. Easy. Free.
              </span>
            </h1>
            <p className="mb-8 max-w-xl text-lg text-muted-foreground lg:mx-0 mx-auto">
              Download videos, playlists, shorts, and reels. Convert to MP3, grab subtitles,
              and create upload-ready thumbnails — all in one place.
            </p>

            <VideoUrlBar
              value={url}
              onChange={setUrl}
              onSubmit={handleDownload}
              variant="hero"
              showTerms
            />

            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 lg:justify-start">
              {perks.map(({ icon: Icon, label }) => (
                <div key={label} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </div>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="relative rounded-2xl border border-white/10 bg-gradient-to-br from-[#1a1f2e] to-[#12151c] p-6 shadow-2xl">
              <div className="aspect-video rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center overflow-hidden">
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=600')] bg-cover bg-center opacity-60" />
                <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full bg-white/20 backdrop-blur">
                  <div className="ml-1 h-0 w-0 border-y-8 border-l-[14px] border-y-transparent border-l-white" />
                </div>
              </div>
              <div className="absolute -right-4 top-8 flex h-10 w-10 items-center justify-center rounded-xl bg-red-600 text-xs font-bold shadow-lg">
                ▶
              </div>
              <div className="absolute -left-2 bottom-16 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 text-xs shadow-lg">
                IG
              </div>
              <div className="absolute -right-2 bottom-8 flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 text-xs font-bold shadow-lg">
                f
              </div>
              <div className="mt-4 space-y-2 rounded-xl border border-white/10 bg-black/40 p-3">
                {['1080p MP4', '720p MP4', 'MP3', 'Subtitles'].map((opt) => (
                  <div
                    key={opt}
                    className="flex items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-white/5"
                  >
                    <span>{opt}</span>
                    <span className="text-primary">↓</span>
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
