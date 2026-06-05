import Link from 'next/link';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function Footer() {
  return (
    <footer className="border-t border-white/5 bg-[#0b0e14] py-16">
      <div className="container mx-auto px-4">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <Link href="/" className="mb-4 flex items-center gap-2 font-bold">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
                <Download className="h-4 w-4 text-primary-foreground" />
              </div>
              HelloDownloader
            </Link>
            <p className="mb-4 max-w-xs text-sm text-muted-foreground">
              The all-in-one video downloader for creators. Fast, free, and secure.
            </p>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Product</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/download" className="hover:text-foreground">Downloader</Link></li>
              <li><Link href="/thumbnail" className="hover:text-foreground">Thumbnails</Link></li>
              <li><Link href="/playlist" className="hover:text-foreground">Playlist</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground">Pricing</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Company</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/blog" className="hover:text-foreground">Blog</Link></li>
              <li><Link href="/faq" className="hover:text-foreground">FAQ</Link></li>
              <li><Link href="/dashboard" className="hover:text-foreground">Dashboard</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-4 font-semibold">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground">Terms</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground">Privacy</Link></li>
              <li><Link href="/dmca" className="hover:text-foreground">DMCA</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} HelloDownloader. All rights reserved.
          </p>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="Enter your email"
              className="rounded-lg border border-white/10 bg-[#12151c] px-4 py-2 text-sm outline-none focus:border-primary"
              readOnly
            />
            <Button size="sm">Subscribe</Button>
          </div>
        </div>
      </div>
    </footer>
  );
}
