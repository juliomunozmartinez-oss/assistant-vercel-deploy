import { useState } from "react";

export default function Home() {
  const [input, setInput] = useState("");
  const [response, setResponse] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/openai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });
    const data = await res.json();
    setResponse(data.text);
  };

  return (
    <div className="container">
      <h1>Kiosko MuGa Mobiles</h1>
      <form onSubmit={handleSubmit}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe el modelo y plan que buscas..."
        />
        <button type="submit">Consultar</button>
      </form>
      {response && (
        <div className="box">
          <pre>{response}</pre>
        </div>
      )}
    </div>
  );
}