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
  THUMBNAIL_CATEGORY_AUTO,
  THUMBNAIL_CATEGORY_OPTIONS,
  type ThumbnailCategoryValue,
} from '@hellodownloader/shared-types';

type CategorySelectProps = {
  value: ThumbnailCategoryValue;
  onChange: (value: ThumbnailCategoryValue) => void;
  disabled?: boolean;
  id?: string;
};

export function CategorySelect({
  value,
  onChange,
  disabled,
  id = 'thumbnail-category',
}: CategorySelectProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Category
      </Label>
      <Select
        value={value}
        onValueChange={(v) => onChange(v as ThumbnailCategoryValue)}
        disabled={disabled}
      >
        <SelectTrigger id={id} className="bg-background border-border">
          <SelectValue placeholder="Auto Detect" />
        </SelectTrigger>
        <SelectContent>
          {THUMBNAIL_CATEGORY_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        Helps AI apply the correct thumbnail strategy.
      </p>
    </div>
  );
}

export { THUMBNAIL_CATEGORY_AUTO };
