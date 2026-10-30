import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import type { AddressInfo } from "node:net";
import { MemoriaStore } from "../src/store.js";
import type { Mensajero } from "../src/whatsapp.js";

// API de Claude simulada: primero pide guardar el caso y avisar al abogado en paralelo,
// luego contesta con texto.
let servidor: Server;
const peticiones: any[] = [];

before(async () => {
  servidor = createServer(async (req, res) => {
    let b = "";
    for await (const c of req) b += c;
    const body = JSON.parse(b);
    peticiones.push(body);
    const ultimo = body.messages.at(-1);
    const conResultados = Array.isArray(ultimo.content) && ultimo.content[0]?.type === "tool_result";
    const content = conResultados
      ? [{ type: "text", text: "Un abogado le contactará." }]
      : [
          { type: "tool_use", id: "t1", name: "guardar_datos_caso", input: {
            consentimiento_privacidad: true, nombre: "Ana", relacion: null, ciudad_estado: null, nicho: "cirugia_estetica",
            procedimiento: "liposucción", institucion: "clinica_estetica", nombre_lugar: null, medico: null,
            fecha_hechos: "2026-09", fecha_conocimiento_dano: null, gravedad: "dano_grave_temporal", descripcion: null,
            estado_actual: null, tiene_expediente: null, documentos: null, quejas_previas: null, monto_pagado_mxn: null,
            ofrecen_convenio: null } },
          { type: "tool_use", id: "t2", name: "solicitar_abogado", input: { motivo: "pide cita", urgencia: "normal", mejor_horario: null } },
        ];
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({
      id: "m", type: "message", role: "assistant", model: body.model, content,
      stop_reason: conResultados ? "end_turn" : "tool_use", stop_sequence: null, usage: { input_tokens: 1, output_tokens: 1 },
    }));
  });
  await new Promise<void>((r) => servidor.listen(0, r));
  process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  process.env.ANTHROPIC_API_KEY = "prueba";
});
after(() => servidor.close());

test("las herramientas se ejecutan en orden y el aviso lleva los datos recién guardados", async () => {
  const { responder } = await import("../src/agent.js"); // después de apuntar al servidor simulado
  const avisos: string[] = [];
  const mensajero: Mensajero = { async enviarTexto() {}, async marcarLeido() {}, async avisarAbogados(r) { avisos.push(r); } };
  const store = new MemoriaStore();

  const texto = await responder("521444", ["hola"], { store, mensajero, hoy: new Date("2026-10-30T12:00:00Z") });

  assert.equal(texto, "Un abogado le contactará.");
  assert.match(avisos[0], /Procedimiento: liposucción/);
  const caso = await store.leerCaso("521444");
  assert.equal(caso?.procedimiento, "liposucción");
  assert.ok(caso?.escalado);

  // Historial completo y solo agregado: usuario, asistente (tool_use), resultados, asistente (texto).
  const h = await store.leerHistorial("521444");
  assert.deepEqual(h.map((m) => m.role), ["user", "assistant", "user", "assistant"]);
  assert.match(String(h[0].content), /^\[Fecha de hoy: .*2026-10-30/);
  // El prompt de sistema va con caché y la petición pide fallback del servidor.
  assert.equal(peticiones[0].system[0].cache_control.type, "ephemeral");
  assert.equal(peticiones[0].fallbacks, "default");
});
