'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DownloadWorkspace } from '@/components/downloader/DownloadWorkspace';
import { usePageContent } from '@/hooks/usePageContent';
import { DEFAULT_DOWNLOAD_CONTENT } from '@hellodownloader/shared-types';

function DownloadPageContent() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get('url') ?? '';
  const content = usePageContent('download', DEFAULT_DOWNLOAD_CONTENT);

  return (
    <DownloadWorkspace
      initialUrl={urlParam}
      autoAnalyze={Boolean(urlParam)}
      content={content}
    />
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-background">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <DownloadPageContent />
    </Suspense>
  );
}
