'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Download, Shield, Users, Wallet } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { apiClient } from '@/lib/api';
import { useUserStore } from '@/store/userStore';

type AdminStats = {
  users: number;
  downloads: number;
  revenue: number | null;
};

export default function AdminPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    if (user.role !== 'ADMIN') {
      router.replace('/dashboard');
      return;
    }
    apiClient.admin
      .stats()
      .then((data) => setStats(data as AdminStats))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load admin stats'));
  }, [user, router]);

  if (!user) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p>
          Please <Link href="/login" className="text-primary underline">login</Link> as admin.
        </p>
      </div>
    );
  }

  if (user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Shield className="h-8 w-8 text-primary" />
            Admin
          </h1>
          <p className="text-muted-foreground mt-1">Signed in as {user.email}</p>
        </div>
        <Link href="/dashboard">
          <Button variant="outline">User dashboard</Button>
        </Link>
      </div>

      {error && <p className="text-destructive mb-6">{error}</p>}

      <div className="grid md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.users ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.downloads ?? '—'}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Revenue</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {stats?.revenue != null ? `$${(stats.revenue / 100).toFixed(2)}` : '—'}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
