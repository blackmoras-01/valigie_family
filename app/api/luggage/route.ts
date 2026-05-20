import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface CityCount { small: number; large: number }
type LuggageData = Record<string, CityCount>;

const DEFAULT: LuggageData = {
  milan:     { small: 0, large: 0 },
  eindhoven: { small: 0, large: 0 },
  barcelona: { small: 0, large: 0 },
  zanzibar:  { small: 0, large: 0 },
};

const memStore: LuggageData = JSON.parse(JSON.stringify(DEFAULT));

function normalize(raw: unknown): LuggageData {
  const result: LuggageData = JSON.parse(JSON.stringify(DEFAULT));
  if (typeof raw !== 'object' || raw === null) return result;
  for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
    if (!(key in result)) continue;
    if (typeof val === 'number') {
      // migrate old flat format
      result[key] = { small: val, large: 0 };
    } else if (typeof val === 'object' && val !== null) {
      const v = val as Record<string, unknown>;
      result[key] = {
        small: Math.max(0, Number(v.small) || 0),
        large: Math.max(0, Number(v.large) || 0),
      };
    }
  }
  return result;
}

function getRedis(): Redis | null {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    return new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return null;
}

async function readAll(): Promise<LuggageData> {
  const redis = getRedis();
  if (!redis) return { ...memStore };
  const raw = await redis.get('luggage');
  return normalize(raw);
}

async function writeAll(data: LuggageData): Promise<void> {
  const redis = getRedis();
  if (!redis) { Object.assign(memStore, data); return; }
  await redis.set('luggage', data);
}

export async function GET() {
  return NextResponse.json(await readAll());
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body.id !== 'string') {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  }
  const data = await readAll();
  data[body.id] = {
    small: Math.max(0, Math.floor(Number(body.small) || 0)),
    large: Math.max(0, Math.floor(Number(body.large) || 0)),
  };
  await writeAll(data);
  return NextResponse.json({ ok: true });
}
