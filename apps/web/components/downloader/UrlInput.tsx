'use client';

import { Input } from '@/components/ui/input';

interface UrlInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export function UrlInput({ value, onChange, placeholder }: UrlInputProps) {
  return (
    <Input
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? 'Paste YouTube, Facebook, Instagram, TikTok, or Twitter/X URL...'}
      className="text-base h-12"
    />
  );
}
