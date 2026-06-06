'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload } from 'lucide-react';
import { apiClient } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function CustomAdImageField({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const res = (await apiClient.admin.uploadAdImage(file)) as { url: string };
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
      {value?.trim() && (
        <div className="relative h-28 w-full overflow-hidden rounded-lg border border-border bg-background">
          <Image src={value.trim()} alt="Ad preview" fill className="object-contain" unoptimized />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif"
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
        {value?.trim() ? (
          <Button type="button" variant="outline" size="sm" onClick={() => onChange('')}>
            Remove
          </Button>
        ) : null}
      </div>

      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste image URL: /uploads/ad.png or https://…"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
