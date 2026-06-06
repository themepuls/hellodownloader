'use client';

import { useEffect } from 'react';
import { hasProAccess } from '@hellodownloader/shared-types';
import { useAdsConfig } from '@/hooks/useAdsConfig';
import { useUserStore } from '@/store/userStore';
import { parseAdTag } from '@/lib/ad-tag-parser';
import { cleanupAdAssets, injectAdAssets } from '@/lib/inject-ad-scripts';

/** Injects global ad code from any network (loaders, verification tags, site-wide CSS). */
export function AdGlobalScripts() {
  const user = useUserStore((s) => s.user);
  const { config, loaded } = useAdsConfig();

  useEffect(() => {
    if (!loaded || !config.showAds || hasProAccess(user?.plan, user?.role)) return;

    const global = config.global;
    const markerId = 'hd-global-ad';
    const tag = global.adTag.trim();

    const parsed = tag
      ? parseAdTag(tag)
      : {
          html: '',
          css: global.css,
          scripts: global.headJs.trim()
            ? /^https?:\/\//i.test(global.headJs.trim())
              ? [{ src: global.headJs.trim(), async: true }]
              : [{ text: global.headJs.trim() }]
            : [],
          stylesheets: [] as string[],
          headHtml: global.headHtml,
        };

    const styleId = 'hd-global-ad-css';
    if (parsed.css.trim()) {
      let style = document.getElementById(styleId) as HTMLStyleElement | null;
      if (!style) {
        style = document.createElement('style');
        style.id = styleId;
        document.head.appendChild(style);
      }
      style.textContent = parsed.css;
    }

    let cancelled = false;
    void injectAdAssets(parsed, {
      markerId,
      htmlHost: document.body,
      scriptHost: document.head,
      headTarget: document.head,
    }).then(() => {
      if (cancelled) cleanupAdAssets(markerId);
    });

    return () => {
      cancelled = true;
      document.getElementById(styleId)?.remove();
      cleanupAdAssets(markerId);
    };
  }, [config, loaded, user?.plan, user?.role]);

  return null;
}
