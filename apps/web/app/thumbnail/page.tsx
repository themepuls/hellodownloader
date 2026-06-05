'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Crown, Download, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { UrlInput } from '@/components/downloader/UrlInput';
import { apiClient } from '@/lib/api';
import { getThumbnailSrc } from '@/lib/thumbnail';
import { useUserStore } from '@/store/userStore';

const proRatios = [
  { value: 'YOUTUBE_16_9', label: 'YouTube 16:9' },
  { value: 'SHORTS_9_16', label: 'Shorts 9:16' },
  { value: 'INSTAGRAM_4_5', label: 'Instagram 4:5' },
  { value: 'FACEBOOK_1_1', label: 'Facebook 1:1' },
];

export default function ThumbnailPage() {
  const user = useUserStore((s) => s.user);
  const isPro = user?.plan === 'PRO';
  const [url, setUrl] = useState('');
  const [preview, setPreview] = useState<{ thumbnail: string; title: string } | null>(null);
  const [ratio, setRatio] = useState('YOUTUBE_16_9');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<unknown>(null);

  const loadOriginal = async () => {
    setLoading(true);
    setError('');
    setPreview(null);
    try {
      const data = (await apiClient.thumbnails.original(url)) as { thumbnail: string; title: string };
      setPreview(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load thumbnail');
    } finally {
      setLoading(false);
    }
  };

  const saveOriginal = async () => {
    if (!preview?.thumbnail || !url) return;
    try {
      await apiClient.thumbnails.saveOriginal(url);
    } catch {
      // still allow save even if history logging fails
    }
    const src = getThumbnailSrc(preview.thumbnail);
    const res = await fetch(src);
    const blob = await res.blob();
    const objectUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objectUrl;
    a.download = `${preview.title?.slice(0, 40) || 'thumbnail'}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  };

  const runAi = async (mode: 'adjust' | 'generate') => {
    if (!isPro) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiClient.thumbnails.createAi({
        videoUrl: url,
        ratio,
        mode,
        prompt: mode === 'generate' ? prompt : undefined,
      });
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-12 max-w-3xl space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">Thumbnails</h1>
        <p className="text-muted-foreground">
          Free: download the original thumbnail. Pro: AI adjust text/image or generate a new thumbnail with prompts.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Video URL</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <UrlInput value={url} onChange={setUrl} placeholder="YouTube or social video URL" />
          <Button onClick={loadOriginal} disabled={!url || loading} className="w-full">
            {loading ? 'Loading…' : 'Load thumbnail'}
          </Button>
          {error && <p className="text-destructive text-sm">{error}</p>}
          {preview && (
            <div className="space-y-3 rounded-xl border border-white/10 bg-[#0b0e14] p-4">
              <p className="text-sm font-medium truncate">{preview.title}</p>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-black/40">
                <Image
                  src={getThumbnailSrc(preview.thumbnail)}
                  alt={preview.title}
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
              <Button onClick={saveOriginal} className="w-full gap-2" variant="secondary">
                <Download className="h-4 w-4" />
                Download original (free)
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-primary/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Pro — AI Thumbnail Tools
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!isPro ? (
            <div className="text-center py-6">
              <Crown className="h-8 w-8 text-amber-400 mx-auto mb-3" />
              <p className="text-muted-foreground mb-4">
                AI adjust (text + image) and full AI generation with custom prompts are Pro features.
              </p>
              <Link href="/pricing"><Button>Upgrade to Pro</Button></Link>
            </div>
          ) : (
            <>
              <div>
                <p className="text-sm font-medium mb-2">AI Adjust — text & image (1 credit)</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Resize the original thumbnail to multiple ratios while preserving text via OCR.
                </p>
                <div className="flex flex-wrap gap-2 mb-3">
                  {proRatios.map((r) => (
                    <Button
                      key={r.value}
                      variant={ratio === r.value ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setRatio(r.value)}
                    >
                      {r.label}
                    </Button>
                  ))}
                </div>
                <Button onClick={() => runAi('adjust')} disabled={!url || loading} className="gap-2">
                  <Wand2 className="h-4 w-4" />
                  AI adjust thumbnail
                </Button>
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="text-sm font-medium mb-2">AI Generate — new thumbnail (3 credits)</p>
                <p className="text-xs text-muted-foreground mb-3">
                  Creates a fully new thumbnail. Uses the global style prompt plus your custom prompt.
                </p>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Your prompt: e.g. bold yellow text, cinematic background, shocked face..."
                  className="w-full min-h-[100px] rounded-lg border border-white/10 bg-[#0b0e14] px-3 py-2 text-sm mb-3"
                />
                <Button onClick={() => runAi('generate')} disabled={!url || loading} className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate with AI
                </Button>
              </div>

              {result != null && (
                <pre className="text-xs bg-muted p-4 rounded overflow-auto">{JSON.stringify(result, null, 2)}</pre>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
