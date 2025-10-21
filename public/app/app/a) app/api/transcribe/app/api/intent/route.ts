import { NextRequest, NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req: NextRequest) {
  const { text, persona } = await req.json();
  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) return NextResponse.json({ error: 'Missing OPENAI_API_KEY' }, { status: 500 });

  const system = `You are a music intent parser. Given a user phrase, extract a JSON with: mood, tempo (BPM), key, instruments (array), energy (low/medium/high), persona, structureHint, and prompt (concise model-ready text). Output ONLY JSON.`;
  const user = `Phrase: "${text}". Persona: ${persona || 'Lyra'}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ]
    })
  });

  const json = await res.json();
  let parsed: any = {};
  try { parsed = JSON.parse(json.choices?.[0]?.message?.content || '{}'); }
  catch(e){ parsed = { prompt: text }; }

  return NextResponse.json({ intent: parsed });
}
