'use client';

import { useEffect } from 'react';
import { parseAdTag } from '@/lib/ad-tag-parser';
import { cleanupAdAssets, injectAdAssets } from '@/lib/inject-ad-scripts';
import {
  DEFAULT_SITE_SETTINGS,
  normalizeSiteSettings,
  type SiteSettingsPublic,
} from '@hellodownloader/shared-types';

function wrapJsField(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '';
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return `<script src="${trimmed}"></script>`;
  return `<script>${trimmed}</script>`;
}

async function injectSnippet(raw: string, markerId: string, host: HTMLElement) {
  if (!raw.trim()) return;
  const parsed = parseAdTag(raw);
  await injectAdAssets(parsed, {
    markerId,
    htmlHost: host,
    scriptHost: host,
    headTarget: document.head,
  });
}

async function applySiteSettings(settings: SiteSettingsPublic) {
  if (settings.globalCss.trim()) {
    const styleId = 'hd-site-settings-css';
    let style = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = settings.globalCss;
  }

  await injectSnippet(settings.customHeadSnippet, 'hd-site-custom', document.head);
  await injectSnippet(settings.globalHeadHtml, 'hd-site-head-html', document.head);
  await injectSnippet(wrapJsField(settings.globalHeadJs), 'hd-site-head-js', document.head);
  await injectSnippet(wrapJsField(settings.globalBodyJs), 'hd-site-body', document.body);
}

type SiteScriptsProps = {
  settings: SiteSettingsPublic;
};

/** Injects site-wide custom CSS, JS, and head HTML from Admin → Site Settings. */
export function SiteScripts({ settings }: SiteScriptsProps) {
  useEffect(() => {
    const markers = ['hd-site-custom', 'hd-site-head-html', 'hd-site-head-js', 'hd-site-body'];
    const normalized = normalizeSiteSettings(settings);

    void applySiteSettings(normalized).catch((err) => {
      console.error('[SiteScripts] Failed to inject custom code:', err);
    });

    return () => {
      document.getElementById('hd-site-settings-css')?.remove();
      for (const markerId of markers) {
        cleanupAdAssets(markerId);
      }
    };
  }, [settings]);

  return null;
}

export { DEFAULT_SITE_SETTINGS as defaultSiteSettingsForScripts };
