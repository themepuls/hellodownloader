import * as fs from 'fs';
import * as path from 'path';
import {
  ADJUST_TEXT_PROOFREAD_PROMPT,
  ADJUST_VISION_SYSTEM_PROMPT,
  buildAdjustVisionUserPrompt,
  normalizeAdjustVisionPlan,
  type AdjustVisionPlan,
} from '@hellodownloader/shared-types';

function imageToDataUri(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mime =
    ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

export async function proofreadAdjustVisionText(input: {
  apiKey: string;
  model: string;
  plan: AdjustVisionPlan;
  ocrHint?: string;
}): Promise<AdjustVisionPlan> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ADJUST_TEXT_PROOFREAD_PROMPT },
        {
          role: 'user',
          content: `Proofread these blocks:\n${JSON.stringify(input.plan.textBlocks, null, 2)}${
            input.ocrHint?.trim() ? `\n\nOCR reference:\n${input.ocrHint.slice(0, 2000)}` : ''
          }`,
        },
      ],
    }),
  });

  if (!res.ok) return input.plan;

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return input.plan;

  try {
    const parsed = JSON.parse(raw) as { textBlocks?: unknown };
    if (!Array.isArray(parsed.textBlocks) || parsed.textBlocks.length === 0) {
      return input.plan;
    }
    return {
      ...input.plan,
      textBlocks: parsed.textBlocks
        .map((b, i) => {
          if (!b || typeof b !== 'object') return input.plan.textBlocks[i];
          const block = b as Record<string, unknown>;
          const text = String(block.text ?? '').trim();
          if (!text) return input.plan.textBlocks[i]!;
          const prev = input.plan.textBlocks[i];
          return {
            text,
            color: String(block.color ?? prev?.color ?? '#FFFFFF').trim(),
            role: block.role ? String(block.role) : prev?.role,
          };
        })
        .filter(Boolean) as AdjustVisionPlan['textBlocks'],
    };
  } catch {
    return input.plan;
  }
}

export async function analyzeAdjustVision(input: {
  apiKey: string;
  model: string;
  imagePath: string;
  ratio: string;
  ocrLines?: string[];
  fullOcrText?: string;
}): Promise<AdjustVisionPlan | null> {
  const ocrHint =
    input.fullOcrText?.trim() ||
    (input.ocrLines?.length ? input.ocrLines.join('\n') : undefined);

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${input.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: input.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: ADJUST_VISION_SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: buildAdjustVisionUserPrompt({ ratio: input.ratio, ocrHint }) },
            { type: 'image_url', image_url: { url: imageToDataUri(input.imagePath) } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Vision analysis failed (${res.status})${body ? `: ${body.slice(0, 180)}` : ''}`);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const raw = data.choices?.[0]?.message?.content?.trim();
  if (!raw) return null;

  let plan: AdjustVisionPlan | null;
  try {
    plan = normalizeAdjustVisionPlan(JSON.parse(raw));
  } catch {
    return null;
  }

  if (!plan) return null;

  return proofreadAdjustVisionText({
    apiKey: input.apiKey,
    model: input.model,
    plan,
    ocrHint,
  });
}
