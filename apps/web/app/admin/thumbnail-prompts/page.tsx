'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Eye,
  Loader2,
  Plus,
  Save,
  Search,
  Trash2,
} from 'lucide-react';
import { AdminPageHeader, StatusBadge } from '@/components/admin/AdminShell';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToastStack, useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api';
import {
  THUMBNAIL_CATEGORY_OPTIONS,
  THUMBNAIL_PROMPT_TYPES,
  type ThumbnailPromptPreviewResult,
  type ThumbnailPromptRecord,
  type ThumbnailPromptStatus,
  type ThumbnailPromptType,
} from '@hellodownloader/shared-types';

type PromptDraft = {
  name: string;
  content: string;
  status: ThumbnailPromptStatus;
};

const emptyDraft: PromptDraft = { name: '', content: '', status: 'enabled' };

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

function PromptStatusToggle({
  status,
  onChange,
  disabled,
}: {
  status: ThumbnailPromptStatus;
  onChange: (status: ThumbnailPromptStatus) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        checked={status === 'enabled'}
        onCheckedChange={(checked) => onChange(checked ? 'enabled' : 'disabled')}
        disabled={disabled}
      />
      <span className="text-sm text-muted-foreground">
        {status === 'enabled' ? 'Enabled' : 'Disabled'}
      </span>
    </div>
  );
}

