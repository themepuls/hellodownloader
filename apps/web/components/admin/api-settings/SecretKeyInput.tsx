'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export function SecretKeyInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
}) {
  const [visible, setVisible] = useState(false);

  const copy = async () => {
    if (!value.trim()) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <Input
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm"
        />
        <Button type="button" variant="outline" size="icon" onClick={() => setVisible((v) => !v)}>
          {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button type="button" variant="outline" size="icon" onClick={() => void copy()} disabled={!value.trim()}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
