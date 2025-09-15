import { OpenAI } from 'openai';

/**
 * API route for interacting with the MuGa Mobiles assistant via the OpenAI API.
 *
 * This handler accepts POST requests containing the full conversation history
 * (array of messages with roles `user` and `assistant`) and forwards the
 * latest user message to the assistant.  It creates a temporary thread,
 * adds the user's message, runs the assistant, waits for completion and
 * returns the assistant's reply.  Environment variables OPENAI_API_KEY and
 * ASSISTANT_ID must be set in Vercel to authorize the API requests.
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'No messages provided' });
  }
  const apiKey = process.env.OPENAI_API_KEY;
  const assistantId = process.env.ASSISTANT_ID;
  if (!apiKey || !assistantId) {
    return res.status(500).json({ error: 'API key or assistant ID not configured' });
  }
  const openai = new OpenAI({ apiKey });
  try {
    // Create a new thread for each interaction.  Persisting a thread across
    // requests would allow context preservation, but requires additional
    // storage.
    const thread = await openai.beta.threads.create();
    // Add only the latest user message to the thread.  The assistant
    // automatically applies the system instructions configured on the
    // assistant.  If you want to include previous context you could also
    // iterate over messages here.
    const last = messages[messages.length - 1];
    await openai.beta.threads.messages.create(thread.id, {
      role: 'user',
      content: last.content,
    });
    // Run the assistant on the thread.
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: assistantId,
    });
    // Poll until the run is finished.
    let runStatus;
    do {
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === 'completed') break;
      // Wait a bit before polling again.
      await new Promise((resolve) => setTimeout(resolve, 2000));
    } while (true);
    // Get the assistant's response message.
    const messagesRes = await openai.beta.threads.messages.list(thread.id);
    // The last message from the assistant is the reply we want.
    const assistantMessage = messagesRes.data.find((m) => m.role === 'assistant');
    let reply = '';
    if (assistantMessage) {
      // Each message may contain multiple content parts (e.g. text, images).
      reply = assistantMessage.content
        .map((part) => (typeof part === 'string' ? part : part.text))
        .join('\n');
    }
    res.status(200).json({ reply });
  } catch (err) {
    console.error('Assistant API error', err);
    res.status(500).json({ error: 'Error contacting assistant API' });
  }
}
