import assert from "node:assert/strict";
import { test } from "node:test";
import { MemoriaStore } from "../src/store.js";
import { ejecutarTool } from "../src/tools.js";
import type { Mensajero } from "../src/whatsapp.js";

const avisos: string[] = [];
const mensajero: Mensajero = {
  async enviarTexto() {}, async marcarLeido() {},
  async avisarAbogados(r) { avisos.push(r); },
};
const nulos = (extra: Record<string, unknown>) => ({
  consentimiento_privacidad: null, nombre: null, relacion: null, ciudad_estado: null, nicho: null,
  procedimiento: null, institucion: null, nombre_lugar: null, medico: null, fecha_hechos: null,
  fecha_conocimiento_dano: null, gravedad: null, descripcion: null, estado_actual: null,
  tiene_expediente: null, documentos: null, quejas_previas: null, monto_pagado_mxn: null,
  ofrecen_convenio: null, ...extra,
});

test("no guarda datos de salud sin consentimiento y luego sí", async () => {
  const store = new MemoriaStore();
  const ctx = { telefono: "521444", store, mensajero, hoy: new Date("2026-10-30") };
  const uso = (input: object) => ({ type: "tool_use" as const, id: "t", name: "guardar_datos_caso", input, caller: undefined as any });

  const r1 = await ejecutarTool(uso(nulos({ gravedad: "muerte" })), ctx);
  assert.equal(r1.is_error, true);
  assert.equal(await store.leerCaso("521444"), null);

  await ejecutarTool(uso(nulos({ consentimiento_privacidad: true, documentos: ["acta"] })), ctx);
  const r2 = await ejecutarTool(uso(nulos({ gravedad: "muerte", documentos: ["acta", "expediente"] })), ctx);
  assert.equal(r2.is_error, false);
  const caso = await store.leerCaso("521444");
  assert.equal(caso?.gravedad, "muerte");
  assert.deepEqual(caso?.documentos, ["acta", "expediente"]);

  const r3 = await ejecutarTool({ type: "tool_use", id: "t2", name: "solicitar_abogado", input: { motivo: "pide cita", urgencia: "alta", mejor_horario: null }, caller: undefined as any }, ctx);
  assert.equal(r3.is_error, false);
  assert.match(avisos[0], /URGENTE – Motivo: pide cita/);
  assert.ok((await store.leerCaso("521444"))?.escalado);
});
