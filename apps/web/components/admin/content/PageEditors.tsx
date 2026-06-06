'use client';

import {
  DEFAULT_DOWNLOAD_CONTENT,
  DEFAULT_FAQ_CONTENT,
  DEFAULT_FOOTER_CONTENT,
  DEFAULT_HEADER_CONTENT,
  DEFAULT_HOME_CONTENT,
  DEFAULT_PRICING_CONTENT,
  DEFAULT_SIMPLE_PAGE,
  DEFAULT_TERMS_CONTENT,
  DEFAULT_PRIVACY_CONTENT,
  DEFAULT_DMCA_CONTENT,
  DEFAULT_TOOLS_CONTENT,
  mergeContent,
  PAGE_DEFAULTS,
  type DownloadPageContent,
  type FaqPageContent,
  type FooterContent,
  type HeaderContent,
  type HomePageContent,
  type NavMenuItem,
  type PricingPageContent,
  type SimplePageContent,
  type ToolsPageContent,
} from '@hellodownloader/shared-types';
import { Field, PublishedToggle, SectionBlock, StringListEditor, TextArea } from './ContentFields';
import { LogoUploadField } from './ImageUploadField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const BUILT_IN = new Set(Object.keys(PAGE_DEFAULTS));

const BUILT_IN_PUBLIC_PATHS: Record<string, string> = {
  terms: '/terms',
  privacy: '/privacy',
  dmca: '/dmca',
};

