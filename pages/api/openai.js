export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  const { prompt } = req.body;

  // Prompt maestro fijo
  const masterPrompt = `
Eres un asistente interno de ventas de MuGa Mobiles (Telcel).
Debes responder SIEMPRE en dos secciones claras:

📋 **Respuesta interna (vendedor):**
(Info técnica: plan, costo equipo, renta, total mensual, inventario, upgrade, diferencia, etc.)

---
📲 **Copy WhatsApp (cliente):**
(Mensaje corto, directo, con emojis, invitando al cliente a renovar o contratar.
Debe incluir costo, beneficios, urgencia y datos de contacto de MuGa Mobiles:
WhatsApp: 4443226261 | Facebook: MuGa Mobiles | Instagram: @mugamobiles | Ubicación: https://bit.ly/34KICuM)

Pregunta del vendedor: ${prompt}
`;

  try {
    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: masterPrompt }],
        temperature: 0.7,
      }),
    });

    const data = await completion.json();
    const text = data.choices?.[0]?.message?.content || "Sin respuesta";

    res.status(200).json({ text });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al generar respuesta" });
  }
}