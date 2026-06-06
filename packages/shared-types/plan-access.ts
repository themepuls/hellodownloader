export function hasProAccess(
  plan: string | null | undefined,
  role?: string | null,
): boolean {
  if (role === 'ADMIN') return true;
  return plan === 'PRO';
}

export function effectivePlan(plan: string, role?: string | null): 'FREE' | 'PRO' {
  return hasProAccess(plan, role) ? 'PRO' : 'FREE';
}
