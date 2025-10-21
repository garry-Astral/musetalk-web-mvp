import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

// Simple GET so the endpoint shows a message if opened in the browser
export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST { intent, seconds } JSON to generate audio.' });
}

export async function POST(req: NextRequest) {
  try {
    const { intent, seconds = 12 } = await req.json();

    const token = process.env.REPLICATE_API_TOKEN;
    const model = process.env.MUSIC_MODEL || 'meta/musicgen-small';
    if (!token) {
      return NextResponse.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });
    }

    // Kick off prediction
    const predictionRes = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        version: model, // if Replicate requires a full version hash, set MUSIC_MODEL env to that hash
        input: {
          prompt: intent?.prompt || 'ambient electronic, soft pads, gentle beat',
          duration: seconds
        }
      })
    });

    // If the model id is wrong, Replicate often returns 400 with a message
    if (!predictionRes.ok) {
      const err = await predictionRes.text();
      return NextResponse.json({ error: 'replicate_start_failed', detail: err }, { status: predictionRes.status });
    }

    const prediction = await predictionRes.json();
    let outputUrl: string | null = null;
    const url = prediction.urls?.get;
    const started = Date.now();

    // Poll until finished (up to ~60s)
    while (!outputUrl && (Date.now() - started) < 60000) {
      await new Promise(r => setTimeout(r, 1500));
      const check = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
      const pjson = await check.json();
      if (pjson.status === 'succeeded') {
        outputUrl = Array.isArray(pjson.output) ? pjson.output[0] : pjson.output;
      } else if (pjson.status === 'failed' || pjson.status === 'canceled') {
        return NextResponse.json({ error: 'replicate_failed', detail: pjson }, { status: 500 });
      }
    }

    if (!outputUrl) {
      return NextResponse.json({ error: 'Generation timed out' }, { status: 504 });
    }

    return NextResponse.json({ audioUrl: outputUrl });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'unexpected_error' }, { status: 500 });
  }
}
