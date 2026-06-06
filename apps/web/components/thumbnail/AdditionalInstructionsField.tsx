'use client';

import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

type AdditionalInstructionsFieldProps = {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  id?: string;
};

export function AdditionalInstructionsField({
  value,
  onChange,
  disabled,
  id = 'additional-instructions',
}: AdditionalInstructionsFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id} className="text-sm font-medium">
        Additional Instructions <span className="text-muted-foreground font-normal">(Optional)</span>
      </Label>
      <Textarea
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={'Focus on the baby\nUse stronger emotion\nMake the doctor larger\nUse red text'}
        disabled={disabled}
        rows={4}
        className="bg-background resize-y min-h-[100px]"
      />
      <p className="text-xs text-muted-foreground">
        Optional custom instructions for AI.
      </p>
    </div>
  );
}
