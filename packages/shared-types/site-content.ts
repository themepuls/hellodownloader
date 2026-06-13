import { mergePageSeo, type PageSeoContent } from './site-settings';

export type HomeCtaContent = {
  title: string;
  subtitle: string;
  buttonText: string;
  buttonLink: string;
};

export type HomeHeroContent = {
  badge: string;
  title: string;
  titleHighlight: string;
  subtitle: string;
  perks: string[];
  mockOptions: string[];
};

export type HomeFeatureItem = {
  icon: string;
  title: string;
  desc: string;
};

export type HomeFeaturesContent = {
  title: string;
  subtitle: string;
  items: HomeFeatureItem[];
};

export type HomeStepItem = {
  title: string;
  desc: string;
};

export type HomeStepsContent = {
  title: string;
  items: HomeStepItem[];
};

export type HomePlatformsContent = {
  title: string;
  items: string[];
};

export type HomePlanTeaser = {
  title: string;
  price: string;
  priceSuffix: string;
  features: string[];
  buttonText?: string;
  buttonLink?: string;
  badge?: string;
};

export type HomePricingTeaserContent = {
  free: HomePlanTeaser;
  pro: HomePlanTeaser;
};

export type HomePageContent = {
  hero: HomeHeroContent;
  features: HomeFeaturesContent;
  steps: HomeStepsContent;
  platforms: HomePlatformsContent;
  pricingTeaser: HomePricingTeaserContent;
  cta: HomeCtaContent;
};

export type PricingPageContent = {
  header: { title: string; subtitle: string };
  free: {
    title: string;
    price: string;
    priceSuffix: string;
    features: string[];
    buttonText: string;
  };
  pro: {
    title: string;
    price: string;
    priceSuffix: string;
    features: string[];
  };
  footer: { line1: string; line2: string };
};

export type DownloadPageContent = {
  analyzeButton: string;
  successText: string;
  emptyTitle: string;
  emptySubtitle: string;
  loadingText: string;
  trustBadges: string[];
  helpTitle: string;
  helpLinks: { label: string; href: string }[];
};

export type ToolsPageContent = {
  title: string;
  subtitle: string;
  videoUrlCardTitle: string;
  loadButton: string;
  proCardTitle: string;
  proLockedText: string;
  proUpgradeButton: string;
  generateComingSoonTitle: string;
  generateComingSoonText: string;
};

export type FaqItem = {
  question: string;
  answer: string;
};

export type FaqPageContent = {
  title: string;
  subtitle: string;
  items: FaqItem[];
};

export type SimplePageContent = {
  title: string;
  body: string;
  seo?: import('./site-settings').PageSeoContent;
};

export type { PageSeoContent } from './site-settings';
export { DEFAULT_PAGE_SEO } from './site-settings';

export type NavLinkItem = {
  label: string;
  href: string;
};

/** Paths removed from the site — filter from CMS/header/footer so Link prefetch does not 404. */
export const REMOVED_SITE_PATHS = ['/blog'] as const;

function normalizePath(href: string): string {
  const path = href.split('?')[0].split('#')[0].replace(/\/$/, '') || '/';
  return path;
}

export function isRemovedSitePath(href?: string): boolean {
  if (!href?.trim()) return false;
  return (REMOVED_SITE_PATHS as readonly string[]).includes(normalizePath(href));
}

export function filterRemovedNavLinks(items: NavMenuItem[]): NavMenuItem[] {
  return items
    .map((item) => {
      if (item.children?.length) {
        const children = item.children.filter((c) => !isRemovedSitePath(c.href));
        if (!children.length) return null;
        return { label: item.label, children, href: undefined };
      }
      if (isRemovedSitePath(item.href)) return null;
      return item;
    })
    .filter((item): item is NavMenuItem => item !== null);
}

export function filterRemovedFooterLinks(links: NavLinkItem[]): NavLinkItem[] {
  return links.filter((l) => l.label?.trim() && l.href?.trim() && !isRemovedSitePath(l.href));
}

export type NavMenuItem = {
  label: string;
  href?: string;
  children?: NavLinkItem[];
};

export type HeaderContent = {
  logo: {
    imageUrl: string;
    imageAlt: string;
    text: string;
    link: string;
    showBrandName: boolean;
  };
  menu: NavMenuItem[];
  auth: {
    loginText: string;
    loginLink: string;
    signupText: string;
    signupLink: string;
    accountLabel: string;
    dashboardText: string;
    dashboardLink: string;
    adminText: string;
    adminLink: string;
    logoutText: string;
  };
};

export type FooterLinkColumn = {
  title: string;
  links: NavLinkItem[];
};

