import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [responseInternal, setResponseInternal] = useState("");
  const [responseWhatsapp, setResponseWhatsapp] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();

    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const text = data.text || "";

    // Dividir por delimitadores
    const parts = text.split("=== COPY WHATSAPP ===");
    const internal = parts[0]?.replace("=== RESPUESTA INTERNA ===", "").trim();
    const whatsapp = parts[1]?.trim();

    setResponseInternal(internal || "⚠️ No se generó la respuesta interna.");
    setResponseWhatsapp(
      whatsapp ||
        "⚠️ No se generó el Copy WhatsApp. Pero recuerda que al final siempre van los datos de contacto de MuGa Mobiles."
    );
  };

  return (
    <div className="container">
      <h1>Asesor Telcel – MuGa</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta..."
        />
        <button type="submit">Enviar</button>
      </form>

      {responseInternal && (
        <div className="box">
          <strong>📋 Respuesta interna (vendedor):</strong>
          <pre>{responseInternal}</pre>
        </div>
      )}

      {responseWhatsapp && (
        <div className="box whatsapp">
          <strong>📲 Copy WhatsApp (cliente):</strong>
          <pre>{responseWhatsapp}</pre>
        </div>
      )}
    </div>
  );
}