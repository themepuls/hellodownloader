'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { DownloadWorkspace } from '@/components/downloader/DownloadWorkspace';

function DownloadPageContent() {
  const searchParams = useSearchParams();
  const urlParam = searchParams.get('url') ?? '';

  return (
    <DownloadWorkspace
      initialUrl={urlParam}
      autoAnalyze={Boolean(urlParam)}
    />
  );
}

export default function DownloadPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[60vh] items-center justify-center bg-[#0b0e14]">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      }
    >
      <DownloadPageContent />
    </Suspense>
  );
}
