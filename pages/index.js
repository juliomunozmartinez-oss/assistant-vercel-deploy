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
