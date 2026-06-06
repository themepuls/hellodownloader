'use client';

import { useEffect, useState } from 'react';

/** True after the component has mounted in the browser (avoids SSR hydration mismatches). */
export function useClientMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted;
}