export function HomePageEditor({
  sections,
  published,
  onSectionsChange,
  onPublishedChange,
}: {
  sections: HomePageContent;
  published: boolean;
  onSectionsChange: (s: HomePageContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<HomePageContent>) => onSectionsChange({ ...sections, ...patch });

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />

      <SectionBlock title="Hero">
        <Field label="Badge" value={sections.hero.badge} onChange={(v) => set({ hero: { ...sections.hero, badge: v } })} />
        <Field label="Title" value={sections.hero.title} onChange={(v) => set({ hero: { ...sections.hero, title: v } })} />
        <Field label="Title highlight (gradient)" value={sections.hero.titleHighlight} onChange={(v) => set({ hero: { ...sections.hero, titleHighlight: v } })} />
        <TextArea label="Subtitle" value={sections.hero.subtitle} onChange={(v) => set({ hero: { ...sections.hero, subtitle: v } })} rows={3} />
        <StringListEditor label="Perk labels" items={sections.hero.perks} onChange={(items) => set({ hero: { ...sections.hero, perks: items } })} />
        <StringListEditor label="Mock download options" items={sections.hero.mockOptions} onChange={(items) => set({ hero: { ...sections.hero, mockOptions: items } })} />
      </SectionBlock>

      <SectionBlock title="Features">
        <Field label="Section title" value={sections.features.title} onChange={(v) => set({ features: { ...sections.features, title: v } })} />
        <Field label="Section subtitle" value={sections.features.subtitle} onChange={(v) => set({ features: { ...sections.features, subtitle: v } })} />
        {sections.features.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <p className="text-xs text-muted-foreground">Feature {i + 1}</p>
            <Field label="Icon key (download, listMusic, music, captions, image, archive)" value={item.icon} onChange={(v) => {
              const items = [...sections.features.items];
              items[i] = { ...item, icon: v };
              set({ features: { ...sections.features, items } });
            }} />
            <Field label="Title" value={item.title} onChange={(v) => {
              const items = [...sections.features.items];
              items[i] = { ...item, title: v };
              set({ features: { ...sections.features, items } });
            }} />
            <Field label="Description" value={item.desc} onChange={(v) => {
              const items = [...sections.features.items];
              items[i] = { ...item, desc: v };
              set({ features: { ...sections.features, items } });
            }} />
          </div>
        ))}
      </SectionBlock>

      <SectionBlock title="How it works">
        <Field label="Section title" value={sections.steps.title} onChange={(v) => set({ steps: { ...sections.steps, title: v } })} />
        {sections.steps.items.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-2">
            <Field label={`Step ${i + 1} title`} value={item.title} onChange={(v) => {
              const items = [...sections.steps.items];
              items[i] = { ...item, title: v };
              set({ steps: { ...sections.steps, items } });
            }} />
            <Field label="Description" value={item.desc} onChange={(v) => {
              const items = [...sections.steps.items];
              items[i] = { ...item, desc: v };
              set({ steps: { ...sections.steps, items } });
            }} />
          </div>
        ))}
      </SectionBlock>

      <SectionBlock title="Platforms">
        <Field label="Section title" value={sections.platforms.title} onChange={(v) => set({ platforms: { ...sections.platforms, title: v } })} />
        <StringListEditor label="Platform names" items={sections.platforms.items} onChange={(items) => set({ platforms: { ...sections.platforms, items } })} />
      </SectionBlock>

      <SectionBlock title="Pricing teaser">
        <Field label="Free plan title" value={sections.pricingTeaser.free.title} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, free: { ...sections.pricingTeaser.free, title: v } } })} />
        <Field label="Free price" value={sections.pricingTeaser.free.price} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, free: { ...sections.pricingTeaser.free, price: v } } })} />
        <Field label="Free price suffix" value={sections.pricingTeaser.free.priceSuffix} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, free: { ...sections.pricingTeaser.free, priceSuffix: v } } })} />
        <StringListEditor label="Free features" items={sections.pricingTeaser.free.features} onChange={(items) => set({ pricingTeaser: { ...sections.pricingTeaser, free: { ...sections.pricingTeaser.free, features: items } } })} />
        <Field label="Pro badge" value={sections.pricingTeaser.pro.badge ?? ''} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, badge: v } } })} />
        <Field label="Pro plan title" value={sections.pricingTeaser.pro.title} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, title: v } } })} />
        <Field label="Pro price" value={sections.pricingTeaser.pro.price} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, price: v } } })} />
        <Field label="Pro price suffix" value={sections.pricingTeaser.pro.priceSuffix} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, priceSuffix: v } } })} />
        <StringListEditor label="Pro features" items={sections.pricingTeaser.pro.features} onChange={(items) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, features: items } } })} />
        <Field label="Pro button text" value={sections.pricingTeaser.pro.buttonText ?? ''} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, buttonText: v } } })} />
        <Field label="Pro button link" value={sections.pricingTeaser.pro.buttonLink ?? ''} onChange={(v) => set({ pricingTeaser: { ...sections.pricingTeaser, pro: { ...sections.pricingTeaser.pro, buttonLink: v } } })} />
      </SectionBlock>

      <SectionBlock title="CTA banner">
        <Field label="Headline" value={sections.cta.title} onChange={(v) => set({ cta: { ...sections.cta, title: v } })} />
        <Field label="Subtext" value={sections.cta.subtitle} onChange={(v) => set({ cta: { ...sections.cta, subtitle: v } })} />
        <Field label="Button text" value={sections.cta.buttonText} onChange={(v) => set({ cta: { ...sections.cta, buttonText: v } })} />
        <Field label="Button link" value={sections.cta.buttonLink} onChange={(v) => set({ cta: { ...sections.cta, buttonLink: v } })} />
      </SectionBlock>
    </div>
  );
}

export function PricingPageEditor({ sections, published, onSectionsChange, onPublishedChange }: {
  sections: PricingPageContent;
  published: boolean;
  onSectionsChange: (s: PricingPageContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<PricingPageContent>) => onSectionsChange({ ...sections, ...patch });

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <SectionBlock title="Header">
        <Field label="Title" value={sections.header.title} onChange={(v) => set({ header: { ...sections.header, title: v } })} />
        <TextArea label="Subtitle" value={sections.header.subtitle} onChange={(v) => set({ header: { ...sections.header, subtitle: v } })} />
      </SectionBlock>
      <SectionBlock title="Free plan">
        <Field label="Title" value={sections.free.title} onChange={(v) => set({ free: { ...sections.free, title: v } })} />
        <Field label="Price" value={sections.free.price} onChange={(v) => set({ free: { ...sections.free, price: v } })} />
        <Field label="Price suffix" value={sections.free.priceSuffix} onChange={(v) => set({ free: { ...sections.free, priceSuffix: v } })} />
        <Field label="Button text (logged out)" value={sections.free.buttonText} onChange={(v) => set({ free: { ...sections.free, buttonText: v } })} />
        <StringListEditor label="Features" items={sections.free.features} onChange={(items) => set({ free: { ...sections.free, features: items } })} />
      </SectionBlock>
      <SectionBlock title="Pro plan">
        <Field label="Title" value={sections.pro.title} onChange={(v) => set({ pro: { ...sections.pro, title: v } })} />
        <Field label="Price" value={sections.pro.price} onChange={(v) => set({ pro: { ...sections.pro, price: v } })} />
        <Field label="Price suffix" value={sections.pro.priceSuffix} onChange={(v) => set({ pro: { ...sections.pro, priceSuffix: v } })} />
        <StringListEditor label="Features" items={sections.pro.features} onChange={(items) => set({ pro: { ...sections.pro, features: items } })} />
      </SectionBlock>
      <SectionBlock title="Footer notes">
        <Field label="Line 1" value={sections.footer.line1} onChange={(v) => set({ footer: { ...sections.footer, line1: v } })} />
        <Field label="Line 2" value={sections.footer.line2} onChange={(v) => set({ footer: { ...sections.footer, line2: v } })} />
      </SectionBlock>
    </div>
  );
}