export default function AdminThumbnailPromptsPage() {
  const { toasts, dismiss, success, error: toastError } = useToast();
  const [loading, setLoading] = useState(true);
  const [prompts, setPrompts] = useState<ThumbnailPromptRecord[]>([]);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | ThumbnailPromptType>('all');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [creatingCategory, setCreatingCategory] = useState(false);
  const [newCategory, setNewCategory] = useState<PromptDraft>(emptyDraft);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryDrafts, setCategoryDrafts] = useState<Record<string, PromptDraft>>({});

  const [globalDraft, setGlobalDraft] = useState<PromptDraft>(emptyDraft);
  const [adjustDraft, setAdjustDraft] = useState<PromptDraft>(emptyDraft);

  const [previewMode, setPreviewMode] = useState<'generate' | 'adjust'>('generate');
  const [previewCategorySlug, setPreviewCategorySlug] = useState('emotional-story');
  const [previewStrategy, setPreviewStrategy] = useState('');
  const [previewInstructions, setPreviewInstructions] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResult, setPreviewResult] = useState<ThumbnailPromptPreviewResult | null>(null);

  const globalPrompt = useMemo(
    () => prompts.find((p) => p.type === 'global') ?? null,
    [prompts],
  );
  const adjustPrompt = useMemo(
    () => prompts.find((p) => p.type === 'adjust') ?? null,
    [prompts],
  );
  const categoryPrompts = useMemo(
    () => prompts.filter((p) => p.type === 'category'),
    [prompts],
  );

  const filteredCategories = useMemo(() => {
    const q = search.trim().toLowerCase();
    return categoryPrompts.filter((p) => {
      if (typeFilter !== 'all' && typeFilter !== 'category') return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.slug.toLowerCase().includes(q) ||
        p.content.toLowerCase().includes(q)
      );
    });
  }, [categoryPrompts, search, typeFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = (await apiClient.admin.listThumbnailPrompts()) as ThumbnailPromptRecord[];
      setPrompts(data);

      const global = data.find((p) => p.type === 'global');
      if (global) {
        setGlobalDraft({ name: global.name, content: global.content, status: global.status });
      }

      const adjust = data.find((p) => p.type === 'adjust');
      if (adjust) {
        setAdjustDraft({ name: adjust.name, content: adjust.content, status: adjust.status });
      }

      const drafts: Record<string, PromptDraft> = {};
      for (const item of data.filter((p) => p.type === 'category')) {
        drafts[item.id] = { name: item.name, content: item.content, status: item.status };
      }
      setCategoryDrafts(drafts);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to load prompts');
    } finally {
      setLoading(false);
    }
  }, [toastError]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePrompt = async (id: string, draft: PromptDraft) => {
    setSavingId(id);
    try {
      await apiClient.admin.updateThumbnailPrompt(id, {
        name: draft.name.trim(),
        content: draft.content,
        status: draft.status,
      });
      success('Prompt saved');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to save prompt');
    } finally {
      setSavingId(null);
    }
  };

  const createCategory = async () => {
    if (!newCategory.name.trim() || !newCategory.content.trim()) {
      toastError('Category name and prompt content are required');
      return;
    }
    setCreatingCategory(true);
    try {
      await apiClient.admin.createThumbnailPrompt({
        name: newCategory.name.trim(),
        type: 'category',
        content: newCategory.content,
        status: newCategory.status,
      });
      success('Category prompt created');
      setNewCategory(emptyDraft);
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to create category');
    } finally {
      setCreatingCategory(false);
    }
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category prompt?')) return;
    setDeletingId(id);
    try {
      await apiClient.admin.deleteThumbnailPrompt(id);
      success('Category deleted');
      await load();
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to delete category');
    } finally {
      setDeletingId(null);
    }
  };

  const runPreview = async () => {
    setPreviewLoading(true);
    try {
      const result = (await apiClient.admin.previewThumbnailPrompt({
        mode: previewMode,
        categorySlug: previewCategorySlug,
        strategyPrompt: previewStrategy.trim() || undefined,
        userInstructions: previewInstructions.trim() || undefined,
      })) as ThumbnailPromptPreviewResult;
      setPreviewResult(result);
    } catch (e) {
      toastError(e instanceof Error ? e.message : 'Failed to build preview');
    } finally {
      setPreviewLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin" />
        Loading thumbnail prompts…
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <ToastStack toasts={toasts} onDismiss={dismiss} />
      <AdminPageHeader
        title="Thumbnail Prompts"
        description="Manage global, category, and AI adjust prompts used by thumbnail AI — no code changes required."
      />

      <Card>
        <CardHeader>
          <CardTitle>1. Global Thumbnail Prompt</CardTitle>
          <CardDescription>
            Automatically prepended to all thumbnail strategy and generation requests when enabled.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {globalPrompt ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="global-name">Prompt Name</Label>
                  <Input
                    id="global-name"
                    value={globalDraft.name}
                    onChange={(e) => setGlobalDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <PromptStatusToggle
                    status={globalDraft.status}
                    onChange={(status) => setGlobalDraft((d) => ({ ...d, status }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="global-content">Prompt Content</Label>
                <Textarea
                  id="global-content"
                  value={globalDraft.content}
                  onChange={(e) => setGlobalDraft((d) => ({ ...d, content: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                <StatusBadge status={globalPrompt.status === 'enabled' ? 'COMPLETED' : 'FAILED'} />
                <span>Last updated {formatDate(globalPrompt.updatedAt)}</span>
              </div>
              <Button
                onClick={() => void savePrompt(globalPrompt.id, globalDraft)}
                disabled={savingId === globalPrompt.id}
                className="gap-2"
              >
                {savingId === globalPrompt.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Global Prompt
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Global prompt not seeded yet. Restart the API.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2. Category Prompts</CardTitle>
          <CardDescription>
            Category-specific instructions merged with the global prompt during CTR strategy and generation.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search categories…"
                className="pl-9"
              />
            </div>
            <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as typeof typeFilter)}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Filter type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {THUMBNAIL_PROMPT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredCategories.map((item) => {
              const draft = categoryDrafts[item.id] ?? {
                name: item.name,
                content: item.content,
                status: item.status,
              };
              const expanded = editingCategoryId === item.id;
              return (
                <div
                  key={item.id}
                  className="rounded-lg border border-border bg-background/50 p-4 space-y-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">
                        slug: {item.slug} · updated {formatDate(item.updatedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={item.status === 'enabled' ? 'COMPLETED' : 'FAILED'} />
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingCategoryId(expanded ? null : item.id)}
                      >
                        {expanded ? 'Collapse' : 'Edit'}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-destructive"
                        onClick={() => void deleteCategory(item.id)}
                        disabled={deletingId === item.id}
                      >
                        {deletingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                  {expanded && (
                    <div className="space-y-3 pt-2 border-t border-border">
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>Category Name</Label>
                          <Input
                            value={draft.name}
                            onChange={(e) =>
                              setCategoryDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, name: e.target.value },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Status</Label>
                          <PromptStatusToggle
                            status={draft.status}
                            onChange={(status) =>
                              setCategoryDrafts((prev) => ({
                                ...prev,
                                [item.id]: { ...draft, status },
                              }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>Prompt Content</Label>
                        <Textarea
                          value={draft.content}
                          onChange={(e) =>
                            setCategoryDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...draft, content: e.target.value },
                            }))
                          }
                          rows={5}
                          className="font-mono text-sm"
                        />
                      </div>
                      <Button
                        size="sm"
                        className="gap-2"
                        onClick={() => void savePrompt(item.id, draft)}
                        disabled={savingId === item.id}
                      >
                        {savingId === item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="h-4 w-4" />
                        )}
                        Save Category
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-sm font-medium flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Add Category
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Category Name</Label>
                <Input
                  value={newCategory.name}
                  onChange={(e) => setNewCategory((d) => ({ ...d, name: e.target.value }))}
                  placeholder="e.g. Sports"
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <PromptStatusToggle
                  status={newCategory.status}
                  onChange={(status) => setNewCategory((d) => ({ ...d, status }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Prompt Content</Label>
              <Textarea
                value={newCategory.content}
                onChange={(e) => setNewCategory((d) => ({ ...d, content: e.target.value }))}
                rows={4}
                className="font-mono text-sm"
                placeholder="Category-specific thumbnail instructions…"
              />
            </div>
            <Button
              onClick={() => void createCategory()}
              disabled={creatingCategory}
              className="gap-2"
            >
              {creatingCategory ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Add Category
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3. AI Adjust Thumbnail Prompt</CardTitle>
          <CardDescription>
            Used only for AI Adjust (OCR, layout rebuild, face preservation, ratio conversion). Separate from category prompts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {adjustPrompt ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="adjust-name">Prompt Name</Label>
                  <Input
                    id="adjust-name"
                    value={adjustDraft.name}
                    onChange={(e) => setAdjustDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <PromptStatusToggle
                    status={adjustDraft.status}
                    onChange={(status) => setAdjustDraft((d) => ({ ...d, status }))}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="adjust-content">Prompt Content</Label>
                <Textarea
                  id="adjust-content"
                  value={adjustDraft.content}
                  onChange={(e) => setAdjustDraft((d) => ({ ...d, content: e.target.value }))}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
              <div className="text-xs text-muted-foreground">
                Last updated {formatDate(adjustPrompt.updatedAt)}
              </div>
              <Button
                onClick={() => void savePrompt(adjustPrompt.id, adjustDraft)}
                disabled={savingId === adjustPrompt.id}
                className="gap-2"
              >
                {savingId === adjustPrompt.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Save Adjust Prompt
              </Button>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Adjust prompt not seeded yet. Restart the API.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4. Prompt Preview</CardTitle>
          <CardDescription>
            Preview the combined prompt: Global + Category + Adjust (when applicable).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Mode</Label>
              <Select value={previewMode} onValueChange={(v) => setPreviewMode(v as 'generate' | 'adjust')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="generate">Generate (Global + Category + Strategy)</SelectItem>
                  <SelectItem value="adjust">Adjust (Global + Category + Adjust)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={previewCategorySlug} onValueChange={setPreviewCategorySlug}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {THUMBNAIL_CATEGORY_OPTIONS.filter((o) => o.value !== 'auto').map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {previewMode === 'generate' && (
            <>
              <div className="space-y-2">
                <Label>Sample strategy prompt (optional)</Label>
                <Textarea
                  value={previewStrategy}
                  onChange={(e) => setPreviewStrategy(e.target.value)}
                  rows={3}
                  className="font-mono text-sm"
                  placeholder="Strategy / image generation prompt snippet…"
                />
              </div>
              <div className="space-y-2">
                <Label>Additional instructions (optional)</Label>
                <Textarea
                  value={previewInstructions}
                  onChange={(e) => setPreviewInstructions(e.target.value)}
                  rows={2}
                />
              </div>
            </>
          )}
          <Button onClick={() => void runPreview()} disabled={previewLoading} className="gap-2">
            {previewLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Eye className="h-4 w-4" />
            )}
            Preview Combined Prompt
          </Button>
          {previewResult && (
            <pre className="text-xs bg-muted/50 p-4 rounded-lg overflow-auto border border-border max-h-[420px] whitespace-pre-wrap">
              {previewResult.preview || '(No enabled prompts matched this preview)'}
            </pre>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
