import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// Health check in browser
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST { intent, seconds } JSON to generate audio.' });
}

// Some setups send a preflight; accept it so we never 405.
export async function OPTIONS() {
  return new NextResponse(null, { status: 200 });
}

export async function POST(req: NextRequest) {
  try {
    const { intent, seconds = 12 } = await req.json();

    const token = process.env.REPLICATE_API_TOKEN;
    const model = process.env.MUSIC_MODEL || 'meta/musicgen-small';
    if (!token) {
      return NextResponse.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }

    // Start prediction
    const start = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        version: model, // set MUSIC_MODEL env to full version hash for reliability
        input: {
          prompt: intent?.prompt || 'ambient electronic, soft pads, gentle beat',
          duration: seconds
        }
      })
    });

    if (!start.ok) {
      const detail = await start.text();
      return NextResponse.json({ error: 'replicate_start_failed', detail }, { status: start.status });
    }

    const pred = await start.json();
    const pollUrl = pred?.urls?.get;
    const t0 = Date.now();
    let audioUrl: string | null = null;

    // Poll up to ~60s
    while (!audioUrl && Date.now() - t0 < 60000) {
      await new Promise(r => setTimeout(r, 1500));
      const c = await fetch(pollUrl, { headers: { Authorization: `Bearer ${token}` } });
      const j = await c.json();
      if (j.status === 'succeeded') {
        audioUrl = Array.isArray(j.output) ? j.output[0] : j.output;
      } else if (j.status === 'failed' || j.status === 'canceled') {
        return NextResponse.json({ error: 'replicate_failed', detail: j }, { status: 500 });
      }
    }

    if (!audioUrl) return NextResponse.json({ error: 'Generation timed out' }, { status: 504 });
    return NextResponse.json({ audioUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}