export function DownloadPageEditor({ sections, published, onSectionsChange, onPublishedChange }: {
  sections: DownloadPageContent;
  published: boolean;
  onSectionsChange: (s: DownloadPageContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<DownloadPageContent>) => onSectionsChange({ ...sections, ...patch });

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <Field label="Analyze button" value={sections.analyzeButton} onChange={(v) => set({ analyzeButton: v })} />
      <Field label="Success message" value={sections.successText} onChange={(v) => set({ successText: v })} />
      <Field label="Empty state title" value={sections.emptyTitle} onChange={(v) => set({ emptyTitle: v })} />
      <Field label="Empty state subtitle" value={sections.emptySubtitle} onChange={(v) => set({ emptySubtitle: v })} />
      <Field label="Loading text" value={sections.loadingText} onChange={(v) => set({ loadingText: v })} />
      <StringListEditor label="Trust badges (footer)" items={sections.trustBadges} onChange={(items) => set({ trustBadges: items })} />
      <Field label="Help box title" value={sections.helpTitle} onChange={(v) => set({ helpTitle: v })} />
      {sections.helpLinks.map((link, i) => (
        <div key={i} className="flex gap-2">
          <Input value={link.label} placeholder="Label" onChange={(e) => {
            const helpLinks = [...sections.helpLinks];
            helpLinks[i] = { ...link, label: e.target.value };
            set({ helpLinks });
          }} />
          <Input value={link.href} placeholder="/faq" onChange={(e) => {
            const helpLinks = [...sections.helpLinks];
            helpLinks[i] = { ...link, href: e.target.value };
            set({ helpLinks });
          }} />
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set({ helpLinks: [...sections.helpLinks, { label: '', href: '/faq' }] })}>
        Add help link
      </Button>
    </div>
  );
}

export function ToolsPageEditor({ sections, published, onSectionsChange, onPublishedChange }: {
  sections: ToolsPageContent;
  published: boolean;
  onSectionsChange: (s: ToolsPageContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<ToolsPageContent>) => onSectionsChange({ ...sections, ...patch });

  return (
    <div className="space-y-4 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <Field label="Page title" value={sections.title} onChange={(v) => set({ title: v })} />
      <TextArea label="Subtitle" value={sections.subtitle} onChange={(v) => set({ subtitle: v })} />
      <Field label="Video URL card title" value={sections.videoUrlCardTitle} onChange={(v) => set({ videoUrlCardTitle: v })} />
      <Field label="Load button" value={sections.loadButton} onChange={(v) => set({ loadButton: v })} />
      <Field label="Pro card title" value={sections.proCardTitle} onChange={(v) => set({ proCardTitle: v })} />
      <TextArea label="Pro locked message" value={sections.proLockedText} onChange={(v) => set({ proLockedText: v })} />
      <Field label="Upgrade button" value={sections.proUpgradeButton} onChange={(v) => set({ proUpgradeButton: v })} />
      <Field
        label="Generate coming soon title"
        value={sections.generateComingSoonTitle}
        onChange={(v) => set({ generateComingSoonTitle: v })}
      />
      <TextArea
        label="Generate coming soon message"
        value={sections.generateComingSoonText}
        onChange={(v) => set({ generateComingSoonText: v })}
      />
    </div>
  );
}

export function FaqPageEditor({ sections, published, onSectionsChange, onPublishedChange }: {
  sections: FaqPageContent;
  published: boolean;
  onSectionsChange: (s: FaqPageContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<FaqPageContent>) => onSectionsChange({ ...sections, ...patch });

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <Field label="Page title" value={sections.title} onChange={(v) => set({ title: v })} />
      <Field label="Subtitle" value={sections.subtitle} onChange={(v) => set({ subtitle: v })} />
      {sections.items.map((item, i) => (
        <div key={i} className="rounded-lg border border-border p-4 space-y-2">
          <Field label="Question" value={item.question} onChange={(v) => {
            const items = [...sections.items];
            items[i] = { ...item, question: v };
            set({ items });
          }} />
          <TextArea label="Answer" value={item.answer} onChange={(v) => {
            const items = [...sections.items];
            items[i] = { ...item, answer: v };
            set({ items });
          }} rows={3} />
          <Button type="button" variant="outline" size="sm" onClick={() => set({ items: sections.items.filter((_, j) => j !== i) })}>
            Remove
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={() => set({ items: [...sections.items, { question: '', answer: '' }] })}>
        Add question
      </Button>
    </div>
  );
}

export function SimplePageEditor({ sections, published, onSectionsChange, onPublishedChange, slug }: {
  sections: SimplePageContent;
  published: boolean;
  onSectionsChange: (s: SimplePageContent) => void;
  onPublishedChange: (v: boolean) => void;
  slug: string;
}) {
  const publicPath = BUILT_IN_PUBLIC_PATHS[slug] ?? `/p/${slug}`;

  return (
    <div className="space-y-4 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <p className="text-xs text-muted-foreground">
        Public URL: <code>{publicPath}</code>
        {BUILT_IN_PUBLIC_PATHS[slug] ? ' (built-in page)' : ' (publish to make it live)'}
      </p>
      <Field label="Page title" value={sections.title} onChange={(v) => onSectionsChange({ ...sections, title: v })} />
      <TextArea label="Body text" value={sections.body} onChange={(v) => onSectionsChange({ ...sections, body: v })} rows={12} />
    </div>
  );
}

export function HeaderPageEditor({
  sections,
  published,
  onSectionsChange,
  onPublishedChange,
}: {
  sections: HeaderContent;
  published: boolean;
  onSectionsChange: (s: HeaderContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<HeaderContent>) => onSectionsChange({ ...sections, ...patch });

  const updateMenuItem = (index: number, patch: Partial<NavMenuItem>) => {
    const menu = [...sections.menu];
    menu[index] = { ...menu[index], ...patch };
    set({ menu });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <p className="text-xs text-muted-foreground">
        Controls the site header on every page — logo, navigation, and account menu labels.
      </p>

      <SectionBlock title="Logo">
        <LogoUploadField
          label="Logo icon"
          hint="Upload your icon/mark only (without text). Brand name is shown separately beside the icon."
          value={sections.logo.imageUrl}
          onChange={(v) => set({ logo: { ...sections.logo, imageUrl: v } })}
        />
        <Field
          label="Logo alt text"
          value={sections.logo.imageAlt ?? ''}
          onChange={(v) => set({ logo: { ...sections.logo, imageAlt: v } })}
          placeholder="HelloDownloader logo"
        />
        <Field
          label="Brand name"
          value={sections.logo.text}
          onChange={(v) => set({ logo: { ...sections.logo, text: v } })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sections.logo.showBrandName !== false}
            onChange={(e) => set({ logo: { ...sections.logo, showBrandName: e.target.checked } })}
            className="rounded"
          />
          Show brand name next to icon
        </label>
        <Field
          label="Logo link"
          value={sections.logo.link}
          onChange={(v) => set({ logo: { ...sections.logo, link: v } })}
        />
      </SectionBlock>

      <SectionBlock title="Navigation menu">
        <p className="text-xs text-muted-foreground mb-2">
          Add <strong>dropdown items</strong> under a menu entry, or set a direct link with href (leave children empty).
        </p>
        {sections.menu.map((item, i) => (
          <div key={i} className="rounded-lg border border-border p-4 space-y-3">
            <p className="text-xs font-medium text-muted-foreground">Menu item {i + 1}</p>
            <Field label="Label" value={item.label} onChange={(v) => updateMenuItem(i, { label: v })} />
            <Field
              label="Direct link (optional — leave empty when using dropdown)"
              value={item.href ?? ''}
              onChange={(v) => updateMenuItem(i, { href: v || undefined })}
              placeholder="/pricing"
              disabled={Boolean(item.children?.length)}
            />
            {(item.children?.length ?? 0) > 0 && (
              <p className="text-xs text-amber-400/90">
                Dropdown active — direct link is ignored. Remove all dropdown links to use a single link instead.
              </p>
            )}
            {(item.children ?? []).map((child, j) => (
              <div key={j} className="flex gap-2 pl-2 border-l-2 border-primary/30">
                <Input
                  value={child.label}
                  placeholder="Dropdown label"
                  onChange={(e) => {
                    const children = [...(item.children ?? [])];
                    children[j] = { ...child, label: e.target.value };
                    updateMenuItem(i, { children });
                  }}
                />
                <Input
                  value={child.href}
                  placeholder="/download"
                  onChange={(e) => {
                    const children = [...(item.children ?? [])];
                    children[j] = { ...child, href: e.target.value };
                    updateMenuItem(i, { children });
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    updateMenuItem(i, {
                      children: (item.children ?? []).filter((_, k) => k !== j),
                    })
                  }
                >
                  ×
                </Button>
              </div>
            ))}
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateMenuItem(i, {
                    href: undefined,
                    children: [...(item.children ?? []), { label: 'New link', href: '/' }],
                  })
                }
              >
                Add dropdown link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set({ menu: sections.menu.filter((_, idx) => idx !== i) })}
              >
                Remove menu item
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set({ menu: [...sections.menu, { label: 'New item', href: '/' }] })}
        >
          Add menu item
        </Button>
      </SectionBlock>

      <SectionBlock title="Auth buttons (logged out)">
        <Field label="Log in text" value={sections.auth.loginText} onChange={(v) => set({ auth: { ...sections.auth, loginText: v } })} />
        <Field label="Log in link" value={sections.auth.loginLink} onChange={(v) => set({ auth: { ...sections.auth, loginLink: v } })} />
        <Field label="Sign up text" value={sections.auth.signupText} onChange={(v) => set({ auth: { ...sections.auth, signupText: v } })} />
        <Field label="Sign up link" value={sections.auth.signupLink} onChange={(v) => set({ auth: { ...sections.auth, signupLink: v } })} />
      </SectionBlock>

      <SectionBlock title="Account dropdown (logged in)">
        <Field label="Dropdown label" value={sections.auth.accountLabel} onChange={(v) => set({ auth: { ...sections.auth, accountLabel: v } })} />
        <Field label="Dashboard text" value={sections.auth.dashboardText} onChange={(v) => set({ auth: { ...sections.auth, dashboardText: v } })} />
        <Field label="Dashboard link" value={sections.auth.dashboardLink} onChange={(v) => set({ auth: { ...sections.auth, dashboardLink: v } })} />
        <Field label="Admin text" value={sections.auth.adminText} onChange={(v) => set({ auth: { ...sections.auth, adminText: v } })} />
        <Field label="Admin link" value={sections.auth.adminLink} onChange={(v) => set({ auth: { ...sections.auth, adminLink: v } })} />
        <Field label="Logout text" value={sections.auth.logoutText} onChange={(v) => set({ auth: { ...sections.auth, logoutText: v } })} />
      </SectionBlock>
    </div>
  );
}

export function FooterPageEditor({
  sections,
  published,
  onSectionsChange,
  onPublishedChange,
}: {
  sections: FooterContent;
  published: boolean;
  onSectionsChange: (s: FooterContent) => void;
  onPublishedChange: (v: boolean) => void;
}) {
  const set = (patch: Partial<FooterContent>) => onSectionsChange({ ...sections, ...patch });

  const updateColumn = (colIndex: number, patch: Partial<FooterContent['columns'][0]>) => {
    const columns = [...sections.columns];
    columns[colIndex] = { ...columns[colIndex], ...patch };
    set({ columns });
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <PublishedToggle published={published} onChange={onPublishedChange} />
      <p className="text-xs text-muted-foreground">
        Site footer on every page. Use {'{year}'} in copyright for the current year.
      </p>

      <SectionBlock title="Brand">
        <LogoUploadField
          label="Logo icon"
          hint="Upload your icon/mark only (without text). Brand name is shown separately beside the icon."
          value={sections.brand.imageUrl ?? ''}
          onChange={(v) => set({ brand: { ...sections.brand, imageUrl: v } })}
        />
        <Field
          label="Logo alt text"
          value={sections.brand.imageAlt ?? ''}
          onChange={(v) => set({ brand: { ...sections.brand, imageAlt: v } })}
          placeholder="HelloDownloader logo"
        />
        <Field label="Brand name" value={sections.brand.text} onChange={(v) => set({ brand: { ...sections.brand, text: v } })} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={sections.brand.showBrandName !== false}
            onChange={(e) => set({ brand: { ...sections.brand, showBrandName: e.target.checked } })}
            className="rounded"
          />
          Show brand name next to icon
        </label>
        <Field label="Brand link" value={sections.brand.link} onChange={(v) => set({ brand: { ...sections.brand, link: v } })} />
        <TextArea label="Description" value={sections.brand.description} onChange={(v) => set({ brand: { ...sections.brand, description: v } })} rows={3} />
      </SectionBlock>

      <SectionBlock title="Link columns">
        {sections.columns.map((col, colIndex) => (
          <div key={colIndex} className="rounded-lg border border-border p-4 space-y-3">
            <Field label="Column title" value={col.title} onChange={(v) => updateColumn(colIndex, { title: v })} />
            {col.links.map((link, linkIndex) => (
              <div key={linkIndex} className="flex gap-2">
                <Input
                  value={link.label}
                  placeholder="Label"
                  onChange={(e) => {
                    const links = [...col.links];
                    links[linkIndex] = { ...link, label: e.target.value };
                    updateColumn(colIndex, { links });
                  }}
                />
                <Input
                  value={link.href}
                  placeholder="/path"
                  onChange={(e) => {
                    const links = [...col.links];
                    links[linkIndex] = { ...link, href: e.target.value };
                    updateColumn(colIndex, { links });
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => updateColumn(colIndex, { links: col.links.filter((_, i) => i !== linkIndex) })}
                >
                  ×
                </Button>
              </div>
            ))}
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateColumn(colIndex, { links: [...col.links, { label: 'New link', href: '/' }] })}
              >
                Add link
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => set({ columns: sections.columns.filter((_, i) => i !== colIndex) })}
              >
                Remove column
              </Button>
            </div>
          </div>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => set({ columns: [...sections.columns, { title: 'New column', links: [] }] })}
        >
          Add column
        </Button>
      </SectionBlock>

      <SectionBlock title="Copyright">
        <Field
          label="Copyright text"
          value={sections.copyright}
          onChange={(v) => set({ copyright: v })}
          placeholder="© {year} HelloDownloader. All rights reserved."
        />
      </SectionBlock>
    </div>
  );
}

export function parseSectionsForSlug(slug: string, raw: Record<string, unknown>) {
  if (slug === 'header') return mergeContent(DEFAULT_HEADER_CONTENT, raw) as HeaderContent;
  if (slug === 'footer') return mergeContent(DEFAULT_FOOTER_CONTENT, raw) as FooterContent;
  if (slug === 'home') return mergeContent(DEFAULT_HOME_CONTENT, raw) as HomePageContent;
  if (slug === 'pricing') return mergeContent(DEFAULT_PRICING_CONTENT, raw) as PricingPageContent;
  if (slug === 'download') return mergeContent(DEFAULT_DOWNLOAD_CONTENT, raw) as DownloadPageContent;
  if (slug === 'tools') return mergeContent(DEFAULT_TOOLS_CONTENT, raw) as ToolsPageContent;
  if (slug === 'faq') return mergeContent(DEFAULT_FAQ_CONTENT, raw) as FaqPageContent;
  if (slug === 'terms') return mergeContent(DEFAULT_TERMS_CONTENT, raw) as SimplePageContent;
  if (slug === 'privacy') return mergeContent(DEFAULT_PRIVACY_CONTENT, raw) as SimplePageContent;
  if (slug === 'dmca') return mergeContent(DEFAULT_DMCA_CONTENT, raw) as SimplePageContent;
  return mergeContent(DEFAULT_SIMPLE_PAGE, raw) as SimplePageContent;
}

export { BUILT_IN };
