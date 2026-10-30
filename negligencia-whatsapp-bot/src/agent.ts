import Anthropic from "@anthropic-ai/sdk";
import { config } from "./config.js";
import { SYSTEM_PROMPT } from "./prompt.js";
import { calificar, resumenCaso } from "./scoring.js";
import type { Historial, Store } from "./store.js";
import { ejecutarTool, TOOLS, type ContextoTools } from "./tools.js";
import type { Mensajero } from "./whatsapp.js";

const client = new Anthropic();
const MAX_VUELTAS_TOOLS = 6;

const MENSAJE_RESPALDO =
  "Gracias por escribirnos. En este momento no puedo procesar su mensaje, pero ya avisé a un abogado del despacho para que le contacte por este número.";

function fechaHoy(hoy: Date): string {
  return hoy.toLocaleDateString("es-MX", {
    timeZone: "America/Mexico_City", weekday: "long", year: "numeric", month: "long", day: "numeric",
  }) + ` (${hoy.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })})`;
}

/**
 * Procesa uno o más mensajes seguidos de la misma persona y devuelve el texto a responder.
 * El historial solo se extiende (nunca se editan turnos previos) para que los bloques de
 * thinking y la caché de prompts sigan siendo válidos.
 */
export async function responder(
  telefono: string,
  textos: string[],
  deps: { store: Store; mensajero: Mensajero; nombrePerfil?: string; hoy?: Date },
): Promise<string> {
  const hoy = deps.hoy ?? new Date();
  const ctx: ContextoTools = { telefono, nombrePerfil: deps.nombrePerfil, store: deps.store, mensajero: deps.mensajero, hoy };

  let historial = await deps.store.leerHistorial(telefono);
  let encabezado = `[Fecha de hoy: ${fechaHoy(hoy)}]`;

  // Conversación demasiado larga: se empieza una nueva y se le pasa al modelo lo ya registrado.
  if (historial.length > config.maxMensajesConversacion) {
    const caso = await deps.store.leerCaso(telefono);
    historial = [];
    if (caso) {
      encabezado += `\n[Contexto: esta persona ya habló antes con el despacho. Datos registrados del caso:\n${resumenCaso(caso, calificar(caso, hoy))}]`;
    }
  }

  const turno: Historial = [
    ...historial,
    { role: "user", content: `${encabezado}\n${textos.join("\n")}` },
  ];

  for (let vuelta = 0; vuelta < MAX_VUELTAS_TOOLS; vuelta++) {
    const respuesta = await client.beta.messages.create({
      model: config.modelo,
      max_tokens: 16000,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default", // si un clasificador de seguridad rechaza, reintenta en otro modelo
      output_config: { effort: config.esfuerzo },
      cache_control: { type: "ephemeral" }, // cachea el historial hasta el último bloque
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral", ttl: "1h" } }],
      tools: TOOLS,
      messages: turno,
    });

    if (respuesta.stop_reason === "refusal") {
      console.warn(`Rechazo para ${telefono}:`, respuesta.stop_details);
      const caso = (await deps.store.leerCaso(telefono));
      await deps.mensajero.avisarAbogados(
        `Revisar manualmente (el asistente no pudo responder).\nÚltimo mensaje: ${textos.join(" / ").slice(0, 500)}\n` +
        (caso ? resumenCaso(caso, calificar(caso, hoy)) : `Chat: https://wa.me/${telefono}`),
      );
      return MENSAJE_RESPALDO; // el turno rechazado no se guarda
    }

    // Se guarda el contenido completo (incluye bloques de thinking), no solo el texto.
    turno.push({ role: "assistant", content: respuesta.content });

    const usos = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (respuesta.stop_reason !== "tool_use" || usos.length === 0) {
      await deps.store.guardarHistorial(telefono, turno);
      const texto = respuesta.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      return texto || MENSAJE_RESPALDO;
    }

    // En orden, no en paralelo: ambas herramientas leen y escriben el mismo caso, y
    // solicitar_abogado debe ver lo que guardar_datos_caso acaba de guardar.
    // Todas las respuestas van juntas en un solo mensaje de usuario.
    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const u of usos) resultados.push(await ejecutarTool(u, ctx));
    turno.push({ role: "user", content: resultados });
  }

  await deps.store.guardarHistorial(telefono, turno);
  return "Gracias, ya tengo registrada su información. Un abogado del despacho le contactará por este número.";
}
