import type { CustomAdPage } from '@hellodownloader/shared-types';

const TOOL_PAGES = new Set<CustomAdPage>(['download', 'thumbnail', 'playlist']);

/** Only download, thumbnail, and playlist pages show ads. */
export function resolveAdPageFromPath(pathname: string): CustomAdPage | null {
  if (pathname === '/download') return 'download';
  if (pathname === '/thumbnail') return 'thumbnail';
  if (pathname === '/playlist') return 'playlist';
  return null;
}

export function isToolAdPage(page: CustomAdPage | null): page is CustomAdPage {
  return page != null && TOOL_PAGES.has(page);
}

export function isPublicAdPath(pathname: string): boolean {
  return resolveAdPageFromPath(pathname) != null;
}
