import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) return NextResponse.json({ error: 'no file received' }, { status: 400 });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

    const data = new FormData();
    data.append('file', file);
    data.append('model', 'whisper-1');
    data.append('response_format', 'json');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: data as any
    });

    const json = await res.json();
    return NextResponse.json({ debug: json, text: json.text || '', status: res.status });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}
