import { useState } from "react";

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

  return (
    <div style={{ padding: "2rem", fontFamily: "sans-serif" }}>
      <h1>🤖 Asistente Telcel</h1>
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: "10px" }}
        placeholder="Ejemplo: precio galaxy a06 en libre 2"
      />
      <button onClick={sendPrompt} style={{ marginTop: "10px" }}>
        {loading ? "Generando..." : "Enviar"}
      </button>

      <div
        style={{
          whiteSpace: "pre-wrap",
          marginTop: "20px",
          background: "#f4f4f4",
          padding: "15px",
          borderRadius: "8px",
        }}
      >
        {response}
      </div>
    </div>
  );
}
