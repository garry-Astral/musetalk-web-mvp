import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const incoming = formData.get('file') as File | null;
    if (!incoming) return NextResponse.json({ error: 'no file received' }, { status: 400 });

    // Ensure filename & type are preserved (Edge sometimes drops metadata)
    const file = new File([await incoming.arrayBuffer()], 'speech.webm', { type: incoming.type || 'audio/webm' });

    // Quick sanity debug
    const meta = { sizeBytes: file.size, type: file.type };

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

    const data = new FormData();
    data.append('file', file);
    data.append('model', 'whisper-1');
    data.append('response_format', 'json');
    // (Optional but helps) force language if you know it:
    // data.append('language', 'en');

    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openaiKey}` },
      body: data as any
    });

    const json = await res.json();
    return NextResponse.json({ text: json.text || '', debug: { status: res.status, meta, api: json } });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Unexpected error' }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, hint: 'POST an audio file as FormData with key "file".' });
}
