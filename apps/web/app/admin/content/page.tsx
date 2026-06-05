'use client';

import { useCallback, useEffect, useState } from 'react';
import { FileText, Plus } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { AdminPageHeader } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  BUILT_IN,
  DownloadPageEditor,
  FaqPageEditor,
  FooterPageEditor,
  HeaderPageEditor,
  HomePageEditor,
  parseSectionsForSlug,
  PricingPageEditor,
  SimplePageEditor,
  ToolsPageEditor,
} from '@/components/admin/content/PageEditors';
import type {
  DownloadPageContent,
  FaqPageContent,
  FooterContent,
  HeaderContent,
  HomePageContent,
  PricingPageContent,
  SimplePageContent,
  ToolsPageContent,
} from '@hellodownloader/shared-types';

type ContentPage = {
  slug: string;
  title: string;
  published: boolean;
  sections: Record<string, unknown>;
  updatedAt: string;
};

export default function AdminContentPage() {
  const [pages, setPages] = useState<ContentPage[]>([]);
  const [selected, setSelected] = useState('home');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [published, setPublished] = useState(true);
  const [sections, setSections] = useState<Record<string, unknown>>({});
  const [newSlug, setNewSlug] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [showNew, setShowNew] = useState(false);

  const loadPages = useCallback(() => {
    apiClient.admin
      .listContentPages()
      .then((rows) => setPages(rows as ContentPage[]))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load pages'));
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  useEffect(() => {
    const page = pages.find((p) => p.slug === selected);
    if (!page) return;
    setPublished(page.published);
    setSections(page.sections);
  }, [pages, selected]);

  const save = async () => {
    setSaving(true);
    setMsg(null);
    setError(null);
    try {
      await apiClient.admin.updateContentPage(selected, { published, sections });
      setMsg(`${selectedPage?.title ?? 'Page'} saved.`);
      loadPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const createPage = async () => {
    if (!newSlug.trim() || !newTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await apiClient.admin.createContentPage({
        slug: newSlug.trim().toLowerCase(),
        title: newTitle.trim(),
      });
      setNewSlug('');
      setNewTitle('');
      setShowNew(false);
      setSelected(newSlug.trim().toLowerCase());
      setMsg('Page created.');
      loadPages();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  };

  const selectedPage = pages.find((p) => p.slug === selected);

  const renderEditor = () => {
    if (!selectedPage) return null;

    if (selected === 'footer') {
      const footer = parseSectionsForSlug('footer', sections) as FooterContent;
      return (
        <FooterPageEditor
          sections={footer}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'header') {
      const header = parseSectionsForSlug('header', sections) as HeaderContent;
      return (
        <HeaderPageEditor
          sections={header}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'home') {
      const home = parseSectionsForSlug('home', sections) as HomePageContent;
      return (
        <HomePageEditor
          sections={home}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'pricing') {
      const pricing = parseSectionsForSlug('pricing', sections) as PricingPageContent;
      return (
        <PricingPageEditor
          sections={pricing}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'download') {
      const download = parseSectionsForSlug('download', sections) as DownloadPageContent;
      return (
        <DownloadPageEditor
          sections={download}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'tools') {
      const tools = parseSectionsForSlug('tools', sections) as ToolsPageContent;
      return (
        <ToolsPageEditor
          sections={tools}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    if (selected === 'faq') {
      const faq = parseSectionsForSlug('faq', sections) as FaqPageContent;
      return (
        <FaqPageEditor
          sections={faq}
          published={published}
          onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
          onPublishedChange={setPublished}
        />
      );
    }
    const simple = parseSectionsForSlug(selected, sections) as SimplePageContent;
    return (
      <SimplePageEditor
        slug={selected}
        sections={simple}
        published={published}
        onSectionsChange={(s) => setSections(s as unknown as Record<string, unknown>)}
        onPublishedChange={setPublished}
      />
    );
  };

  return (
    <>
      <AdminPageHeader
        title="Content"
        description="Edit header, footer, logo, menus, and all page copy"
      />

      {msg && <p className="text-sm text-emerald-400 mb-4">{msg}</p>}
      {error && <p className="text-sm text-destructive mb-4">{error}</p>}

      <div className="grid lg:grid-cols-[240px_1fr] gap-6">
        <aside className="rounded-xl border border-white/10 bg-card p-4 space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide px-2 mb-2">
            Pages
          </p>
          {pages.map((page) => (
            <button
              key={page.slug}
              type="button"
              onClick={() => setSelected(page.slug)}
              className={`w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-left transition ${
                selected === page.slug
                  ? 'bg-primary/15 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-white/5 hover:text-foreground'
              }`}
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{page.title}</span>
            </button>
          ))}

          {!showNew ? (
            <Button type="button" variant="outline" size="sm" className="w-full mt-2" onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4 mr-1" />
              New page
            </Button>
          ) : (
            <div className="mt-2 space-y-2 border-t border-white/10 pt-3">
              <Input placeholder="slug (e.g. about)" value={newSlug} onChange={(e) => setNewSlug(e.target.value)} />
              <Input placeholder="Page title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
              <div className="flex gap-2">
                <Button type="button" size="sm" onClick={createPage} disabled={saving}>
                  Create
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setShowNew(false)}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </aside>

        <div className="rounded-xl border border-white/10 bg-card p-6">
          {!selectedPage ? (
            <p className="text-sm text-muted-foreground">Select a page.</p>
          ) : (
            <>
              <div className="mb-6">
                <h2 className="text-lg font-semibold">{selectedPage.title}</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {selected === 'header' || selected === 'footer'
                    ? 'Site-wide on all pages'
                    : BUILT_IN.has(selected) && selected !== 'header' && selected !== 'footer'
                      ? `Built-in route: /${selected === 'tools' ? 'thumbnail' : selected}`
                      : `Custom route: /p/${selected}`}
                </p>
              </div>
              {renderEditor()}
              <div className="mt-8 pt-6 border-t border-white/10">
                <Button type="button" onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save changes'}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
