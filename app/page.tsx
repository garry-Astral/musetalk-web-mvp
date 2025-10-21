'use client';
import { useState, useRef } from 'react';

export default function Home() {
  const [transcript, setTranscript] = useState('');
  const [intentJson, setIntentJson] = useState<any>(null);
  const [audioUrl, setAudioUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // 🎙 Start/stop recording audio
  const handleRecord = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      return;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mediaRecorder = new MediaRecorder(stream);
    mediaRecorderRef.current = mediaRecorder;

    chunksRef.current = [];
    mediaRecorder.ondataavailable = (event) => chunksRef.current.push(event.data);

    mediaRecorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
      await handleUpload(blob);
    };

    mediaRecorder.start();
  };

  // 🧠 Send audio to /api/transcribe
  const handleUpload = async (blob: Blob) => {
    setLoading(true);
    setTranscript('');
    setIntentJson(null);
    setAudioUrl('');

    const formData = new FormData();
    formData.append('file', blob, 'audio.webm');

    const tRes = await fetch('/api/transcribe', {
      method: 'POST',
      body: formData
    });

    const tData = await tRes.json();
    console.log('Transcribe response:', tData);
    const text = tData.text || '';
    setTranscript(text);

    // 🧩 Send transcript to intent parser
    const iRes = await fetch('/api/intent', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });

    const iData = await iRes.json();
    console.log('Intent response:', iData);
    setIntentJson(iData);

    // 🎵 Generate music
    const gRes = await fetch('/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: iData, seconds: 12 })
    });

    const gData = await gRes.json();
    console.log('Generate response:', gData);
    if (gData.audioUrl) setAudioUrl(gData.audioUrl);

    setLoading(false);
  };

  return (
    <main style={{
      fontFamily: 'system-ui, sans-serif',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      padding: '2rem'
    }}>
      <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>MuseTalk</h1>
      <p style={{ marginBottom: '1rem', fontSize: '1.1rem' }}>
        Describe a vibe, and we’ll turn it into sound.
      </p>

      <button
        onClick={handleRecord}
        disabled={loading}
        style={{
          border: '2px solid black',
          background: loading ? '#ccc' : 'white',
          padding: '0.5rem 1rem',
          borderRadius: '8px',
          cursor: 'pointer'
        }}
      >
        {mediaRecorderRef.current?.state === 'recording' ? 'Stop' : '● Record'}
      </button>

      <div style={{ marginTop: '2rem', width: '100%', maxWidth: '600px' }}>
        <h3>Transcript:</h3>
        <p>{transcript || '—'}</p>

        <h3>Intent JSON:</h3>
        <pre style={{
          background: '#f7f7f7',
          padding: '1rem',
          borderRadius: '8px',
          overflowX: 'auto'
        }}>
          {intentJson ? JSON.stringify(intentJson, null, 2) : '{}'}
        </pre>

        {loading && <p>⏳ Generating...</p>}

        {audioUrl && (
          <div style={{ marginTop: '1rem' }}>
            <audio controls src={audioUrl} />
          </div>
        )}
      </div>
    </main>
  );
}
