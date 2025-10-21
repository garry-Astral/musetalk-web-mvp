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
      <h1 style={{ fontSize:36, lineHeight:1.1 }}>MuseTalk</h1>
      <p>Describe a vibe, and we’ll turn it into sound.</p>
      <div style={{ display:'flex', gap:12 }}>
        {!recording ? (
          <button onClick={startRecording}>● Record</button>
        ) : (
          <button onClick={stopRecording}>■ Stop</button>
        )}
      </div>
      <div style={{ marginTop:20 }}>
        <strong>Transcript:</strong> {transcript || '—'}
      </div>
      <div style={{ marginTop:10 }}>
        <strong>Intent JSON:</strong>
        <pre>{JSON.stringify(intent, null, 2) || '—'}</pre>
      </div>
      {audioUrl && (
        <div style={{ marginTop:20 }}>
          <strong>Audio:</strong>
          <audio controls src={audioUrl} />
        </div>
      )}
    </main>
  );
}
