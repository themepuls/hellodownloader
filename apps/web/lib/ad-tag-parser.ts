/** Parsed ad snippet from any network (AdSense, PropellerAds, Media.net, etc.). */
export type ParsedAdScript = {
  src?: string;
  text?: string;
  async?: boolean;
  defer?: boolean;
  type?: string;
  crossOrigin?: string;
};

export type ParsedAdTag = {
  html: string;
  css: string;
  scripts: ParsedAdScript[];
  stylesheets: string[];
  headHtml: string;
};

const EMPTY: ParsedAdTag = {
  html: '',
  css: '',
  scripts: [],
  stylesheets: [],
  headHtml: '',
};

/** Parse a full ad tag pasted from any ad network. */
export function parseAdTag(raw: string): ParsedAdTag {
  const trimmed = raw.trim();
  if (!trimmed) return { ...EMPTY };

  const wrapped =
    trimmed.includes('<html') || trimmed.includes('<body')
      ? trimmed
      : `<div data-ad-tag-root="1">${trimmed}</div>`;

  const doc = new DOMParser().parseFromString(wrapped, 'text/html');
  const root = doc.body;

  const scripts: ParsedAdScript[] = [];
  root.querySelectorAll('script').forEach((el) => {
    const src = el.getAttribute('src') ?? undefined;
    scripts.push({
      src,
      text: src ? undefined : (el.textContent ?? ''),
      async: el.async,
      defer: el.defer,
      type: el.type || undefined,
      crossOrigin: el.crossOrigin || undefined,
    });
    el.remove();
  });

  const stylesheets: string[] = [];
  root.querySelectorAll('link[rel="stylesheet"]').forEach((el) => {
    const href = el.getAttribute('href');
    if (href) stylesheets.push(href);
    el.remove();
  });

  let css = '';
  root.querySelectorAll('style').forEach((el) => {
    css += `${el.textContent ?? ''}\n`;
    el.remove();
  });

  const headParts: string[] = [];
  root.querySelectorAll('meta, link:not([rel="stylesheet"])').forEach((el) => {
    headParts.push(el.outerHTML);
    el.remove();
  });

  return {
    html: root.innerHTML.trim(),
    css: css.trim(),
    scripts,
    stylesheets,
    headHtml: headParts.join('\n'),
  };
}

function jsFieldToScripts(js: string): ParsedAdScript[] {
  const trimmed = js.trim();
  if (!trimmed) return [];
  if (/^https?:\/\//i.test(trimmed)) {
    return [{ src: trimmed, async: true }];
  }
  return [{ text: trimmed }];
}

/** Prefer full ad tag; fall back to split HTML / CSS / JS fields. */
export function resolveAdSlotContent(
  adTag: string,
  html: string,
  css: string,
  js: string,
): ParsedAdTag {
  if (adTag.trim()) return parseAdTag(adTag);
  return {
    html,
    css,
    scripts: jsFieldToScripts(js),
    stylesheets: [],
    headHtml: '',
  };
}

export function hasAdContent(
  adTag: string,
  html: string,
  css: string,
  js: string,
): boolean {
  return Boolean(adTag.trim() || html.trim() || css.trim() || js.trim());
}
