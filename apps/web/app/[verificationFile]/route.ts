import { NextResponse } from 'next/server';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';

type Props = { params: Promise<{ verificationFile: string }> };

export async function GET(_request: Request, { params }: Props) {
  const { verificationFile } = await params;
  const settings = await fetchSiteSettings();
  const file = settings.verificationFiles.find((f) => f.filename === verificationFile);
  if (!file) {
    return new NextResponse('Not Found', { status: 404 });
  }
  return new NextResponse(file.content, {
    headers: { 'Content-Type': 'text/html; charset=utf-8' },
  });
}
