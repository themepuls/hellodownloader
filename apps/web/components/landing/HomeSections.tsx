import Link from 'next/link';
import {
  Archive,
  Captions,
  Download,
  Image,
  ListMusic,
  Music,
  Rocket,
  type LucideIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_HOME_CONTENT,
  type HomePageContent,
} from '@hellodownloader/shared-types';

const FEATURE_ICONS: Record<string, LucideIcon> = {
  download: Download,
  listMusic: ListMusic,
  music: Music,
  captions: Captions,
  image: Image,
  archive: Archive,
};

const FEATURE_COLORS = [
  'from-blue-500/20 to-blue-600/5',
  'from-purple-500/20 to-purple-600/5',
  'from-pink-500/20 to-pink-600/5',
  'from-cyan-500/20 to-cyan-600/5',
  'from-amber-500/20 to-amber-600/5',
  'from-green-500/20 to-green-600/5',
];

type HomeSectionsProps = {
  content?: Partial<HomePageContent>;
};

export function HomeSections({ content: contentProp }: HomeSectionsProps = {}) {
  const content: HomePageContent = {
    ...DEFAULT_HOME_CONTENT,
    ...contentProp,
    hero: { ...DEFAULT_HOME_CONTENT.hero, ...contentProp?.hero },
    features: {
      ...DEFAULT_HOME_CONTENT.features,
      ...contentProp?.features,
      items: contentProp?.features?.items ?? DEFAULT_HOME_CONTENT.features.items,
    },
    steps: {
      ...DEFAULT_HOME_CONTENT.steps,
      ...contentProp?.steps,
      items: contentProp?.steps?.items ?? DEFAULT_HOME_CONTENT.steps.items,
    },
    platforms: {
      ...DEFAULT_HOME_CONTENT.platforms,
      ...contentProp?.platforms,
      items: contentProp?.platforms?.items ?? DEFAULT_HOME_CONTENT.platforms.items,
    },
    pricingTeaser: {
      free: { ...DEFAULT_HOME_CONTENT.pricingTeaser.free, ...contentProp?.pricingTeaser?.free },
      pro: { ...DEFAULT_HOME_CONTENT.pricingTeaser.pro, ...contentProp?.pricingTeaser?.pro },
    },
    cta: { ...DEFAULT_HOME_CONTENT.cta, ...contentProp?.cta },
  };

  const { features, steps, platforms, pricingTeaser, cta } = content;

  return (
    <>
      <section className="px-4 py-20">
        <div className="container mx-auto max-w-6xl text-center">
          <h2 className="mb-4 text-3xl font-bold md:text-4xl">{features.title}</h2>
          <p className="mx-auto mb-12 max-w-2xl text-muted-foreground">{features.subtitle}</p>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[f.icon] ?? Download;
              const color = FEATURE_COLORS[i % FEATURE_COLORS.length];
              return (
                <div
                  key={`${f.title}-${i}`}
                  className={`rounded-2xl border border-white/10 bg-gradient-to-br ${color} p-6 text-left transition hover:border-primary/30`}
                >
                  <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/20">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="mb-2 text-lg font-semibold">{f.title}</h3>
                  <p className="text-sm text-muted-foreground">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-white/5 bg-[#0d1017] px-4 py-20">
        <div className="container mx-auto max-w-4xl text-center">
          <h2 className="mb-12 text-3xl font-bold">{steps.title}</h2>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.items.map((s, i) => (
              <div key={`${s.title}-${i}`} className="relative">
                {i < steps.items.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] border-t border-dashed border-white/20 md:block" />
                )}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold text-primary">
                  {i + 1}
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
          <h2 className="mb-12 text-3xl font-bold">{platforms.title}</h2>
          <div className="flex flex-wrap items-center justify-center gap-4">
            {platforms.items.map((p) => (
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
              <h3 className="mb-2 text-xl font-bold">{pricingTeaser.free.title}</h3>
              <p className="mb-6 text-3xl font-bold">
                {pricingTeaser.free.price}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  {pricingTeaser.free.priceSuffix}
                </span>
              </p>
              <ul className="space-y-2 text-sm text-muted-foreground">
                {pricingTeaser.free.features.map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-[#12151c] p-8 shadow-lg shadow-primary/10">
              {pricingTeaser.pro.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold">
                  {pricingTeaser.pro.badge}
                </span>
              )}
              <h3 className="mb-2 text-xl font-bold">{pricingTeaser.pro.title}</h3>
              <p className="mb-6 text-3xl font-bold">
                {pricingTeaser.pro.price}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  {pricingTeaser.pro.priceSuffix}
                </span>
              </p>
              <ul className="mb-6 space-y-2 text-sm text-muted-foreground">
                {pricingTeaser.pro.features.map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
              {pricingTeaser.pro.buttonLink && pricingTeaser.pro.buttonText && (
                <Link href={pricingTeaser.pro.buttonLink}>
                  <Button className="w-full">{pricingTeaser.pro.buttonText}</Button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-20">
        <div className="container mx-auto max-w-5xl">
          <div className="flex flex-col items-center justify-between gap-6 rounded-2xl bg-gradient-to-r from-primary to-blue-600 p-10 md:flex-row">
            <div>
              <h2 className="text-2xl font-bold text-white md:text-3xl">{cta.title}</h2>
              <p className="mt-2 text-white/80">{cta.subtitle}</p>
            </div>
            <Link href={cta.buttonLink}>
              <Button size="lg" variant="secondary" className="gap-2 bg-white text-primary hover:bg-white/90">
                <Rocket className="h-4 w-4" />
                {cta.buttonText}
              </Button>
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