export type FooterContent = {
  brand: {
    text: string;
    link: string;
    description: string;
    imageUrl: string;
    imageAlt: string;
    showBrandName: boolean;
  };
  columns: FooterLinkColumn[];
  copyright: string;
};

export const DEFAULT_HOME_CTA: HomeCtaContent = {
  title: 'Ready to Get Started?',
  subtitle: 'Join thousands of creators downloading smarter.',
  buttonText: 'Start Downloading Now',
  buttonLink: '/download',
};

export const DEFAULT_HOME_CONTENT: HomePageContent = {
  hero: {
    badge: '#1 All-in-One Video Downloader',
    title: 'Download Videos.',
    titleHighlight: 'Fast. Easy. Free.',
    subtitle:
      'Download videos, playlists, shorts, and reels. Convert to MP3, grab subtitles, and create upload-ready thumbnails — all in one place.',
    perks: ['Free 720p downloads', 'No ads on Pro', 'Blazing Fast', 'Secure & Safe'],
    mockOptions: ['1080p MP4', '720p MP4', 'MP3', 'Subtitles'],
  },
  features: {
    title: 'Everything You Need in One Place',
    subtitle: 'Powerful tools to download, convert, and optimize your video content.',
    items: [
      {
        icon: 'download',
        title: 'Video Downloader',
        desc: 'Download videos from YouTube, Facebook, Instagram, TikTok and more.',
      },
      {
        icon: 'listMusic',
        title: 'Playlist Downloader',
        desc: 'Download entire playlists and export as ZIP files.',
      },
      {
        icon: 'music',
        title: 'MP3 Converter',
        desc: 'Extract audio from any video in high quality MP3 format.',
      },
      {
        icon: 'captions',
        title: 'Subtitle Downloader',
        desc: 'Download subtitles in SRT, VTT, and TXT formats.',
      },
      {
        icon: 'image',
        title: 'Thumbnail Tools',
        desc: 'Download original thumbnails free. Pro adds AI adjust and generation.',
      },
      {
        icon: 'archive',
        title: 'ZIP Export',
        desc: 'Bundle multiple downloads into one convenient ZIP file.',
      },
    ],
  },
  steps: {
    title: 'Just 3 Simple Steps',
    items: [
      { title: 'Copy Video Link', desc: 'Find any video and copy its URL' },
      { title: 'Paste & Click Download', desc: 'Paste the link and hit download' },
      { title: 'Choose Format & Save', desc: 'Pick quality and save to your device' },
    ],
  },
  platforms: {
    title: 'Download From 1000+ Platforms',
    items: ['YouTube', 'Facebook', 'Instagram', 'TikTok', 'Twitter/X', 'Vimeo'],
  },
  pricingTeaser: {
    free: {
      title: 'Free Plan',
      price: '0',
      priceSuffix: '/ forever',
      features: [
        'Unlimited downloads (720p)',
        'Playlist, MP3 & subtitles',
        'Original thumbnail download',
        '7-day history with signup',
        'Ads shown',
      ],
    },
    pro: {
      badge: 'Most Popular',
      title: 'Pro Plan',
      price: '9.99',
      priceSuffix: '/ month',
      features: [
        '1080p, 4K & 8K downloads',
        'AI thumbnail adjust & generate',
        'Multiple ratios + custom prompts',
        'No ads · unlimited history',
      ],
      buttonText: 'Upgrade to Pro',
      buttonLink: '/pricing',
    },
  },
  cta: DEFAULT_HOME_CTA,
};

export const DEFAULT_PRICING_CONTENT: PricingPageContent = {
  header: {
    title: 'Simple Pricing',
    subtitle:
      'Downloads, playlists, audio, and subtitles are free. Pro unlocks AI thumbnails and HD/4K.',
  },
  free: {
    title: 'Free',
    price: '0',
    priceSuffix: '/ forever',
    features: [
      'Unlimited downloads up to 720p',
      'Playlist ZIP export (720p)',
      'Original thumbnail download',
      'MP3 / audio download',
      'Subtitle download (SRT, VTT)',
      '7-day download history (with signup)',
      'Ads supported',
      'YouTube, Facebook, Instagram, TikTok, Twitter/X',
    ],
    buttonText: 'Sign up free',
  },
  pro: {
    title: 'Pro',
    price: '9.99',
    priceSuffix: '/ month',
    features: [
      '1080p, 4K & 8K video downloads',
      'AI thumbnail adjust (text + image, OCR)',
      'Multiple thumbnail ratios (16:9, 9:16, 4:5, 1:1)',
      'Full AI thumbnail generation with prompts',
      'Global + custom user prompts',
      'No ads',
      'Unlimited download history',
    ],
  },
  footer: {
    line1: 'Pro features coming soon — HD/4K downloads, AI thumbnails, and more.',
    line2: 'Payments secured by Stripe, Binance Pay, and SSLCommerz.',
  },
};

