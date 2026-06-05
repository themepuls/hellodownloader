import Link from 'next/link';
import {
  Archive,
  Captions,
  Download,
  Image,
  ListMusic,
  Music,
  Rocket,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

const features = [
  {
    icon: Download,
    title: 'Video Downloader',
    desc: 'Download videos from YouTube, Facebook, Instagram, TikTok and more.',
    color: 'from-blue-500/20 to-blue-600/5',
  },
  {
    icon: ListMusic,
    title: 'Playlist Downloader',
    desc: 'Download entire playlists and export as ZIP files.',
    color: 'from-purple-500/20 to-purple-600/5',
  },
  {
    icon: Music,
    title: 'MP3 Converter',
    desc: 'Extract audio from any video in high quality MP3 format.',
    color: 'from-pink-500/20 to-pink-600/5',
  },
  {
    icon: Captions,
    title: 'Subtitle Downloader',
    desc: 'Download subtitles in SRT, VTT, and TXT formats.',
    color: 'from-cyan-500/20 to-cyan-600/5',
  },
  {
    icon: Image,
    title: 'Thumbnail Tools',
    desc: 'Download original thumbnails free. Pro adds AI adjust and generation.',
    color: 'from-amber-500/20 to-amber-600/5',
  },
  {
    icon: Archive,
    title: 'ZIP Export',
    desc: 'Bundle multiple downloads into one convenient ZIP file.',
    color: 'from-green-500/20 to-green-600/5',
  },
];

const steps = [
  { step: '1', title: 'Copy Video Link', desc: 'Find any video and copy its URL' },
  { step: '2', title: 'Paste & Click Download', desc: 'Paste the link and hit download' },
  { step: '3', title: 'Choose Format & Save', desc: 'Pick quality and save to your device' },
];

const platforms = ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'Vimeo'];

const stats = [
  { value: '10M+', label: 'Downloads' },
  { value: '500K+', label: 'Happy Users' },
  { value: '1000+', label: 'Platforms' },
  { value: '99.9%', label: 'Uptime' },
];

export function HomeSections() {
  return (
    <>
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">Everything You Need in One Place</h2>
          <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">
            Powerful tools to download, convert, and optimize your video content.
          </p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <div
                key={f.title}
                className={`rounded-2xl border border-white/10 bg-gradient-to-br ${f.color} p-6 text-left transition hover:border-primary/30`}
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                  <f.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0d1017] px-4 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-12 text-3xl font-bold">Just 3 Simple Steps</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <div key={s.step} className="relative">
                {i < steps.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] border-t border-dashed border-white/20 md:block" />
                )}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold text-primary">
                  {s.step}
                </div>
                <h3 className="mb-2 font-semibold">{s.title}</h3>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="mb-12 text-3xl font-bold">Download From 1000+ Platforms</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {platforms.map((p) => (
              <div
                key={p}
                className="flex h-16 w-28 items-center justify-center rounded-xl border border-white/10 bg-[#12151c] text-sm font-medium"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-[#12151c] p-8">
              <h3 className="mb-2 text-xl font-bold">Free Plan</h3>
              <p className="mb-6 text-3xl font-bold">
                $0 <span className="text-base font-normal text-muted-foreground">/ forever</span>
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Unlimited downloads (720p)</li>
                <li>✓ Playlist, MP3 & subtitles</li>
                <li>✓ Original thumbnail download</li>
                <li>✓ 7-day history with signup</li>
                <li>✓ Ads shown</li>
              </ul>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-[#12151c] p-8 shadow-lg shadow-primary/10">
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold">
                Most Popular
              </span>
              <h3 className="mb-2 text-xl font-bold">Pro Plan</h3>
              <p className="mb-6 text-3xl font-bold">
                $5.99 <span className="text-base font-normal text-muted-foreground">/ month</span>
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                <li>✓ 1080p, 4K & 8K downloads</li>
                <li>✓ AI thumbnail adjust & generate</li>
                <li>✓ Multiple ratios + custom prompts</li>
                <li>✓ No ads · unlimited history</li>
              </ul>
              <Link href="/pricing">
                <Button className="w-full">Upgrade to Pro</Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0d1017] px-4 py-12">
        <div className="container mx-auto flex max-w-4xl flex-wrap items-center justify-center gap-12">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-primary to-blue-600 p-10 md:flex-row">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">Ready to Get Started?</h2>
              <p className="mt-2 text-white/80">Join thousands of creators downloading smarter.</p>
            </div>
            <Link href="/download">
              <Button size="lg" variant="secondary" className="gap-2 bg-white text-primary hover:bg-white/90">
                <Rocket className="h-4 w-4" />
                Start Downloading Now
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
