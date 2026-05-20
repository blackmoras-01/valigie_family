import GlobeWrapper from './components/GlobeWrapper';

async function getCounts(): Promise<Record<string, number>> {
  try {
    const base = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000';
    const res = await fetch(`${base}/api/luggage`, { cache: 'no-store' });
    return await res.json();
  } catch {
    return { milan: 0, eindhoven: 0, barcelona: 0, zanzibar: 0 };
  }
}

export default async function Home() {
  const initialCounts = await getCounts();
  return <GlobeWrapper initialCounts={initialCounts} />;
}
