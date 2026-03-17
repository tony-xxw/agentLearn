import MultimodalChat from '../MultimodelChat';

export default function Home() {
  return (
    <main style={{ padding: '20px', height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <h1 style={{ marginBottom: '20px' }}>Multimodal Chat Test</h1>
      <div style={{ flex: 1, border: '1px solid #ccc', borderRadius: '8px', overflow: 'hidden' }}>
        <MultimodalChat />
      </div>
    </main>
  );
}
