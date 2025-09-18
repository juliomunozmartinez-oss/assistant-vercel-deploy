import { useState } from "react";
import Image from "next/image";
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
    setResponse(data.text);
    setLoading(false);
  };

  // Separar respuesta en bloques (por marcador **Copy WhatsApp (cliente):**)
  const [internalBlock, clientBlock] = response.split("**Copy WhatsApp (cliente):**");

  // Función de limpieza: elimina referencias tipo [4:1†archivo†] y [archivo.txt]
  const cleanText = (text) => {
    if (!text) return "";
    return text
      .replace(/\[\d+:\d+†.*?†\]/g, "") // quita referencias con †
      .replace(/\[.*?\.txt\]/g, "")       // quita archivos .txt
      .replace(/\n/g, "<br/>");             // convierte saltos de línea
  };

  return (
    <div className="container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-top">
          <Image src="/muga.png" alt="MuGa Mobiles" width={180} height={60} />
          <nav>
            <ul>
              <li>🏠 Inicio</li>
              <li>📦 Planes Telcel</li>
              <li>📊 Renovaciones</li>
              <li>🌐 Internet en Casa</li>
            </ul>
          </nav>
        </div>
        <div className="sidebar-bottom">
          <Image src="/telcel5g.png" alt="Telcel 5G" width={100} height={40} />
          <p>© 2025 MuGa Holdings de México</p>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main">
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

        {/* Tarjetas de respuesta */}
        <div className="cards-container">
          {internalBlock && (
            <div className="card">
              <div className="card-header">📋 Respuesta interna (vendedor)</div>
              <div
                className="card-body"
                dangerouslySetInnerHTML={{ __html: cleanText(internalBlock) }}
              />
            </div>
          )}

          {clientBlock && (
            <div className="card">
              <div className="card-header">📲 Copy WhatsApp (cliente)</div>
              <div
                className="card-body"
                dangerouslySetInnerHTML={{ __html: cleanText(clientBlock) }}
              />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}