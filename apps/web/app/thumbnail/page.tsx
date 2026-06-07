'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { UrlInput } from '@/components/downloader/UrlInput';
import { AnalyzingPanel } from '@/components/downloader/AnalyzingPanel';
import { AdditionalInstructionsField } from '@/components/thumbnail/AdditionalInstructionsField';
import { CategorySelect, THUMBNAIL_CATEGORY_AUTO } from '@/components/thumbnail/CategorySelect';
import { HeadlinePreviewCard } from '@/components/thumbnail/HeadlinePreviewCard';
import { TextStyleSelect, THUMBNAIL_TEXT_STYLE_AUTO } from '@/components/thumbnail/TextStyleSelect';
import { ThumbnailInfoCard } from '@/components/thumbnail/ThumbnailInfoCard';
import { ThumbnailJobResultCard } from '@/components/thumbnail/ThumbnailJobResultCard';
import { ThumbnailTitleField } from '@/components/thumbnail/ThumbnailTitleField';
import {
  ToolPageAdsBottom,
  ToolPageAdsTop,
  ToolPageWithSidebar,
} from '@/components/ads/ToolPageAds';
import { ToastStack, useToast } from '@/components/ui/toast';
import { apiClient } from '@/lib/api';
import { getThumbnailDownloadSrc, getThumbnailSrc } from '@/lib/thumbnail';
import { useUserStore } from '@/store/userStore';
import { usePageContent } from '@/hooks/usePageContent';
import { useAffiliateOnSave } from '@/hooks/useAffiliateOnSave';
import {
  buildThumbnailGeneratePrompt,
  DEFAULT_AI_API_SETTINGS,
  DEFAULT_TOOLS_CONTENT,
  formatStrategyCopyText,
  formatThumbnailResolution,
  hasProAccess,
  resolveThumbnailCategoryLabel,
  resolveThumbnailUiFeatures,
  type AiApiFeatureToggles,
  type ThumbnailCategoryValue,
  type ThumbnailRecord,
  type ThumbnailPreview,
  type ThumbnailStrategyResult,
  type ThumbnailTextStyleValue,
} from '@hellodownloader/shared-types';

const proRatios = [
  { value: 'YOUTUBE_16_9', label: 'YouTube 16:9' },
  { value: 'SHORTS_9_16', label: 'Shorts 9:16' },
  { value: 'INSTAGRAM_4_5', label: 'Instagram 4:5' },
  { value: 'FACEBOOK_1_1', label: 'Facebook 1:1' },
];

type LoadingState = {
  thumbnail: boolean;
  headline: boolean;
  adjust: boolean;
  generate: boolean;
  download: boolean;
};

const idleLoading: LoadingState = {
  thumbnail: false,
  headline: false,
  adjust: false,
  generate: false,
  download: false,
};

