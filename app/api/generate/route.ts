import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { intent, seconds = 12 } = await req.json();
  const token = process.env.REPLICATE_API_TOKEN;
  const model = process.env.MUSIC_MODEL || 'meta/musicgen-small';
  if (!token) return NextResponse.json({ error: 'Missing REPLICATE_API_TOKEN' }, { status: 500 });

  const predictionRes = await fetch('https://api.replicate.com/v1/predictions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify({
      version: model, // replace with a full version hash if Replicate requires it
      input: { prompt: intent?.prompt || 'ambient electronic, soft pads, gentle beat', duration: seconds }
    })
  });

  const prediction = await predictionRes.json();
  let outputUrl: string | null = null;
  let url = prediction.urls?.get;
  const started = Date.now();

  while (!outputUrl && (Date.now() - started) < 60000) {
    await new Promise(r => setTimeout(r, 1500));
    const check = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` }});
    const pjson = await check.json();
    if (pjson.status === 'succeeded') {
      outputUrl = Array.isArray(pjson.output) ? pjson.output[0] : pjson.output;
    } else if (pjson.status === 'failed' || pjson.status === 'canceled') {
      break;
    }
  }

  if (!outputUrl) return NextResponse.json({ error: 'Generation timed out' }, { status: 504 });
  return NextResponse.json({ audioUrl: outputUrl });
}
