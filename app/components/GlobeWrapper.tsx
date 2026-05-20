'use client';

import dynamic from 'next/dynamic';

const Globe = dynamic(() => import('./Globe'), { ssr: false });

export default function GlobeWrapper({ initialCounts }: { initialCounts: Record<string, number> }) {
  return <Globe initialCounts={initialCounts} />;
}
