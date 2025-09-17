import { OpenAI } from "openai";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: "No messages provided" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = process.env.ASSISTANT_ID;
  if (!apiKey || !assistantId) {
    return res
      .status(500)
      .json({ error: "API key or assistant ID not configured" });
  }

  const openai = new OpenAI({ apiKey });

  try {
    const thread = await openai.beta.threads.create();
    const last = messages[messages.length - 1];

    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: last.content,
    });

    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });

    let runStatus;
    do {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === "completed") break;
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } while (true);

    const messagesRes = await openai.beta.threads.messages.list(thread.id);
    const assistantMessage = messagesRes.data.find((m) => m.role === "assistant");

    let reply = "";
    if (assistantMessage) {
      reply = assistantMessage.content
        .map((part) => {
          if (typeof part === "string") return part;
          if (part && part.text) {
            if (typeof part.text === "string") return part.text;
            return part.text.value ?? "";
          }
          return "";
        })
        .join("\n");
    }

    // 🔎 Filtrar solo la parte del cliente (después de 'Copy WhatsApp (cliente):')
    const clientIndex = reply.indexOf("Copy WhatsApp (cliente):");
    if (clientIndex !== -1) {
      reply = reply.substring(clientIndex).replace("Copy WhatsApp (cliente):", "").trim();
    }

    // 🚀 Post-procesamiento: saltos de línea + emojis
    reply = reply.replace(/ - /g, "\n");
    reply = reply
      .replace(/\*\*Equipo:\*\*/g, "📱 **Equipo:**")
      .replace(/\*\*Pago mensual.*\*\*/g, "💳 $&")
      .replace(/\*\*Plan:\*\*/g, "📝 **Plan:**")
      .replace(/\*\*Renta mensual:\*\*/g, "🏠 **Renta mensual:**")
      .replace(/\*\*Total mensual:\*\*/g, "💰 **Total mensual:**")
      .replace(/\*\*GB:\*\*/g, "📊 **GB:**")
      .replace(/\*\*Minutos\/SMS:\*\*/g, "📞 **Minutos/SMS:**")
      .replace(/\*\*Redes sociales ilimitadas:\*\*/g, "🌐 **Redes sociales ilimitadas:**")
      .replace(/\*\*Cashback:\*\*/g, "🎁 **Cashback:**")
      .replace(/\*\*Inventario:\*\*/g, "📦 **Inventario:**")
      .replace(/\*\*Promoción:\*\*/g, "🎉 **Promoción:**");

    res.status(200).json({ reply });
  } catch (err) {
    console.error("Assistant API error", err);
    res.status(500).json({ error: "Error contacting assistant API" });
  }
}