export const DEFAULT_DOWNLOAD_CONTENT: DownloadPageContent = {
  analyzeButton: 'Analyze',
  successText: 'Video found successfully!',
  emptyTitle: 'Paste a video link to get started',
  emptySubtitle: 'Works with YouTube, Facebook, Instagram, TikTok, Twitter/X, and more.',
  loadingText: 'Analyzing video…',
  trustBadges: [
    'Unlimited Downloads',
    'Blazing Fast',
    '100% Safe',
    'Works Everywhere',
    'Regular Updates',
  ],
  helpTitle: 'Need Help?',
  helpLinks: [
    { label: 'How to download videos?', href: '/faq' },
    { label: 'Video not working?', href: '/faq' },
  ],
};

export const DEFAULT_TOOLS_CONTENT: ToolsPageContent = {
  title: 'Thumbnail Tools',
  subtitle:
    'Free: download the original thumbnail. Pro: AI adjust for any ratio. AI generate is coming soon.',
  videoUrlCardTitle: 'Video URL',
  loadButton: 'Load thumbnail',
  proCardTitle: 'Pro — AI Thumbnail Tools',
  proLockedText:
    'AI Adjust redesigns your thumbnail text and layout for YouTube, Shorts, Instagram, and more.',
  proUpgradeButton: 'Upgrade to Pro',
  generateComingSoonTitle: 'AI Thumbnail Generate',
  generateComingSoonText:
    'Full AI generation with custom prompts and CTR strategy — coming soon.',
};

export const DEFAULT_FAQ_CONTENT: FaqPageContent = {
  title: 'Frequently Asked Questions',
  subtitle: 'Quick answers about downloading videos, playlists, and Pro features.',
  items: [
    {
      question: 'Is HelloDownloader free?',
      answer:
        'Yes. You can download videos up to 720p, playlists, MP3, and subtitles for free. Pro unlocks HD/4K, AI thumbnails, and removes ads.',
    },
    {
      question: 'Which sites are supported?',
      answer:
        'YouTube, Facebook, Instagram, TikTok, Twitter/X, Vimeo, and many more. Paste any supported video link on the download page.',
    },
    {
      question: 'How do I download a video?',
      answer:
        'Copy the video URL, paste it on the Download page, click Analyze, then choose your format and quality.',
    },
    {
      question: 'Why is my video not working?',
      answer:
        'Some videos are private, age-restricted, or region-locked. Try another link or sign in on the source platform if required.',
    },
    {
      question: 'What does Pro include?',
      answer:
        'Pro adds 1080p–8K downloads, AI thumbnail tools, unlimited history, and no ads. Pro is coming in a future update.',
    },
  ],
};

export const DEFAULT_SIMPLE_PAGE: SimplePageContent = {
  title: 'Page title',
  body: 'Page content goes here.',
};

export const DEFAULT_TERMS_CONTENT: SimplePageContent = {
  title: 'Terms of Service',
  body: `Use HelloDownloader responsibly. Only download content you have rights to access.

By using this service you agree not to infringe copyrights or violate the terms of third-party platforms.

We may update these terms at any time. Continued use constitutes acceptance.`,
};

export const DEFAULT_PRIVACY_CONTENT: SimplePageContent = {
  title: 'Privacy Policy',
  body: `We collect account email, download history, and analytics to operate the service.

We do not sell your personal data. Payment processing is handled by third-party providers (Stripe, Binance Pay, SSLCommerz).

Contact us at privacy@hellodownloader.com with privacy questions.`,
};

export const DEFAULT_DMCA_CONTENT: SimplePageContent = {
  title: 'DMCA',
  body: `Report copyright concerns to dmca@hellodownloader.com with proof of ownership.

Include your contact information, identification of the copyrighted work, the URL in question, and a statement of good faith.

We respond to valid notices promptly.`,
};

export const DEFAULT_HEADER_CONTENT: HeaderContent = {
  logo: {
    imageUrl: '',
    imageAlt: '',
    text: 'HelloDownloader',
    link: '/',
    showBrandName: true,
  },
  menu: [
    { label: 'Home', href: '/' },
    {
      label: 'Downloads',
      children: [
        { label: 'Video Downloader', href: '/download' },
        { label: 'Playlist Downloader', href: '/playlist' },
      ],
    },
    { label: 'Thumbnail Tools', href: '/thumbnail' },
    { label: 'Pricing', href: '/pricing' },
    { label: 'FAQ', href: '/faq' },
  ],
  auth: {
    loginText: 'Log In',
    loginLink: '/login',
    signupText: 'Sign up',
    signupLink: '/register',
    accountLabel: 'Account',
    dashboardText: 'Dashboard',
    dashboardLink: '/dashboard',
    adminText: 'Admin',
    adminLink: '/admin',
    logoutText: 'Logout',
  },
};

