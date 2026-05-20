import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

const DEFAULT: Record<string, number> = {
  milan: 0, eindhoven: 0, barcelona: 0, zanzibar: 0,
};

const memStore: Record<string, number> = { ...DEFAULT };

function getRedis(): Redis | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

async function readAll(): Promise<Record<string, number>> {
  const redis = getRedis();
  if (!redis) return { ...memStore };
  return (await redis.get<Record<string, number>>('luggage')) ?? { ...DEFAULT };
}

async function writeAll(data: Record<string, number>): Promise<void> {
  const redis = getRedis();
  if (!redis) { Object.assign(memStore, data); return; }
  await redis.set('luggage', data);
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
