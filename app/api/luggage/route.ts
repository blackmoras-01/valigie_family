import { NextRequest, NextResponse } from 'next/server';

const DEFAULT: Record<string, number> = {
  milan: 0, eindhoven: 0, barcelona: 0, zanzibar: 0,
};

// In-memory fallback for local development (resets on server restart).
// On Vercel, add the Vercel KV integration so data persists across users.
const memStore: Record<string, number> = { ...DEFAULT };

async function useKV(): Promise<boolean> {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
}

async function readAll(): Promise<Record<string, number>> {
  if (await useKV()) {
    const { kv } = await import('@vercel/kv');
    return (await kv.get<Record<string, number>>('luggage')) ?? { ...DEFAULT };
  }
  return { ...memStore };
}

async function writeAll(data: Record<string, number>): Promise<void> {
  if (await useKV()) {
    const { kv } = await import('@vercel/kv');
    await kv.set('luggage', data);
  } else {
    Object.assign(memStore, data);
  }
}

export async function GET() {
  const data = await readAll();
  return NextResponse.json(data);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== 'string' || typeof body.count !== 'number') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }

  const data = await readAll();
  data[body.id] = Math.max(0, Math.floor(body.count));
  await writeAll(data);

  return NextResponse.json({ ok: true });
}
