'use client';

import { ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import {
  createCustomAdItem,
  CUSTOM_AD_FORMATS,
  CUSTOM_AD_PAGES,
  CUSTOM_AD_POSITIONS,
  type CustomAdFormat,
  type CustomAdItem,
  type CustomAdPage,
  type CustomAdPosition,
} from '@hellodownloader/shared-types';
import { CustomAdImageField } from '@/components/admin/ads/CustomAdImageField';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type CustomAdsEditorProps = {
  enabled: boolean;
  onEnabledChange: (value: boolean) => void;
  items: CustomAdItem[];
  onChange: (items: CustomAdItem[]) => void;
};

export function CustomAdsEditor({
  enabled,
  onEnabledChange,
  items,
  onChange,
}: CustomAdsEditorProps) {
  const updateItem = (id: string, patch: Partial<CustomAdItem>) => {
    onChange(items.map((item) => (item.id === id ? createCustomAdItem({ ...item, ...patch }) : item)));
  };

  const addItem = () => {
    onChange([...items, createCustomAdItem({ sortOrder: items.length })]);
  };

  const removeItem = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const moveItem = (id: string, direction: -1 | 1) => {
    const index = items.findIndex((item) => item.id === id);
    if (index < 0) return;
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [entry] = next.splice(index, 1);
    next.splice(target, 0, entry!);
    onChange(next.map((item, sortOrder) => createCustomAdItem({ ...item, sortOrder })));
  };

  return (
    <div className="space-y-4">
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Enable custom image ads
      </label>

      <p className="text-sm text-muted-foreground">
        Image ads for download tools only: Video download, Thumbnail download, and Playlist download.
        Pick a page, zone (top, sidebar, or bottom), upload an image, and set a link. All zones use the
        same boxed width as the tool page (max-w-5xl).
      </p>

      <div className="rounded-lg border border-border p-3 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">Ad zones</p>
        <p>Top — banner strip below the navbar · Sidebar — right column beside tool content · Bottom — above the site footer</p>
        <p>Pricing, FAQ, Terms, Privacy, DMCA, Home, and other pages do not show ads.</p>
      </div>

      <div className="space-y-4">
        {items.map((item, index) => (
          <CustomAdRow
            key={item.id}
            item={item}
            index={index}
            total={items.length}
            onChange={(patch) => updateItem(item.id, patch)}
            onRemove={() => removeItem(item.id)}
            onMoveUp={() => moveItem(item.id, -1)}
            onMoveDown={() => moveItem(item.id, 1)}
          />
        ))}
      </div>

      <Button type="button" variant="outline" size="sm" className="gap-2" onClick={addItem}>
        <Plus className="h-4 w-4" />
        Add custom ad
      </Button>
    </div>
  );
}

function CustomAdRow({
  item,
  index,
  total,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
}: {
  item: CustomAdItem;
  index: number;
  total: number;
  onChange: (patch: Partial<CustomAdItem>) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const positionHint = CUSTOM_AD_POSITIONS.find((opt) => opt.value === item.position)?.hint;

  return (
    <div className="rounded-xl border border-border p-4 space-y-4 bg-background/40">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={item.enabled}
            onChange={(e) => onChange({ enabled: e.target.checked })}
          />
          Ad #{index + 1}
        </label>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon" className="h-8 w-8" disabled={index === 0} onClick={onMoveUp}>
            <ChevronUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={index >= total - 1}
            onClick={onMoveDown}
          >
            <ChevronDown className="h-4 w-4" />
          </Button>
          <Button type="button" variant="outline" size="icon" className="h-8 w-8 text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        <Field label="Page">
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={item.page}
            onChange={(e) => onChange({ page: e.target.value as CustomAdPage })}
          >
            {CUSTOM_AD_PAGES.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Zone">
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={item.position}
            onChange={(e) => onChange({ position: e.target.value as CustomAdPosition })}
          >
            {CUSTOM_AD_POSITIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {positionHint ? <p className="text-xs text-muted-foreground mt-1">{positionHint}</p> : null}
        </Field>
        <Field label="Format">
          <select
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            value={item.format}
            onChange={(e) => onChange({ format: e.target.value as CustomAdFormat })}
          >
            {CUSTOM_AD_FORMATS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Ad image">
        <CustomAdImageField value={item.imageUrl} onChange={(imageUrl) => onChange({ imageUrl })} />
      </Field>

      <Field label="Click URL">
        <Input
          value={item.linkUrl}
          onChange={(e) => onChange({ linkUrl: e.target.value })}
          placeholder="https://example.com/offer"
        />
      </Field>

      <Field label="Alt text (optional)">
        <Input
          value={item.title}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder="Promotional banner title"
        />
      </Field>

      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={item.openInNewTab}
          onChange={(e) => onChange({ openInNewTab: e.target.checked })}
        />
        Open link in new tab
      </label>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
