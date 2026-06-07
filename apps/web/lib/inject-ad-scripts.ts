import type { ParsedAdScript, ParsedAdTag } from './ad-tag-parser';

const ADS_BY_GOOGLE_LOADER = /adsbygoogle\.js/i;

function isAdsByGooglePush(text: string): boolean {
  return /adsbygoogle/i.test(text) && /\.push\s*\(/.test(text);
}

/** Skip push when slots are hidden or already filled (React Strict Mode remounts). */
function guardAdsByGooglePush(text: string): string {
  return `(function(){
  try {
    var tries = 0;
    function visiblePending() {
      var nodes = document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
      return Array.from(nodes).filter(function(el) {
        var rect = el.getBoundingClientRect();
        var w = el.offsetWidth || rect.width;
        return w > 0 && rect.height >= 0;
      });
    }
    function run() {
      var pending = visiblePending();
      if (!pending.length) {
        var any = document.querySelectorAll('ins.adsbygoogle:not([data-adsbygoogle-status])');
        if (!any.length) return;
        if (++tries < 120) {
          requestAnimationFrame(run);
          return;
        }
        return;
      }
      ${text}
    }
    run();
  } catch (e) {
    var msg = String(e && e.message || e);
    if (msg.includes('already have ads') || msg.includes('No slot size')) return;
    throw e;
  }
})();`;
}

export function waitForAdSlotLayout(host: HTMLElement, maxFrames = 120): Promise<void> {
  return new Promise((resolve) => {
    let frames = 0;
    const tick = () => {
      const ins = host.querySelector('ins.adsbygoogle');
      if (!ins) {
        resolve();
        return;
      }
      const el = ins as HTMLElement;
      const w = el.offsetWidth || el.getBoundingClientRect().width;
      if (w > 0 || ++frames >= maxFrames) {
        resolve();
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

function findExistingAdsByGoogleLoader(): HTMLScriptElement | null {
  return document.querySelector('script[src*="adsbygoogle.js"]');
}

function appendScript(
  target: HTMLElement,
  spec: ParsedAdScript,
  markerId: string,
  index: number,
): HTMLScriptElement {
  const scriptKey = `${markerId}-${index}`;
  const script = document.createElement('script');
  script.setAttribute('data-ad-script', scriptKey);
  if (spec.src) {
    script.src = spec.src;
    if (spec.async) script.async = true;
    if (spec.defer) script.defer = true;
    if (spec.type) script.type = spec.type;
    if (spec.crossOrigin) script.crossOrigin = spec.crossOrigin;
  } else {
    const text = spec.text ?? '';
    script.text = isAdsByGooglePush(text) ? guardAdsByGooglePush(text) : text;
  }
  target.appendChild(script);
  return script;
}

function loadScript(target: HTMLElement, spec: ParsedAdScript, markerId: string, index: number) {
  return new Promise<void>((resolve) => {
    const scriptKey = `${markerId}-${index}`;
    if (document.querySelector(`script[data-ad-script="${scriptKey}"]`)) {
      resolve();
      return;
    }

    if (spec.src && ADS_BY_GOOGLE_LOADER.test(spec.src)) {
      const existing = findExistingAdsByGoogleLoader();
      if (existing) {
        if (existing.getAttribute('data-ad-loaded') === '1') {
          resolve();
          return;
        }
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => resolve(), { once: true });
        return;
      }
    }

    const script = appendScript(target, spec, markerId, index);
    if (!spec.src) {
      resolve();
      return;
    }
    script.onload = () => {
      if (ADS_BY_GOOGLE_LOADER.test(spec.src ?? '')) {
        script.setAttribute('data-ad-loaded', '1');
      }
      resolve();
    };
    script.onerror = () => resolve();
  });
}

function injectHeadNodes(headHtml: string, markerId: string, head: HTMLElement) {
  if (!headHtml.trim()) return;

  const tpl = document.createElement('template');
  tpl.innerHTML = headHtml.trim();
  Array.from(tpl.content.children).forEach((el) => {
    const node = el.cloneNode(true) as Element;
    node.setAttribute('data-ad-head-node', markerId);
    head.appendChild(node);
  });
}

function injectHtmlBlock(html: string, markerId: string, host: HTMLElement) {
  if (!html.trim()) return;

  const wrapId = `ad-html-${markerId}`;
  let wrap = document.getElementById(wrapId);
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = wrapId;
    wrap.setAttribute('data-ad-html', markerId);
    wrap.setAttribute('aria-hidden', 'true');
    wrap.style.display = 'none';
    host.appendChild(wrap);
  }
  wrap.innerHTML = html;
}

function injectInlineCss(css: string, markerId: string, head: HTMLElement) {
  if (!css.trim()) return;

  const styleId = `ad-inline-css-${markerId}`;
  let style = document.getElementById(styleId) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = styleId;
    style.setAttribute('data-ad-inline-css', markerId);
    head.appendChild(style);
  }
  style.textContent = css;
}

/** Inject full HTML/CSS/JS snippet — scripts inside HTML are extracted and executed. */
export async function injectAdAssets(
  parsed: ParsedAdTag,
  opts: {
    markerId: string;
    htmlHost: HTMLElement;
    scriptHost: HTMLElement;
    headTarget?: HTMLElement;
  },
) {
  const head = opts.headTarget ?? document.head;

  for (const href of parsed.stylesheets) {
    const linkId = `ad-css-${opts.markerId}-${href}`;
    if (document.getElementById(linkId)) continue;
    const link = document.createElement('link');
    link.id = linkId;
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-ad-stylesheet', opts.markerId);
    head.appendChild(link);
  }

  injectInlineCss(parsed.css, opts.markerId, head);
  injectHeadNodes(parsed.headHtml, opts.markerId, head);
  injectHtmlBlock(parsed.html, opts.markerId, opts.htmlHost);

  for (let i = 0; i < parsed.scripts.length; i++) {
    const spec = parsed.scripts[i]!;
    await loadScript(opts.scriptHost, spec, opts.markerId, i);
  }
}

export function cleanupAdAssets(markerId: string) {
  document.querySelectorAll(`[data-ad-script^="${markerId}-"]`).forEach((el) => el.remove());
  document.querySelectorAll(`[data-ad-stylesheet="${markerId}"]`).forEach((el) => el.remove());
  document.querySelectorAll(`[data-ad-head-node="${markerId}"]`).forEach((el) => el.remove());
  document.getElementById(`ad-inline-css-${markerId}`)?.remove();
  document.getElementById(`ad-html-${markerId}`)?.remove();
}
