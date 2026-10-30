import assert from "node:assert/strict";
import { test } from "node:test";
import { calificar, mesesDesde, type Caso } from "../src/scoring.js";

const hoy = new Date("2026-10-30T12:00:00Z");
const base = (extra: Partial<Caso>): Caso => ({
  telefono: "5214441234567", creado: "", actualizado: "", ...extra,
});

test("mesesDesde", () => {
  assert.equal(mesesDesde("2026-10", hoy), 0);
  assert.equal(mesesDesde("2025-10-30", hoy), 12);
  assert.equal(mesesDesde("2025-10-31", hoy), 11);
  assert.equal(mesesDesde("ayer", hoy), null);
  assert.equal(mesesDesde("2025-13", hoy), null);
});

test("caso obstétrico grave y reciente con expediente es caliente", () => {
  const c = calificar(base({
    nicho: "obstetrico_perinatal", gravedad: "dano_permanente", fecha_hechos: "2026-05",
    institucion: "imss", tiene_expediente: "si", nombre: "Ana", ciudad_estado: "SLP",
  }), hoy);
  assert.equal(c.prioridad, "caliente");
  assert.equal(c.puntaje, 100);
  assert.deepEqual(c.datos_faltantes, []);
});

test("cirugía estética sin procedimiento pide el dato", () => {
  const c = calificar(base({ nicho: "cirugia_estetica" }), hoy);
  assert.ok(c.datos_faltantes.includes("procedimiento estético realizado"));
  assert.ok(c.datos_faltantes.includes("fecha de los hechos"));
  assert.equal(c.prioridad, "frio");
});

test("alerta de prescripción después de 8 y de 24 meses", () => {
  const cerca = calificar(base({ nicho: "cirugia_estetica", fecha_hechos: "2026-01" }), hoy);
  assert.match(cerca.alertas.join(), /1 año o menos/);
  const vieja = calificar(base({ nicho: "cirugia_estetica", fecha_hechos: "2023-01" }), hoy);
  assert.match(vieja.alertas.join(), /posible prescripción/);
});

test("usa la fecha en que se conoció el daño si existe", () => {
  const c = calificar(base({ fecha_hechos: "2022-01", fecha_conocimiento_dano: "2026-06" }), hoy);
  assert.equal(c.meses_transcurridos, 4);
});

test("convenio ofrecido genera alerta", () => {
  const c = calificar(base({ ofrecen_convenio: true }), hoy);
  assert.match(c.alertas.join(), /convenio/);
});

test("no_aplica", () => {
  assert.equal(calificar(base({ nicho: "no_aplica", gravedad: "muerte" }), hoy).prioridad, "no_aplica");
});
