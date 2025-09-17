import { useState } from "react";
import Image from "next/image";

export default function Home() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState("");

  const sendMessage = async () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { role: "user", content: input }];
    setMessages(newMessages);
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      const data = await res.json();
      if (data.reply) {
        setMessages([...newMessages, { role: "assistant", content: data.reply }]);
      }
    } catch (err) {
      console.error("Error enviando mensaje:", err);
    }
  };

  if (!authenticated) {
    return (
      <div style={{
        display: "flex", flexDirection: "column", justifyContent: "center",
        alignItems: "center", height: "100vh", fontFamily: '"Inter", sans-serif',
        padding: "20px", textAlign: "center"
      }}>
        <div style={{
          display: "flex", gap: "20px", alignItems: "center", flexWrap: "wrap",
          justifyContent: "center"
        }}>
          <Image src="/logo-muga.jpg" alt="MuGa Mobiles" width={180} height={70} />
          <Image src="/logo-telcel.png" alt="Telcel 5G" width={90} height={45} />
        </div>
        <h2 style={{ marginTop: "20px", fontSize: "clamp(16px, 4vw, 20px)" }}>Ingresa la clave para acceder</h2>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
          placeholder="Clave"
          style={{
            marginTop: "15px", padding: "12px", borderRadius: "8px", border: "1px solid #ccc",
            width: "100%", maxWidth: "300px", fontSize: "clamp(14px, 3vw, 16px)"
          }} />
        <button onClick={() => {
          if (password === "botmuga") setAuthenticated(true);
          else alert("Clave incorrecta 🚫");
        }} style={{
          marginTop: "15px", padding: "12px 20px", borderRadius: "8px", border: "none",
          backgroundColor: "#007BFF", color: "#fff", cursor: "pointer",
          fontSize: "clamp(14px, 3vw, 16px)"
        }}>Entrar</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "700px", width: "100%", margin: "0 auto", padding: "15px",
      fontFamily: '"Inter", sans-serif' }}>
      <div style={{
        display: "flex", justifyContent: "space-between", alignItems: "center",
        marginBottom: "15px", flexWrap: "wrap", gap: "10px"
      }}>
        <Image src="/logo-muga.jpg" alt="MuGa Mobiles" width={140} height={50} />
        <Image src="/logo-telcel.png" alt="Telcel 5G" width={70} height={35} />
      </div>

      <h1 style={{
        fontSize: "clamp(20px, 5vw, 26px)", fontWeight: "700",
        marginBottom: "10px", textAlign: "center"
      }}>Asesor Telcel – MuGa</h1>

      <div style={{
        border: "1px solid #ddd", borderRadius: "12px", padding: "12px", minHeight: "400px",
        marginBottom: "15px", backgroundColor: "#f9fafb", display: "flex", flexDirection: "column"
      }}>
        {messages.map((m, i) => (
          <div key={i} style={{
            alignSelf: m.role === "user" ? "flex-end" : "flex-start",
            backgroundColor: m.role === "user" ? "#d1e7ff" : "#f1f1f1",
            padding: "10px 14px", borderRadius: "18px", marginBottom: "10px",
            maxWidth: "90%", fontSize: "clamp(14px, 3vw, 16px)", lineHeight: "1.4",
            whiteSpace: "pre-line", boxShadow: "0 2px 4px rgba(0,0,0,0.1)"
          }}>
            <strong style={{ display: "block", marginBottom: "6px", fontSize: "13px" }}>
              {m.role === "user" ? "Tú" : "Asesor"}:
            </strong>
            {m.content}
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input value={input} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
          placeholder="Escribe tu pregunta..."
          style={{
            flex: "1 1 auto", padding: "12px", borderRadius: "10px",
            border: "1px solid #ccc", fontSize: "clamp(14px, 3vw, 16px)",
            minWidth: "200px"
          }} />
        <button onClick={sendMessage} style={{
          padding: "12px 18px", backgroundColor: "#007BFF", color: "#fff",
          border: "none", borderRadius: "10px", fontSize: "clamp(14px, 3vw, 16px)",
          cursor: "pointer", flex: "0 0 auto"
        }}>Enviar</button>
      </div>
    </div>
  );
}
