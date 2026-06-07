'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { extensionForDownloadType, releaseDownloadOnServer, saveCompletedFile } from '@/lib/save-file';
import { openAffiliateForPage } from '@/lib/affiliate-link';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useUserStore } from '@/store/userStore';
import { affiliatePageForDownloadType } from '@hellodownloader/shared-types';
import { getOptimisticYouTubePreview } from '@/lib/youtube-preview';

export interface DownloadRecord {
  id: string;
  status: string;
  type?: string;
  quality?: number | null;
  actualHeight?: number | null;
  progress: number;
  title?: string | null;
  error?: string | null;
  warning?: string | null;
  downloadUrl?: string | null;
  fileSize?: string | null;
  message?: string;
  accessToken?: string;
}

const ACTIVE_DOWNLOAD_KEY = 'hellodownloader-active-download-id';
const ACTIVE_DOWNLOAD_URL_KEY = 'hellodownloader-active-download-url';
const ACTIVE_DOWNLOAD_TOKEN_KEY = 'hellodownloader-active-download-token';

function readStoredDownloadToken(): string | null {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
}

export function useDownloader(initialUrl = '') {
  const [url, setUrl] = useState(initialUrl);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadRecord | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveStarted, setSaveStarted] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);
  const metadataAbortRef = useRef<AbortController | null>(null);
  const { config: adsConfig, loaded: adsLoaded } = useAdsConfig();
  const user = useUserStore((s) => s.user);

  const openAffiliateForType = useCallback(
    (type?: string | null) => {
      if (!adsLoaded) return;
      openAffiliateForPage(
        adsConfig,
        affiliatePageForDownloadType(type),
        user?.plan,
        user?.role,
      );
    },
    [adsConfig, adsLoaded, user?.plan, user?.role],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    failCountRef.current = 0;
  }, []);

  const clearActiveDownload = useCallback(
    (releaseFile = false) => {
      const id = sessionStorage.getItem(ACTIVE_DOWNLOAD_KEY);
      const token = readStoredDownloadToken();
      if (releaseFile && id) {
        releaseDownloadOnServer(id, token);
      }
      stopPolling();
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
      setDownload(null);
    },
    [stopPolling],
  );

  const cancelAnalysis = useCallback(() => {
    metadataAbortRef.current?.abort();
    metadataAbortRef.current = null;
    setAnalyzing(false);
    setError(null);
  }, []);

  const cancelDownload = useCallback(() => {
    clearActiveDownload(true);
    setLoading(false);
    setError(null);
  }, [clearActiveDownload]);

  const cancelAll = useCallback(() => {
    cancelAnalysis();
    cancelDownload();
    setMetadata(null);
  }, [cancelAnalysis, cancelDownload]);

  const fetchStatus = useCallback(async (id: string): Promise<DownloadRecord | null> => {
    try {
      const token = readStoredDownloadToken();
      const status = (await apiClient.downloads.status(id, token ?? undefined)) as DownloadRecord;
      failCountRef.current = 0;
      const normalized = {
        ...status,
        progress: status.status === 'COMPLETED' ? 100 : status.progress,
      };
      setDownload(normalized);
      if (status.status === 'COMPLETED' || status.status === 'FAILED') {
        stopPolling();
        setLoading(false);
        if (status.status === 'FAILED') {
          sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
          sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
          if (status.error) {
            setError(status.error);
          }
        }
      }
      return status;
    } catch (e) {
      failCountRef.current += 1;
      const message = e instanceof Error ? e.message : '';
      if (message.includes('Access denied') || message.includes('403')) {
        stopPolling();
        setLoading(false);
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
        setError('Session expired. Paste the URL again and start a new download.');
        return null;
      }
      if (failCountRef.current >= 5) {
        stopPolling();
        setLoading(false);
        setError(
          e instanceof Error
            ? e.message
            : 'Lost connection while checking status. Click Refresh status.',
        );
      }
      return null;
    }
  }, [stopPolling]);

  const pollStatus = useCallback(
    (id: string, downloadUrl?: string, accessToken?: string) => {
      stopPolling();
      sessionStorage.setItem(ACTIVE_DOWNLOAD_KEY, id);
      if (downloadUrl) {
        sessionStorage.setItem(ACTIVE_DOWNLOAD_URL_KEY, downloadUrl.trim());
      }
      if (accessToken) {
        sessionStorage.setItem(ACTIVE_DOWNLOAD_TOKEN_KEY, accessToken);
      }
      void fetchStatus(id);
      pollRef.current = setInterval(() => {
        void fetchStatus(id);
      }, 1000);
    },
    [stopPolling, fetchStatus],
  );

  const refreshStatus = useCallback(async () => {
    const id = download?.id ?? sessionStorage.getItem(ACTIVE_DOWNLOAD_KEY);
    if (!id) return;
    setError(null);
    setLoading(true);
    const status = await fetchStatus(id);
    if (status && status.status !== 'COMPLETED' && status.status !== 'FAILED') {
      pollStatus(id);
    } else {
      setLoading(false);
    }
  }, [download?.id, fetchStatus, pollStatus]);

  useEffect(() => {
    const savedId = sessionStorage.getItem(ACTIVE_DOWNLOAD_KEY);
    const savedUrl = sessionStorage.getItem(ACTIVE_DOWNLOAD_URL_KEY);

    if (!savedId) {
      return () => stopPolling();
    }

    void (async () => {
      try {
        const token = readStoredDownloadToken();
        const status = (await apiClient.downloads.status(savedId, token ?? undefined)) as DownloadRecord;

        if (status.status === 'COMPLETED') {
          if (initialUrl.trim() && savedUrl?.trim() !== initialUrl.trim()) {
            releaseDownloadOnServer(savedId, token);
            sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
            sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
            sessionStorage.removeItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
            return;
          }
          if (savedUrl) setUrl(savedUrl);
          setDownload({ ...status, progress: 100 });
          setLoading(false);
          return;
        }

        if (initialUrl.trim() && savedUrl?.trim() !== initialUrl.trim()) {
          releaseDownloadOnServer(savedId, token);
          sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
          sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
          sessionStorage.removeItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
          return;
        }

        if (savedUrl) setUrl(savedUrl);
        pollStatus(savedId, savedUrl ?? undefined, token ?? undefined);
      } catch {
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
        sessionStorage.removeItem(ACTIVE_DOWNLOAD_TOKEN_KEY);
      }
    })();

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUrlSafe = useCallback(
    (newUrl: string) => {
      if (url.trim() !== newUrl.trim()) {
        cancelDownload();
        cancelAnalysis();
      }
      setUrl(newUrl);
    },
    [url, cancelDownload, cancelAnalysis],
  );

  const fetchMetadata = async () => {
    if (!url) return;
    metadataAbortRef.current?.abort();
    const controller = new AbortController();
    metadataAbortRef.current = controller;

    clearActiveDownload(true);
    setError(null);

    const preview = getOptimisticYouTubePreview(url);
    setMetadata(preview);
    setAnalyzing(true);

    try {
      const data = await apiClient.downloads.metadata(url, controller.signal);
      if (controller.signal.aborted) return;
      setMetadata(data as Record<string, unknown>);
    } catch (e) {
      if (controller.signal.aborted) return;
      const message = e instanceof Error ? e.message : 'Failed to fetch metadata';
      if (message !== 'Cancelled') {
        setError(message);
      }
    } finally {
      if (metadataAbortRef.current === controller) {
        metadataAbortRef.current = null;
      }
      if (!controller.signal.aborted) {
        setAnalyzing(false);
      }
    }
  };

  const startDownload = async (type: string, quality?: number, format?: string) => {
    clearActiveDownload(true);
    setLoading(true);
    setError(null);
    try {
      const cachedMeta =
        metadata && metadata.title && metadata.thumbnail
          ? {
              id: metadata.id as string | undefined,
              title: metadata.title as string,
              thumbnail: metadata.thumbnail as string,
              uploader: metadata.uploader as string | undefined,
              duration: metadata.duration as number | undefined,
              formats: metadata.formats as unknown[] | undefined,
            }
          : undefined;

      const data = (await apiClient.downloads.create({
        url,
        type,
        quality,
        format,
        metadata: cachedMeta,
      })) as DownloadRecord;
      if (data.accessToken) {
        sessionStorage.setItem(ACTIVE_DOWNLOAD_TOKEN_KEY, data.accessToken);
      }
      setDownload(data);
      pollStatus(data.id, url, data.accessToken);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      setError(msg);
      setLoading(false);
    }
  };

  const saveToPc = async () => {
    if (!download?.id) return;
    openAffiliateForType(download.type);
    setError(null);
    setSaveStarted(false);
    setSaving(true);
    try {
      let fresh = download;
      const downloadToken = readStoredDownloadToken();
      if (!download.downloadUrl || !download.fileSize) {
        fresh = (await apiClient.downloads.status(download.id, downloadToken ?? undefined)) as DownloadRecord;
        setDownload((prev) => ({ ...prev, ...fresh, progress: 100 }));
      }

      const downloadType = fresh.type ?? download.type;
      const fileExtension = extensionForDownloadType(downloadType);

      const result = await saveCompletedFile(
        `/downloads/${download.id}/file`,
        fresh.title ?? download.title ?? metadata?.title ?? `download-${download.id}`,
        {
          downloadUrl: fresh.downloadUrl ?? download.downloadUrl,
          fileSizeBytes: fresh.fileSize ?? download.fileSize,
          fileExtension,
          forceExtension: downloadType === 'MP3',
          downloadToken,
        },
      );

      if (result === 'started') {
        setSaveStarted(true);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save file');
    } finally {
      setSaving(false);
    }
  };

  return {
    url,
    setUrl: setUrlSafe,
    metadata,
    loading,
    analyzing,
    saving,
    saveStarted,
    error,
    download,
    fetchMetadata,
    startDownload,
    saveToPc,
    refreshStatus,
    cancelAnalysis,
    cancelDownload,
    cancelAll,
    setError,
  };
}
