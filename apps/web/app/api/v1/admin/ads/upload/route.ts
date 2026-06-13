import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const API_ORIGIN = process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:4001';

async function requireAdmin(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (!auth) return false;

  const res = await fetch(`${API_ORIGIN}/api/v1/auth/me`, {
    headers: { Authorization: auth },
  });
  if (!res.ok) return false;

  const data = (await res.json()) as { user?: { role?: string } };
  return data.user?.role === 'ADMIN';
}

export async function POST(req: NextRequest) {
  if (!(await requireAdmin(req))) {
    return NextResponse.json({ message: 'Admin access required.' }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ message: 'No image file provided' }, { status: 400 });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ message: 'File must be 5 MB or smaller' }, { status: 400 });
  }

  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
  if (!allowed.has(file.type)) {
    return NextResponse.json({ message: 'Use PNG, JPG, WebP, or GIF' }, { status: 400 });
  }

  const ext = path.extname(file.name).toLowerCase() || '.jpg';
  const uploadDir = path.join(process.cwd(), 'public/uploads');
  fs.mkdirSync(uploadDir, { recursive: true });

  const safeName = `ad-${Date.now()}${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  fs.writeFileSync(path.join(uploadDir, safeName), buffer);

  return NextResponse.json({ url: `/uploads/${safeName}` });
}
