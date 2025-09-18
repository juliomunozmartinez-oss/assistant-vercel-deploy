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
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: "250px",
          background: "#001F5B",
          color: "white",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <div>
          <h2 style={{ color: "#fff" }}>📱 MuGa Mobiles</h2>
          <ul style={{ listStyle: "none", padding: 0 }}>
            <li>🏠 Inicio</li>
            <li>📦 Planes Telcel</li>
            <li>📊 Renovaciones</li>
            <li>🌐 Internet en Casa</li>
          </ul>
        </div>
        <div>
          <p style={{ fontSize: "12px", color: "#ddd" }}>
            © 2025 MuGa Holdings de México
          </p>
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, padding: "2rem" }}>
        <h1>🤖 Asesor Telcel – MuGa</h1>

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
    </div>
  );
}