export default function ThumbnailPage() {
  const user = useUserStore((s) => s.user);
  const content = usePageContent('tools', DEFAULT_TOOLS_CONTENT);
  const isPro = hasProAccess(user?.plan, user?.role);
  const isAdmin = user?.role === 'ADMIN';
  const { toasts, dismiss, success, error: toastError } = useToast();
  const openAffiliate = useAffiliateOnSave('thumbnail');

  const [aiFeatures, setAiFeatures] = useState<AiApiFeatureToggles>(
    DEFAULT_AI_API_SETTINGS.features,
  );
  const uiFeatures = resolveThumbnailUiFeatures(aiFeatures);

  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<ThumbnailPreview | null>(null);
  const [detectedResolution, setDetectedResolution] = useState<string | undefined>();
  const [thumbnailTitle, setThumbnailTitle] = useState('');
  const [category, setCategory] = useState<ThumbnailCategoryValue>(THUMBNAIL_CATEGORY_AUTO);
  const [textStyle, setTextStyle] = useState<ThumbnailTextStyleValue>(THUMBNAIL_TEXT_STYLE_AUTO);
  const [headline, setHeadline] = useState<ThumbnailStrategyResult | null>(null);
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [ratio, setRatio] = useState('YOUTUBE_16_9');
  const [loading, setLoading] = useState<LoadingState>(idleLoading);
  const [error, setError] = useState('');
  const [titleError, setTitleError] = useState('');
  const [result, setResult] = useState<ThumbnailRecord | null>(null);

  const loadAbortRef = useRef<AbortController | null>(null);
  const opAbortRef = useRef<AbortController | null>(null);

  const isBusy = Object.values(loading).some(Boolean);
  const thumbnailLoaded = Boolean(preview);
  const aiToolsEnabled = uiFeatures.showAdjust || uiFeatures.showGenerate;

  useEffect(() => {
    void apiClient.thumbnails
      .features()
      .then((data) => setAiFeatures(data as AiApiFeatureToggles))
      .catch(() => setAiFeatures(DEFAULT_AI_API_SETTINGS.features));
  }, []);

  const cancelLoad = useCallback(() => {
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    setLoading((s) => ({ ...s, thumbnail: false }));
    setError('');
  }, []);

  const cancelOperation = useCallback(() => {
    opAbortRef.current?.abort();
    opAbortRef.current = null;
    setLoading(idleLoading);
    setError('');
  }, []);

  const cancelAiJob = useCallback(() => {
    setResult(null);
  }, []);

  const loadOriginal = async () => {
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;

    setLoading((s) => ({ ...s, thumbnail: true }));
    setError('');
    setTitleError('');
    setPreview(null);
    setDetectedResolution(undefined);
    setHeadline(null);
    setResult(null);
    try {
      const data = (await apiClient.thumbnails.original(url, controller.signal)) as ThumbnailPreview;
      if (controller.signal.aborted) return;
      setPreview(data);
      setThumbnailTitle(data.title ?? '');
      setDetectedResolution(data.resolution ?? (data.width && data.height ? `${data.width}×${data.height}` : undefined));
    } catch (e) {
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : 'Failed to load thumbnail');
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setLoading((s) => ({ ...s, thumbnail: false }));
      }
    }
  };

  const saveOriginal = async () => {
    if (!preview?.thumbnail || !url) return;
    openAffiliate();
    setLoading((s) => ({ ...s, download: true }));
    try {
      await apiClient.thumbnails.saveOriginal(url);
    } catch {
      // still allow save even if history logging fails
    }
    const src = getThumbnailDownloadSrc(preview.thumbnail);
    const res = await fetch(src);
    if (!res.ok) {
      throw new Error('Could not download thumbnail');
    }
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${preview.title?.slice(0, 40) || 'thumbnail'}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
    success('Original thumbnail downloaded');
    setLoading((s) => ({ ...s, download: false }));
  };

  const validateTitle = () => {
    if (!thumbnailTitle.trim()) {
      setTitleError('Thumbnail title is required');
      return false;
    }
    setTitleError('');
    return true;
  };

  const generateHeadline = async () => {
    if (!isPro || !thumbnailLoaded || !uiFeatures.showHeadlineStrategy) return;
    if (!validateTitle()) return;

    opAbortRef.current?.abort();
    const controller = new AbortController();
    opAbortRef.current = controller;

    setLoading((s) => ({ ...s, headline: true }));
    setError('');
    try {
      const categoryLabel = resolveThumbnailCategoryLabel(category);
      const categorySlug = category === THUMBNAIL_CATEGORY_AUTO ? undefined : category;
      const data = await apiClient.thumbnails.generateHeadline({
        title: thumbnailTitle.trim(),
        category: categoryLabel,
        categorySlug,
        textStyle: textStyle === THUMBNAIL_TEXT_STYLE_AUTO ? undefined : textStyle,
        ratio,
        instructions: additionalInstructions.trim() || undefined,
        thumbnailUrl: preview?.thumbnail,
      }, controller.signal);
      if (controller.signal.aborted) return;
      setHeadline(data as ThumbnailStrategyResult);
      success('Thumbnail strategy generated');
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Failed to generate headline';
      setError(message);
      toastError(message);
    } finally {
      if (opAbortRef.current === controller) {
        opAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setLoading((s) => ({ ...s, headline: false }));
      }
    }
  };

  const copyHeadline = useCallback(async () => {
    if (!headline) return;
    const text = formatStrategyCopyText(headline);
    try {
      await navigator.clipboard.writeText(text);
      success('Headline copied to clipboard');
    } catch {
      toastError('Could not copy to clipboard');
    }
  }, [headline, success, toastError]);

  const runAi = async (mode: 'adjust' | 'generate') => {
    if (!isPro || !thumbnailLoaded) return;
    if (mode === 'adjust' && !uiFeatures.showAdjust) return;
    if (mode === 'generate' && !uiFeatures.showGenerate) return;
    if (mode === 'generate' && !headline) {
      setError('Generate a CTR strategy before creating a new thumbnail');
      return;
    }

    const key = mode === 'adjust' ? 'adjust' : 'generate';
    opAbortRef.current?.abort();
    const controller = new AbortController();
    opAbortRef.current = controller;

    setLoading((s) => ({ ...s, [key]: true }));
    setError('');
    try {
      const prompt =
        mode === 'generate'
          ? buildThumbnailGeneratePrompt(headline, additionalInstructions)
          : undefined;
      const categorySlug = category === THUMBNAIL_CATEGORY_AUTO ? undefined : category;

      const data = (await apiClient.thumbnails.createAi({
        videoUrl: url,
        ratio,
        mode,
        prompt,
        categorySlug,
        additionalInstructions: additionalInstructions.trim() || undefined,
      }, controller.signal)) as ThumbnailRecord;
      if (controller.signal.aborted) return;
      setResult(data);
      success(mode === 'adjust' ? 'AI adjust started' : 'AI generation started');
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Failed to start AI job';
      setError(message);
      toastError(message);
    } finally {
      if (opAbortRef.current === controller) {
        opAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setLoading((s) => ({ ...s, [key]: false }));
      }
    }
  };

  const handleResolutionDetected = (width: number, height: number) => {
    setDetectedResolution(formatThumbnailResolution(width, height));
  };

  return (
    <>
      <ToolPageAdsTop page="thumbnail" />
      <ToolPageWithSidebar page="thumbnail" className="container mx-auto max-w-5xl px-4 py-8 sm:py-12">
      <ToastStack toasts={toasts} onDismiss={dismiss} />

      <div className="mb-2">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">{content.title}</h1>
        <p className="text-muted-foreground text-sm sm:text-base">{content.subtitle}</p>
      </div>

      <div className="space-y-6 sm:space-y-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg sm:text-xl">{content.videoUrlCardTitle}</CardTitle>
          <CardDescription>Paste a video URL to load the original thumbnail.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <UrlInput value={url} onChange={setUrl} placeholder="YouTube or social video URL" />
          <Button
            onClick={() => void loadOriginal()}
            disabled={!url.trim() || (isBusy && !loading.thumbnail)}
            className="w-full gap-2"
          >
            {loading.thumbnail ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading thumbnail…
              </>
            ) : (
              content.loadButton
            )}
          </Button>

          {loading.thumbnail && (
            <AnalyzingPanel
              title="Loading thumbnail…"
              subtitle="Fetching the highest-quality thumbnail from the video."
              onCancel={cancelLoad}
            />
          )}

          {error && !thumbnailLoaded && !loading.thumbnail && (
            <p className="text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
              {error}
            </p>
          )}
          {preview && (
            <ThumbnailInfoCard
              preview={preview}
              resolution={detectedResolution}
              onResolutionDetected={handleResolutionDetected}
              onDownload={() => void saveOriginal()}
              downloading={loading.download}
            />
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Sparkles className="h-5 w-5 text-primary shrink-0" />
            {content.proCardTitle}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? 'Admin accounts have full Pro access. AI tools follow Admin → API Settings toggles.'
              : 'Load a thumbnail first, then use enabled AI tools below.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isPro ? (
            <div className="space-y-4">
              <GenerateComingSoonCard
                title="AI Thumbnail Adjust"
                description="Redesign thumbnail text and layout for YouTube, Shorts, Instagram, and more — coming soon."
              />
              <GenerateComingSoonCard
                title={content.generateComingSoonTitle}
                description={content.generateComingSoonText}
              />
            </div>
          ) : !aiToolsEnabled ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-950 dark:text-amber-100/90">
              <p className="font-medium mb-1">AI thumbnail tools are disabled</p>
              <p className="text-amber-900/80 dark:text-amber-100/70">
                An admin can enable AI Adjust or AI Generate in{' '}
                <Link href="/admin/api-settings" className="underline text-amber-200">
                  Admin → API Settings → Feature Toggles
                </Link>
                .
              </p>
            </div>
          ) : (
            <>
              {!thumbnailLoaded && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-sm text-amber-950 dark:text-amber-100/90">
                  <p className="font-medium mb-1">Step 1: Load a thumbnail</p>
                  <p className="text-amber-900/80 dark:text-amber-100/70">
                    Paste a video URL above and click Load thumbnail. AI tools unlock after the
                    preview loads.
                  </p>
                </div>
              )}

              <div className="space-y-6">
                {uiFeatures.showGenerate && (
                  <ThumbnailTitleField
                    value={thumbnailTitle}
                    onChange={(v) => {
                      setThumbnailTitle(v);
                      if (titleError && v.trim()) setTitleError('');
                    }}
                    disabled={!thumbnailLoaded}
                    error={titleError}
                  />
                )}

                <CategorySelect
                  value={category}
                  onChange={setCategory}
                  disabled={!thumbnailLoaded}
                />

                {uiFeatures.showGenerate && (
                  <TextStyleSelect
                    value={textStyle}
                    onChange={setTextStyle}
                    disabled={!thumbnailLoaded}
                  />
                )}

                <div className="border-t border-border pt-6 space-y-3">
                  <p className="text-sm font-medium">Aspect ratio</p>
                  <div className="flex flex-wrap gap-2">
                    {proRatios.map((r) => (
                      <Button
                        key={r.value}
                        type="button"
                        variant={ratio === r.value ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setRatio(r.value)}
                        disabled={!thumbnailLoaded}
                      >
                        {r.label}
                      </Button>
                    ))}
                  </div>
                </div>

                <AdditionalInstructionsField
                  value={additionalInstructions}
                  onChange={setAdditionalInstructions}
                  disabled={!thumbnailLoaded}
                />

                {uiFeatures.showHeadlineStrategy && uiFeatures.showGenerate && (
                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={() => void generateHeadline()}
                      disabled={!thumbnailLoaded || loading.headline || (isBusy && !loading.headline)}
                      variant="outline"
                      className="w-full sm:w-auto gap-2"
                    >
                      {loading.headline ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Analyzing thumbnail…
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-4 w-4" />
                          Generate CTR Strategy
                        </>
                      )}
                    </Button>
                    {loading.headline && (
                      <Button type="button" variant="ghost" size="sm" onClick={cancelOperation}>
                        Cancel
                      </Button>
                    )}
                  </div>
                )}

                {headline && uiFeatures.showGenerate && (
                  <HeadlinePreviewCard
                    headline={headline}
                    onRegenerate={() => void generateHeadline()}
                    onCopy={() => void copyHeadline()}
                    regenerating={loading.headline}
                  />
                )}

                <div className="border-t border-border pt-6 space-y-4">
                  {uiFeatures.showAdjust && (
                    <div className="rounded-lg border border-border bg-background/50 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">AI Adjust — text &amp; image</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Redesign your thumbnail for the selected ratio — same content, new layout.
                        </p>
                      </div>
                      {!uiFeatures.adjustReady && (
                        <p className="text-xs text-amber-700 dark:text-amber-400/90">
                          Enable AI Analysis in Admin → API Settings to use Adjust.
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={() => void runAi('adjust')}
                        disabled={
                          !thumbnailLoaded ||
                          !uiFeatures.adjustReady ||
                          loading.adjust ||
                          (isBusy && !loading.adjust)
                        }
                        className="w-full sm:w-auto gap-2"
                      >
                        {loading.adjust ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting adjust…
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4" />
                            AI Adjust Thumbnail
                          </>
                        )}
                      </Button>
                      {loading.adjust && (
                        <Button type="button" variant="ghost" size="sm" onClick={cancelOperation}>
                          Cancel
                        </Button>
                      )}
                    </div>
                  )}

                  {uiFeatures.showGenerate ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
                      <div>
                        <p className="text-sm font-medium">AI Generate — new thumbnail</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Creates a new thumbnail from your CTR strategy and instructions.
                        </p>
                      </div>
                      {!uiFeatures.generateReady && (
                        <p className="text-xs text-amber-700 dark:text-amber-400/90">
                          Enable AI Analysis in Admin → API Settings to use Generate.
                        </p>
                      )}
                      <Button
                        type="button"
                        onClick={() => void runAi('generate')}
                        disabled={
                          !thumbnailLoaded ||
                          !uiFeatures.generateReady ||
                          !headline ||
                          loading.generate ||
                          (isBusy && !loading.generate)
                        }
                        className="w-full sm:w-auto gap-2"
                      >
                        {loading.generate ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Starting generation…
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-4 w-4" />
                            Generate New Thumbnail
                          </>
                        )}
                      </Button>
                      {loading.generate && (
                        <Button type="button" variant="ghost" size="sm" onClick={cancelOperation}>
                          Cancel
                        </Button>
                      )}
                      {!headline && thumbnailLoaded && uiFeatures.generateReady && (
                        <p className="text-xs text-amber-700 dark:text-amber-400/90">
                          Generate a CTR strategy first to unlock AI generation.
                        </p>
                      )}
                    </div>
                  ) : (
                    <GenerateComingSoonCard
                      title={content.generateComingSoonTitle}
                      description={content.generateComingSoonText}
                    />
                  )}
                </div>
              </div>

              {error && thumbnailLoaded && (
                <p className="text-destructive text-sm rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2">
                  {error}
                </p>
              )}

              {result && (
                <ThumbnailJobResultCard
                  job={result}
                  onComplete={() => success('Thumbnail ready — preview and download below')}
                  onCancel={cancelAiJob}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>
      </div>
      </ToolPageWithSidebar>
      <ToolPageAdsBottom page="thumbnail" />
    </>
  );
}

function GenerateComingSoonCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-lg border border-border bg-accent/50 px-4 py-6 text-center">
      <Sparkles className="h-8 w-8 text-primary/70 mx-auto mb-3" />
      <div className="flex flex-wrap items-center justify-center gap-2 mb-2">
        <p className="font-medium">{title}</p>
        <span className="inline-flex rounded-full bg-primary/15 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-primary">
          Coming Soon
        </span>
      </div>
      <p className="text-sm text-muted-foreground">{description}</p>
    </div>
  );
}
