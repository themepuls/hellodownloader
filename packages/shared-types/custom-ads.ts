export type CustomAdFormat = 'square' | 'banner';

/** Download-tool pages only. */
export type CustomAdPage = 'download' | 'thumbnail' | 'playlist';

export type CustomAdPosition = 'top' | 'sidebar' | 'bottom';

export type CustomAdItem = {
  id: string;
  enabled: boolean;
  page: CustomAdPage;
  position: CustomAdPosition;
  format: CustomAdFormat;
  title: string;
  imageUrl: string;
  linkUrl: string;
  openInNewTab: boolean;
  sortOrder: number;
};

export const CUSTOM_AD_PAGES: { value: CustomAdPage; label: string }[] = [
  { value: 'download', label: 'Video download' },
  { value: 'thumbnail', label: 'Thumbnail download' },
  { value: 'playlist', label: 'Playlist download' },
];

export const CUSTOM_AD_POSITIONS: { value: CustomAdPosition; label: string; hint: string }[] = [
  { value: 'top', label: 'Top banner', hint: 'Wide strip at top of the tool page (boxed width)' },
  { value: 'sidebar', label: 'Sidebar', hint: 'Square ads in the right column beside tool content' },
  { value: 'bottom', label: 'Bottom', hint: 'Ads above the footer on the tool page' },
];

export const CUSTOM_AD_FORMATS: { value: CustomAdFormat; label: string }[] = [
  { value: 'square', label: 'Square' },
  { value: 'banner', label: 'Banner' },
];

export const DEFAULT_CUSTOM_ADS_BANNER_HEIGHT_PX = 170;

export function normalizeCustomAdsBannerHeightPx(value: unknown): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value ?? ''), 10);
  if (!Number.isFinite(n)) return DEFAULT_CUSTOM_ADS_BANNER_HEIGHT_PX;
  return Math.max(60, Math.min(400, Math.round(n)));
}

function defaultPositionForFormat(format: CustomAdFormat): CustomAdPosition {
  return format === 'banner' ? 'top' : 'sidebar';
}

function migrateLegacyPlacement(legacy: string | undefined): Pick<CustomAdItem, 'page' | 'position'> {
  switch (legacy) {
    case 'download-top':
      return { page: 'download', position: 'top' };
    case 'download-sidebar':
      return { page: 'download', position: 'sidebar' };
    default:
      return { page: 'download', position: 'sidebar' };
  }
}

type CustomAdItemInput = Partial<CustomAdItem> & { placement?: string };

function sanitizeHttpLinkUrl(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return '';
    return parsed.toString();
  } catch {
    return '';
  }
}

export function createCustomAdItem(partial: CustomAdItemInput = {}): CustomAdItem {
  const format = partial.format ?? 'square';
  const legacy = migrateLegacyPlacement(partial.placement);
  const page = partial.page ?? legacy.page;
  const position = partial.position ?? legacy.position ?? defaultPositionForFormat(format);

  return {
    id: partial.id ?? `ad-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    enabled: partial.enabled ?? true,
    page,
    position,
    format,
    title: partial.title ?? '',
    imageUrl: partial.imageUrl ?? '',
    linkUrl: sanitizeHttpLinkUrl(partial.linkUrl),
    openInNewTab: partial.openInNewTab ?? true,
    sortOrder: partial.sortOrder ?? 0,
  };
}

export function normalizeCustomAds(items: CustomAdItemInput[] | undefined): CustomAdItem[] {
  if (!items?.length) return [];
  return items
    .map((item, index) => createCustomAdItem({ ...item, sortOrder: index }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function activeCustomAds(
  items: CustomAdItem[],
  filter?: { page?: CustomAdPage; position?: CustomAdPosition },
): CustomAdItem[] {
  return items.filter(
    (item) =>
      item.enabled &&
      item.imageUrl.trim() &&
      (filter?.page == null || item.page === filter.page) &&
      (filter?.position == null || item.position === filter.position),
  );
}

export function activeCustomAdsForPage(items: CustomAdItem[], page: CustomAdPage): CustomAdItem[] {
  return activeCustomAds(items, { page });
}
