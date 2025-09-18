import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY, // Se configura en Vercel → Settings → Environment Variables
});

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { prompt } = req.body;

    const completion = await client.chat.completions.create({
      model: "gpt-5",
      messages: [
        {
          role: "system",
          content:
            "Eres un asistente de ventas Telcel. Siempre responde en dos bloques: 'Respuesta interna (vendedor)' y 'Copy WhatsApp (cliente)'.",
        },
        { role: "user", content: prompt },
      ],
    });

    const fullResponse = completion.choices[0].message.content;
    res.status(200).json({ text: fullResponse });
  } catch (error) {
    console.error("Error OpenAI:", error);
    res.status(500).json({ error: "Error al generar respuesta" });
  }
}
