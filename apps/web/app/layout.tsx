import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { GoogleAuthProvider } from '@/components/providers/GoogleAuthProvider';
import { Navbar } from '@/components/navbar/Navbar';
import { Footer } from '@/components/footer/Footer';
import { SiteAds } from '@/components/ads/SiteAds';
import { SiteScripts } from '@/components/site/SiteScripts';
import { buildRootMetadata } from '@/lib/seo/build-metadata';
import { fetchSiteSettings } from '@/lib/fetch-site-settings';

const inter = Inter({ subsets: ['latin'] });

export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata();
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const siteSettings = await fetchSiteSettings();

  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className} suppressHydrationWarning>
        <ThemeProvider>
          <GoogleAuthProvider>
            <div className="flex min-h-screen flex-col">
              <Navbar />
              <main className="flex-1 overflow-x-hidden">{children}</main>
              <SiteAds />
              <SiteScripts settings={siteSettings} />
              <Footer />
            </div>
          </GoogleAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
