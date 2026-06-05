'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api';
import { saveCompletedFile } from '@/lib/save-file';

export interface DownloadRecord {
  id: string;
  status: string;
  progress: number;
  title?: string | null;
  error?: string | null;
  downloadUrl?: string | null;
  message?: string;
}

const ACTIVE_DOWNLOAD_KEY = 'hellodownloader-active-download-id';
const ACTIVE_DOWNLOAD_URL_KEY = 'hellodownloader-active-download-url';

export function useDownloader(initialUrl = '') {
  const [url, setUrl] = useState(initialUrl);
  const [metadata, setMetadata] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [download, setDownload] = useState<DownloadRecord | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const failCountRef = useRef(0);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    failCountRef.current = 0;
  }, []);

  const clearActiveDownload = useCallback(() => {
    stopPolling();
    sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
    sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
    setDownload(null);
  }, [stopPolling]);

  const fetchStatus = useCallback(async (id: string): Promise<DownloadRecord | null> => {
    try {
      const status = (await apiClient.downloads.status(id)) as DownloadRecord;
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
    (id: string, downloadUrl?: string) => {
      stopPolling();
      sessionStorage.setItem(ACTIVE_DOWNLOAD_KEY, id);
      if (downloadUrl) {
        sessionStorage.setItem(ACTIVE_DOWNLOAD_URL_KEY, downloadUrl.trim());
      }
      void fetchStatus(id);
      pollRef.current = setInterval(() => {
        void fetchStatus(id);
      }, 2000);
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

    if (!savedId || !savedUrl) {
      return () => stopPolling();
    }

    if (initialUrl.trim() && savedUrl.trim() !== initialUrl.trim()) {
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
      return () => stopPolling();
    }

    setUrl(savedUrl);
    setLoading(true);
    void fetchStatus(savedId).finally(() => setLoading(false));
    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setUrlSafe = useCallback(
    (newUrl: string) => {
      if (url.trim() !== newUrl.trim()) {
        clearActiveDownload();
      }
      setUrl(newUrl);
    },
    [url, clearActiveDownload],
  );

  const fetchMetadata = async () => {
    if (!url) return;
    clearActiveDownload();
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.downloads.metadata(url);
      setMetadata(data as Record<string, unknown>);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch metadata');
    } finally {
      setLoading(false);
    }
  };

  const startDownload = async (type: string, quality?: number, format?: string) => {
    clearActiveDownload();
    setLoading(true);
    setError(null);
    try {
      const data = (await apiClient.downloads.create({ url, type, quality, format })) as DownloadRecord;
      setDownload(data);
      pollStatus(data.id, url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      setError(msg);
      setLoading(false);
    }
  };

  const saveToPc = async () => {
    if (!download?.id) return;
    setError(null);
    setLoading(true);
    try {
      await saveCompletedFile(
        `/downloads/${download.id}/file`,
        download.title ? `${download.title}` : `download-${download.id}`,
      );
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_KEY);
      sessionStorage.removeItem(ACTIVE_DOWNLOAD_URL_KEY);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save file');
    } finally {
      setLoading(false);
    }
  };

  return {
    url,
    setUrl: setUrlSafe,
    metadata,
    loading,
    error,
    download,
    fetchMetadata,
    startDownload,
    saveToPc,
    refreshStatus,
  };
}
