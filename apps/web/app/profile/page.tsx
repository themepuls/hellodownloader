'use client';

import { useUserStore } from '@/store/userStore';

export default function ProfilePage() {
  const user = useUserStore((s) => s.user);
  if (!user) return <p className="p-8">Please login.</p>;
  return (
    <div className="container mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold mb-4">Profile</h1>
      <p>Email: {user.email}</p>
      <p>Plan: {user.plan}</p>
    </div>
  );
}
