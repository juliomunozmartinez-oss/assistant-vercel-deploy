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

  const toHtml = (text) => {
    if (!text) return "";
    return text
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>") // **negritas**
      .replace(/\n/g, "<br/>"); // saltos de línea
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

      <div
        className="response-box"
        dangerouslySetInnerHTML={{ __html: toHtml(response) }}
      />
    </div>
  );
}