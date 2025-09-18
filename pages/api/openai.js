import fs from "fs";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Only POST requests allowed" });
  }

  try {
    const { message } = req.body;
    const prompt = fs.readFileSync("./config/prompt_kiosko.txt", "utf8");

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