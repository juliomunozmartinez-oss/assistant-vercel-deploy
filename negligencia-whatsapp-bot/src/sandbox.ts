import { createHash, timingSafeEqual } from "node:crypto";
import { responder } from "./agent.js";
import { calificar, type Caso } from "./scoring.js";
import { PAGINA } from "./sandbox-pagina.generado.js";
import { MemoriaStore, type Historial } from "./store.js";
import type { Mensajero } from "./whatsapp.js";

// Sandbox de pruebas: el agente real (mismo prompt, herramientas y calificación) pero sin
// WhatsApp ni Redis. El navegador guarda el historial y el caso y los manda en cada mensaje,
// así que no se mezcla con los casos reales. Se activa solo si existe SANDBOX_CLAVE.
// La página es la misma del simulador de claude.ai (demo/), compilada en modo "servidor".

const TELEFONO_PRUEBA = "5210000000000";

interface PeticionSandbox {
  textos: string[];
  historial?: Historial;
  caso?: Caso | null;
  nombrePerfil?: string;
  fecha?: string; // AAAA-MM-DD para simular otro día
}

export async function manejarSandbox(request: Request): Promise<Response> {
  const clave = process.env.SANDBOX_CLAVE;
  if (!clave) return new Response("Sandbox desactivado: define SANDBOX_CLAVE.", { status: 404 });

  if (request.method === "GET") {
    return new Response(PAGINA, {
      headers: { "Content-Type": "text/html; charset=utf-8", "X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store" },
    });
  }
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
  if (!claveValida(request.headers.get("x-sandbox-clave"), clave)) {
    return Response.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  let p: PeticionSandbox;
  try {
    p = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const textos = (p.textos ?? []).map(String).filter((t) => t.trim()).slice(0, 10);
  if (textos.length === 0) return Response.json({ error: "Mensaje vacío" }, { status: 400 });

  const hoy = p.fecha && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? new Date(`${p.fecha}T18:00:00Z`) : new Date();
  const store = new MemoriaStore();
  if (p.historial?.length) await store.guardarHistorial(TELEFONO_PRUEBA, p.historial);
  if (p.caso) await store.guardarCaso({ ...p.caso, telefono: TELEFONO_PRUEBA });

  const avisos: string[] = [];
  const mensajero: Mensajero = {
    async enviarTexto() {},
    async marcarLeido() {},
    async avisarAbogados(resumen) { avisos.push(resumen); },
  };

  const inicio = Date.now();
  try {
    const respuesta = await responder(TELEFONO_PRUEBA, textos, {
      store, mensajero, nombrePerfil: p.nombrePerfil || undefined, hoy,
    });
    const caso = await store.leerCaso(TELEFONO_PRUEBA);
    return Response.json({
      respuesta,
      historial: await store.leerHistorial(TELEFONO_PRUEBA),
      caso,
      calificacion: caso ? calificar(caso, hoy) : null,
      avisos,
      ms: Date.now() - inicio,
    });
  } catch (e) {
    console.error("Sandbox:", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

function claveValida(recibida: string | null, esperada: string): boolean {
  const h = (t: string) => createHash("sha256").update(t).digest();
  return recibida !== null && timingSafeEqual(h(recibida), h(esperada));
}
