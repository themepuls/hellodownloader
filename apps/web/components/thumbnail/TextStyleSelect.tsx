'use client';

import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  THUMBNAIL_TEXT_STYLE_AUTO,
  THUMBNAIL_TEXT_STYLE_OPTIONS,
  type ThumbnailTextStyleValue,
} from '@hellodownloader/shared-types';

type TextStyleSelectProps = {
  value: ThumbnailTextStyleValue;
  onChange: (value: ThumbnailTextStyleValue) => void;
  disabled?: boolean;
  id?: string;
};

export function TextStyleSelect({
  value,
  onChange,
  disabled,
  id = 'thumbnail-text-style',
}: TextStyleSelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Text Style
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ThumbnailTextStyleValue)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="bg-background border-border">
          <SelectValue placeholder="Auto Detect" />
        </SelectTrigger>
        <SelectContent>
          {THUMBNAIL_TEXT_STYLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Controls headline length and storytelling format.
      </p>
    </div>
  );
}

export { THUMBNAIL_TEXT_STYLE_AUTO };
