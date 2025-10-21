'use client';

import { useRef, useState } from 'react';

type Intent = {
  mood?: string; tempo?: number; key?: string;
  instruments?: string[]; energy?: string; persona?: string;
  structureHint?: string; prompt?: string;
};

export default function Page(){
  const [recording, setRecording] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [intent, setIntent] = useState<Intent | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording(){
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mr = new MediaRecorder(stream);
    chunksRef.current = [];
    mr.ondataavailable = (e) => chunksRef.current.push(e.data);
    mr.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await handleAudio(blob);
    };
    mediaRecorderRef.current = mr;
    mr.start();
    setRecording(true);
  }
  function stopRecording(){ mediaRecorderRef.current?.stop(); setRecording(false); }

  async function handleAudio(blob: Blob){
    setLoading(true);
    try{
      const form = new FormData();
      form.append('file', blob, 'speech.webm');
      const tRes = await fetch('/api/transcribe', { method:'POST', body: form });
      const tJson = await tRes.json();
      setTranscript(tJson.text || '');

      const iRes = await fetch('/api/intent', {
        method:'POST', headers:{ 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: tJson.text, persona: 'Lyra' })
      });
      const iJson = await iRes.json();
      setIntent(iJson.intent);

      const gRes = await fetch('/api/generate', {
        method:'POST', headers:{ 'Content-Type': 'application/json' },
        body: JSON.stringify({ intent: iJson.intent, seconds: 12 })
      });
      const gJson = await gRes.json();
      setAudioUrl(gJson.audioUrl || null);
    } finally { setLoading(false); }
  }

  return (
    <main style={{ padding:'24px', maxWidth:920, margin:'0 auto' }}>
      <header style={{ position:'sticky', top:0, background:'white', padding:'12px 0', borderBottom:'1px solid #eee', marginBottom:18 }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <span style={{ width:12, height:12, borderRadius:999, background:'radial-gradient(circle at 30% 30%, #FFF5D6, #E6E1FF)' }} />
          <strong>MuseTalk Web MVP</strong>
        </div>
      </header>

      <section style={{ display:'grid', gridTemplateColumns:'1.1fr .9fr', gap:28, alignItems:'center' }}>
        <div>
          <h1 style={{ margin:'0 0 8px', fontSize:36, lineHeight:1.1 }}>Turn words into music.</h1>
          <p style={{ margin:'0 0 16px', color:'#555' }}>Press record, describe a vibe. We transcribe, parse intent, and generate a short loop.</p>
          <div style={{ display:'flex', gap:12 }}>
            {!recording ? (
              <button onClick={startRecording} style={btnStyle}>● Record</button>
            ) : (
              <button onClick={stopRecording} style={{...btnStyle, borderColor:'#f00', color:'#f00'}}>■ Stop</button>
            )}
            <button onClick={()=>window.location.reload()} style={ghostBtn}>Reset</button>
          </div>
        </div>
        <div>
          <div style={{ border:'1px solid #eee', borderRadius:12, padding:16 }}>
            <h3 style={{ marginTop:0 }}>Preview</h3>
            <div><strong>Transcript:</strong> {transcript || <em>—</em>}</div>
            <div style={{ marginTop:8 }}><strong>Intent JSON:</strong>
              <pre style={{ background:'#fafafa', padding:12, borderRadius:8, overflow:'auto' }}>{JSON.stringify(intent, null, 2) || '—'}</pre>
            </div>
            <div style={{ marginTop:8 }}>
              <strong>Audio:</strong>
              <div style={{ marginTop:8 }}>
                {audioUrl ? <audio controls src={audioUrl} /> : (loading ? 'Generating…' : <em>—</em>)}
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

const btnStyle: React.CSSProperties = { padding:'10px 14px', borderRadius:12, border:'1px solid #111', background:'#fff', cursor:'pointer', fontWeight:600 };
const ghostBtn: React.CSSProperties = { padding:'10px 14px', borderRadius:12, border:'1px solid #e5e5e5', background:'#fff', cursor:'pointer' };
