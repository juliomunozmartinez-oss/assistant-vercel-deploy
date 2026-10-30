import { waitUntil } from "@vercel/functions";
import { config } from "../src/config.js";
import { procesarMensaje } from "../src/procesar.js";
import { RedisStore } from "../src/store.js";
import { extraerMensajes, firmaValida, WhatsAppCloud } from "../src/whatsapp.js";

const store = new RedisStore();
const mensajero = new WhatsAppCloud();

// Verificación del webhook al configurarlo en Meta (Configuración de WhatsApp → Webhook).
export function GET(request: Request): Response {
  const url = new URL(request.url);
  if (
    url.searchParams.get("hub.mode") === "subscribe" &&
    url.searchParams.get("hub.verify_token") === config.waVerifyToken
  ) {
    return new Response(url.searchParams.get("hub.challenge") ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

export async function POST(request: Request): Promise<Response> {
  const cuerpo = await request.text();
  if (!firmaValida(cuerpo, request.headers.get("x-hub-signature-256"), config.waAppSecret)) {
    return new Response("Firma inválida", { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(cuerpo);
  } catch {
    return new Response("JSON inválido", { status: 400 });
  }

  // Meta espera un 200 rápido; la respuesta de Claude se genera después de contestar.
  const trabajos = extraerMensajes(payload).map((m) =>
    procesarMensaje(m, store, mensajero).catch((e) => console.error(`Error procesando ${m.id}:`, e)),
  );
  waitUntil(Promise.all(trabajos));
  return new Response("OK", { status: 200 });
}
