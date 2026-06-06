'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULT_ACCEPT = 'image/png,image/jpeg,image/webp,image/gif';

export function ImageUploadField({
  label,
  value,
  onChange,
  hint,
  accept = DEFAULT_ACCEPT,
  showUrlField = false,
  previewClassName = 'h-10 w-10',
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  accept?: string;
  /** Show optional URL text field (off by default — upload only). */
  showUrlField?: boolean;
  previewClassName?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = (await apiClient.admin.uploadBranding(file)) as { url: string };
      onChange(res.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <label className="text-xs text-muted-foreground">{label}</label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}

      {value?.trim() && (
        <div className="flex items-center gap-3 rounded-lg border border-border bg-background p-3">
          <div className={`relative shrink-0 ${previewClassName}`}>
            <Image src={value.trim()} alt="Preview" fill className="object-contain" unoptimized />
          </div>
          <span className="text-xs text-muted-foreground truncate flex-1">{value}</span>
          <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
            Remove
          </Button>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          {uploading ? 'Uploading…' : 'Upload image'}
        </Button>
      </div>

      {showUrlField && (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Or paste URL: /uploads/image.png or https://…"
        />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

/** @deprecated use ImageUploadField */
export function LogoUploadField(props: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
}) {
  return <ImageUploadField {...props} showUrlField />;
}
