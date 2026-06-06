import type { ParsedAdScript, ParsedAdTag } from './ad-tag-parser';

function appendScript(
  target: HTMLElement,
  spec: ParsedAdScript,
  markerId: string,
  index: number,
): HTMLScriptElement {
  const script = document.createElement('script');
  script.setAttribute('data-ad-script', `${markerId}-${index}`);
  if (spec.src) {
    script.src = spec.src;
    if (spec.async) script.async = true;
    if (spec.defer) script.defer = true;
    if (spec.type) script.type = spec.type;
    if (spec.crossOrigin) script.crossOrigin = spec.crossOrigin;
  } else {
    script.text = spec.text ?? '';
  }
  target.appendChild(script);
  return script;
}

function loadScript(target: HTMLElement, spec: ParsedAdScript, markerId: string, index: number) {
  return new Promise<void>((resolve) => {
    const script = appendScript(target, spec, markerId, index);
    if (!spec.src) {
      resolve();
      return;
    }
    script.onload = () => resolve();
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
