'use client';

import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

type ThumbnailTitleFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  id?: string;
};

export function ThumbnailTitleField({
  value,
  onChange,
  disabled,
  error,
  id = 'thumbnail-title',
}: ThumbnailTitleFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Thumbnail Title <span className="text-destructive">*</span>
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="The Mother Was Pronounced Dead 😳 Doctors Had Already Given Up Hope..."
        disabled={disabled}
        className={cn(
          'bg-background border-border',
          error && 'border-destructive focus-visible:ring-destructive/40',
        )}
      />
      <p className="text-xs text-muted-foreground">
        Used by AI to generate high CTR thumbnail text.
      </p>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
