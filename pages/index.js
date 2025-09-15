import { useState } from 'react';

/**
 * Basic chat interface for the MuGa Mobiles assistant.  This page displays a list
 * of messages exchanged with the assistant and provides an input field for new
 * questions.  Messages are sent to the serverless API route at `/api/chat`,
 * which proxies the request to the OpenAI Assistant API.  The API key and
 * assistant ID should be configured as environment variables on Vercel.
 */
export default function Home() {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte hoy?' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendMessage(e) {
    e.preventDefault();
    const question = input.trim();
    if (!question) return;
    // Optimistically add the user's message to the chat.
    const updated = [...messages, { role: 'user', content: question }];
    setMessages(updated);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updated }),
      });
      const data = await res.json();
      if (data.reply) {
        setMessages([...updated, { role: 'assistant', content: data.reply }]);
      } else if (data.error) {
        setMessages([...updated, { role: 'assistant', content: `Error: ${data.error}` }]);
      }
    } catch (err) {
      setMessages([...updated, { role: 'assistant', content: 'Error al obtener respuesta.' }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '1rem', fontFamily: 'Arial, sans-serif' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>Asesor Telcel – MuGa</h1>
      <div style={{ border: '1px solid #ddd', padding: '1rem', height: '300px', overflowY: 'auto', marginBottom: '1rem', borderRadius: '4px' }}>
        {messages.map((msg, idx) => (
          <div key={idx} style={{ marginBottom: '0.75rem', textAlign: msg.role === 'user' ? 'right' : 'left' }}>
            <strong>{msg.role === 'user' ? 'Tú' : 'Asesor'}:</strong> {msg.content}
          </div>
        ))}
        {loading && <p>Asesor está escribiendo...</p>}
      </div>
      <form onSubmit={sendMessage} style={{ display: 'flex' }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta..."
          style={{ flex: 1, padding: '0.5rem', border: '1px solid #ccc', borderRadius: '4px', marginRight: '0.5rem' }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem', borderRadius: '4px', backgroundColor: '#0070f3', color: '#fff', border: 'none' }}>
          Enviar
        </button>
      </form>
    </div>
  );
}
