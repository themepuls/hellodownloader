'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CreditsPage() {
  return (
    <div className="container mx-auto px-4 py-12 max-w-2xl">
      <h1 className="text-3xl font-bold mb-8">Credits</h1>
      <Card>
        <CardHeader>
          <CardTitle>Free tools don&apos;t use credits</CardTitle>
          <CardDescription>
            Downloads, playlists, original thumbnails, audio, and subtitles are free with no credit
            balance required. Pro AI features and credit-based billing will be added in a future
            update.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Link href="/download">
            <Button>Go to Download</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