export const DEFAULT_FOOTER_CONTENT: FooterContent = {
  brand: {
    text: 'HelloDownloader',
    link: '/',
    description: 'The all-in-one video downloader for creators. Fast, free, and secure.',
    imageUrl: '',
    imageAlt: '',
    showBrandName: true,
  },
  columns: [
    {
      title: 'Product',
      links: [
        { label: 'Downloader', href: '/download' },
        { label: 'Thumbnail Tools', href: '/thumbnail' },
        { label: 'Playlist', href: '/playlist' },
        { label: 'Pricing', href: '/pricing' },
      ],
    },
    {
      title: 'Company',
      links: [
        { label: 'FAQ', href: '/faq' },
        { label: 'Dashboard', href: '/dashboard' },
      ],
    },
    {
      title: 'Legal',
      links: [
        { label: 'Terms', href: '/terms' },
        { label: 'Privacy', href: '/privacy' },
        { label: 'DMCA', href: '/dmca' },
      ],
    },
  ],
  copyright: '© {year} HelloDownloader. All rights reserved.',
};

export const PAGE_DEFAULTS: Record<string, Record<string, unknown>> = {
  header: DEFAULT_HEADER_CONTENT as unknown as Record<string, unknown>,
  footer: DEFAULT_FOOTER_CONTENT as unknown as Record<string, unknown>,
  home: DEFAULT_HOME_CONTENT as unknown as Record<string, unknown>,
  pricing: DEFAULT_PRICING_CONTENT as unknown as Record<string, unknown>,
  download: DEFAULT_DOWNLOAD_CONTENT as unknown as Record<string, unknown>,
  tools: DEFAULT_TOOLS_CONTENT as unknown as Record<string, unknown>,
  faq: DEFAULT_FAQ_CONTENT as unknown as Record<string, unknown>,
  terms: DEFAULT_TERMS_CONTENT as unknown as Record<string, unknown>,
  privacy: DEFAULT_PRIVACY_CONTENT as unknown as Record<string, unknown>,
  dmca: DEFAULT_DMCA_CONTENT as unknown as Record<string, unknown>,
};

export const DEFAULT_CONTENT_PAGES: Array<{
  slug: string;
  title: string;
  sections: Record<string, unknown>;
}> = [
  { slug: 'header', title: 'Header & Menu', sections: PAGE_DEFAULTS.header },
  { slug: 'footer', title: 'Footer', sections: PAGE_DEFAULTS.footer },
  { slug: 'home', title: 'Home page', sections: PAGE_DEFAULTS.home },
  { slug: 'pricing', title: 'Pricing page', sections: PAGE_DEFAULTS.pricing },
  { slug: 'download', title: 'Download page', sections: PAGE_DEFAULTS.download },
  { slug: 'tools', title: 'Thumbnail Tools', sections: PAGE_DEFAULTS.tools },
  { slug: 'faq', title: 'FAQ page', sections: PAGE_DEFAULTS.faq },
  { slug: 'terms', title: 'Terms of Service', sections: PAGE_DEFAULTS.terms },
  { slug: 'privacy', title: 'Privacy Policy', sections: PAGE_DEFAULTS.privacy },
  { slug: 'dmca', title: 'DMCA', sections: PAGE_DEFAULTS.dmca },
];

export function mergeContent<T extends Record<string, unknown>>(
  defaults: T,
  patch?: Record<string, unknown> | null,
): T {
  if (!patch) return defaults;
  const out = { ...defaults } as Record<string, unknown>;
  for (const [key, value] of Object.entries(patch)) {
    if (
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      typeof out[key] === 'object' &&
      out[key] !== null &&
      !Array.isArray(out[key])
    ) {
      out[key] = mergeContent(out[key] as Record<string, unknown>, value as Record<string, unknown>);
    } else if (value !== undefined) {
      out[key] = value;
    }
  }
  return out as T;
}

export function mergePageSections(
  slug: string,
  sections?: Record<string, unknown> | null,
): Record<string, unknown> {
  const defaults = PAGE_DEFAULTS[slug];
  const merged = defaults
    ? mergeContent(defaults, sections ?? {})
    : mergeContent(DEFAULT_SIMPLE_PAGE as unknown as Record<string, unknown>, sections ?? {});

  return {
    ...merged,
    seo: mergePageSeo(merged.seo as Partial<PageSeoContent> | undefined),
  };
}
