
import { useState } from "react";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { role: "user", text: input };
    setMessages([...messages, userMessage]);
    setInput("");

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: input }),
    });

    const data = await res.json();
    const assistantMessage = { role: "assistant", text: data.text };
    setMessages((prev) => [...prev, assistantMessage]);
  };

  return (
    <div>
      <header className="header">
        <img src="/logo muga.jpg" alt="MuGa Mobiles" className="logo-muga" />
        <h1>Asesor Telcel – MuGa</h1>
        <img src="/logo-telcel.png" alt="Telcel 5G" className="logo-telcel" />
      </header>

      <main className="chat-container">
        {messages.map((message, index) => {
          if (
            message.role === "assistant" &&
            message.text.includes("Copy WhatsApp (cliente)")
          ) {
            return (
              <div key={index} className="copy-whatsapp">
                {message.text}
              </div>
            );
          }

          return (
            <div
              key={index}
              className={`message ${message.role === "user" ? "user" : "assistant"}`}
            >
              {message.text}
            </div>
          );
        })}
      </main>

      <form onSubmit={sendMessage}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Escribe tu pregunta..."
        />
        <button type="submit">Enviar</button>
      </form>
    </div>
  );
}
