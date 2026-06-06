'use client';

import { useState } from 'react';
import { Copy, Eye, EyeOff } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { isMaskedApiKey } from '@hellodownloader/shared-types';

export function SecretKeyInput({
  label,
  value,
  onChange,
  placeholder,
  hint,
  configured,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  configured?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const isMasked = isMaskedApiKey(value);
  const showAsText = isMasked || visible;

  const copy = async () => {
    if (!value.trim() || isMasked) return;
    await navigator.clipboard.writeText(value);
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      <div className="flex gap-2">
        <Input
          type={showAsText ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="font-mono text-sm bg-background border-border"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => setVisible((v) => !v)}
          disabled={isMasked}
          title={isMasked ? 'Saved keys are shown masked' : visible ? 'Hide key' : 'Show key'}
        >
          {visible && !isMasked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => void copy()}
          disabled={!value.trim() || isMasked}
          title={isMasked ? 'Copy is disabled for saved keys' : 'Copy key'}
        >
          <Copy className="h-4 w-4" />
        </Button>
      </div>
      {(configured || isMasked) && (
        <p className="text-xs text-emerald-400/90">API key saved (masked for security)</p>
      )}
    </div>
  );
}
