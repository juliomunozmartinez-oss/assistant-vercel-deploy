import { useState } from "react";
import "../styles/globals.css";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);

  const sendPrompt = async () => {
    setLoading(true);
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt }),
    });

    const data = await res.json();
    setResponse(data.text || "");
    setLoading(false);
  };

  // Dividir en dos bloques con regex flexible
  const parts = response.split(/Copy WhatsApp \(cliente\):/i);
  const internalBlock = parts[0] || "";
  const clientBlock = parts[1] || "";

  const toHtml = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\n/g, "<br/>");
  };

  const copyToClipboard = () => {
    if (clientBlock) {
      navigator.clipboard.writeText(clientBlock.trim());
      alert("✅ Copiado al portapapeles");
    }
  };

  return (
    <div className="container">
      <h1>🤖 Asesor Telcel – MuGa</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        placeholder="Ejemplo: precio galaxy a06 en libre 2"
      />
      <button onClick={sendPrompt}>
        {loading ? "Generando..." : "Enviar"}
      </button>

      {/* Bloque interno */}
      {internalBlock && (
        <div className="response-box">
          <h2>📋 Respuesta interna (vendedor)</h2>
          <div dangerouslySetInnerHTML={{ __html: toHtml(internalBlock) }} />
        </div>
      )}

      {/* Bloque cliente con botón de copiar */}
      {clientBlock && (
        <div className="response-box">
          <h2>📲 Copy WhatsApp (cliente)</h2>
          <div dangerouslySetInnerHTML={{ __html: toHtml(clientBlock) }} />
          <button className="copy-btn" onClick={copyToClipboard}>
            📋 Copiar al portapapeles
          </button>
        </div>
      )}
    </div>
  );
}