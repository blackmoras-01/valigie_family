import { NextRequest, NextResponse } from 'next/server';
import { put, list } from '@vercel/blob';

const BLOB_KEY = 'luggage/counts.json';

const DEFAULT: Record<string, number> = {
  milan: 0, eindhoven: 0, barcelona: 0, zanzibar: 0,
};

// In-memory fallback for local dev (resets on restart, fine for testing)
const memStore: Record<string, number> = { ...DEFAULT };

async function readAll(): Promise<Record<string, number>> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) return { ...memStore };
  try {
    const { blobs } = await list({ prefix: BLOB_KEY });
    if (blobs.length === 0) return { ...DEFAULT };
    const res = await fetch(blobs[0].url, { cache: 'no-store' });
    return await res.json();
  } catch {
    return { ...DEFAULT };
  }
}

async function writeAll(data: Record<string, number>): Promise<void> {
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    Object.assign(memStore, data);
    return;
  }
  await put(BLOB_KEY, JSON.stringify(data), {
    access: 'public',
    addRandomSuffix: false,
  });
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
