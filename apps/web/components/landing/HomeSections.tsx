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
      <section className="overflow-x-hidden px-4 py-14 sm:px-6 sm:py-20">
        <div className="container mx-auto max-w-6xl min-w-0 text-center">
          <h2 className="mb-3 text-2xl font-bold sm:mb-4 sm:text-3xl md:text-4xl">{features.title}</h2>
          <p className="mx-auto mb-8 max-w-2xl text-sm text-muted-foreground sm:mb-12 sm:text-base">{features.subtitle}</p>
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {features.items.map((f, i) => {
              const Icon = FEATURE_ICONS[f.icon] ?? Download;
              const color = FEATURE_COLORS[i % FEATURE_COLORS.length];
              return (
                <div
                  key={`${f.title}-${i}`}
                  className={`rounded-2xl border border-border bg-gradient-to-br ${color} p-5 text-left transition hover:border-primary/30 sm:p-6`}
                >
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/20 sm:mb-4 sm:h-12 sm:w-12">
                    <Icon className="h-5 w-5 text-primary sm:h-6 sm:w-6" />
                  </div>
                  <h3 className="mb-1.5 text-base font-semibold sm:mb-2 sm:text-lg">{f.title}</h3>
                  <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{f.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="overflow-x-hidden border-y border-border/60 bg-secondary px-4 py-14 sm:px-6 sm:py-20">
        <div className="container mx-auto max-w-4xl min-w-0 text-center">
          <h2 className="mb-8 text-2xl font-bold sm:mb-12 sm:text-3xl">{steps.title}</h2>
          <div className="grid gap-6 sm:gap-8 md:grid-cols-3">
            {steps.items.map((s, i) => (
              <div key={`${s.title}-${i}`} className="relative">
                {i < steps.items.length - 1 && (
                  <div className="absolute left-[calc(50%+2rem)] top-8 hidden h-px w-[calc(100%-4rem)] border-t border-dashed border-border md:block" />
                )}
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 text-xl font-bold text-primary sm:mb-4 sm:h-16 sm:w-16 sm:text-2xl">
                  {i + 1}
                </div>
                <h3 className="mb-1.5 text-sm font-semibold sm:mb-2 sm:text-base">{s.title}</h3>
                <p className="text-xs leading-relaxed text-muted-foreground sm:text-sm">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-x-hidden px-4 py-14 sm:px-6 sm:py-20">
        <div className="container mx-auto max-w-6xl min-w-0 text-center">
          <h2 className="mb-8 text-2xl font-bold sm:mb-12 sm:text-3xl">{platforms.title}</h2>
          <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
            {platforms.items.map((p) => (
              <div
                key={p}
                className="flex h-12 min-w-[5.5rem] flex-1 items-center justify-center rounded-xl border border-border bg-card px-3 text-xs font-medium sm:h-16 sm:min-w-[7rem] sm:flex-none sm:w-28 sm:text-sm"
              >
                {p}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="overflow-x-hidden px-4 py-14 sm:px-6 sm:py-20">
        <div className="container mx-auto max-w-5xl min-w-0">
          <div className="grid gap-4 sm:gap-6 md:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6 sm:p-8">
              <h3 className="mb-2 text-lg font-bold sm:text-xl">{pricingTeaser.free.title}</h3>
              <p className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">
                {pricingTeaser.free.price}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  {pricingTeaser.free.priceSuffix}
                </span>
              </p>
              <ul className="space-y-1.5 text-xs text-muted-foreground sm:space-y-2 sm:text-sm">
                {pricingTeaser.free.features.map((line) => (
                  <li key={line}>✓ {line}</li>
                ))}
              </ul>
            </div>
            <div className="relative rounded-2xl border-2 border-primary bg-card p-6 shadow-lg shadow-primary/10 sm:p-8">
              {pricingTeaser.pro.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-xs font-semibold">
                  {pricingTeaser.pro.badge}
                </span>
              )}
              <h3 className="mb-2 text-lg font-bold sm:text-xl">{pricingTeaser.pro.title}</h3>
              <p className="mb-4 text-2xl font-bold sm:mb-6 sm:text-3xl">
                {pricingTeaser.pro.price}{' '}
                <span className="text-base font-normal text-muted-foreground">
                  {pricingTeaser.pro.priceSuffix}
                </span>
              </p>
              <ul className="mb-4 space-y-1.5 text-xs text-muted-foreground sm:mb-6 sm:space-y-2 sm:text-sm">
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

      <section className="overflow-x-hidden px-4 py-14 sm:px-6 sm:py-20">
        <div className="container mx-auto max-w-5xl min-w-0">
          <div className="flex flex-col items-center justify-between gap-5 rounded-2xl bg-gradient-to-r from-primary to-blue-600 p-6 text-center sm:gap-6 sm:p-8 md:flex-row md:p-10 md:text-left">
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-white sm:text-2xl md:text-3xl">{cta.title}</h2>
              <p className="mt-2 text-sm text-white/80 sm:text-base">{cta.subtitle}</p>
            </div>
            <Link href={cta.buttonLink} className="w-full shrink-0 sm:w-auto">
              <Button size="lg" variant="secondary" className="w-full gap-2 bg-white text-primary hover:bg-white/90 sm:w-auto">
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
