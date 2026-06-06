import type { PageSeoContent } from '@hellodownloader/shared-types';
import { Field, TextArea } from '@/components/admin/content/ContentFields';
import { ImageUploadField } from '@/components/admin/content/ImageUploadField';

type SeoFieldsEditorProps = {
  seo: PageSeoContent;
  onChange: (seo: PageSeoContent) => void;
};

export function SeoFieldsEditor({ seo, onChange }: SeoFieldsEditorProps) {
  const set = (patch: Partial<PageSeoContent>) => onChange({ ...seo, ...patch });

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div>
        <h3 className="font-semibold text-sm">SEO</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Overrides global defaults from Site Settings when filled in. Leave blank to use global SEO.
        </p>
      </div>
      <Field label="Meta title" value={seo.metaTitle} onChange={(v) => set({ metaTitle: v })} />
      <TextArea
        label="Meta description"
        value={seo.metaDescription}
        onChange={(v) => set({ metaDescription: v })}
        rows={3}
      />
      <Field label="Keywords (comma-separated)" value={seo.keywords} onChange={(v) => set({ keywords: v })} />
      <Field label="Canonical URL (optional)" value={seo.canonicalUrl} onChange={(v) => set({ canonicalUrl: v })} />
      <Field label="Open Graph title" value={seo.ogTitle} onChange={(v) => set({ ogTitle: v })} />
      <TextArea
        label="Open Graph description"
        value={seo.ogDescription}
        onChange={(v) => set({ ogDescription: v })}
        rows={2}
      />
      <ImageUploadField
        label="Social share image (Open Graph)"
        hint="Override the global share image for this page only. 1200×630 PNG or JPG recommended."
        value={seo.ogImage}
        onChange={(v) => set({ ogImage: v })}
        accept="image/png,image/jpeg,image/webp"
        previewClassName="h-16 w-28"
      />
      <label className="flex items-center gap-2 text-sm cursor-pointer">
        <input
          type="checkbox"
          checked={seo.noIndex}
          onChange={(e) => set({ noIndex: e.target.checked })}
        />
        Hide from search engines (noindex)
      </label>
    </div>
  );
}
