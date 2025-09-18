export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  try {
    const { message } = req.body;

    const prompt = `
Eres un asistente Telcel de MuGa Mobiles.
Siempre responde en dos bloques separados por delimitadores.

=== RESPUESTA INTERNA ===
Texto para el vendedor con detalles técnicos, precios y cálculos.

=== COPY WHATSAPP ===
Texto breve y amigable para el cliente, listo para copiar en WhatsApp.
Al final de este bloque SIEMPRE agrega los datos de contacto fijos:

📍 MuGa Mobiles
📲 WhatsApp: 4443226261
👍 Facebook: MuGa Mobiles
📷 Instagram: @mugamobiles
📌 Ubicación: https://bit.ly/34KICuM
    `;

    const completion = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: message },
        ],
      }),
    });

    const data = await completion.json();
    const text = data.choices[0].message.content;

    res.status(200).json({ text });
  } catch (error) {
    res.status(500).json({ message: "Error generating response", error });
  }
}