import fs from "fs";
import path from "path";
import { normalizeName } from "./normalize";
import { RENTA_POR_PLAN, GB_POR_PLAN, planSiguiente, LibrePlan } from "./tables";

export type PrecioRow = {
  EQUIPO_ORIGINAL: string;
  EQUIPO_NORMALIZADO: string;
  PLAN: LibrePlan | string;
  PAGO_EQUIPO: number;
  RENTA_PLAN: number;
  TOTAL_MENSUAL: number;
};

export type InvRow = {
  EQUIPO_ORIGINAL: string;
  EQUIPO_NORMALIZADO: string;
  PLAN: string;
  PIEZAS: number;
};

function loadJSON<T = any>(rel: string): T {
  const p = path.join(process.cwd(), rel);
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw);
}

export function buscarPrecio(modelo: string, plan: LibrePlan) {
  const precios: PrecioRow[] = loadJSON("data/precios_para_asistente_normalizado.json");
  const clave = normalizeName(modelo);
  // fuzzy simple: incluye como substring
  const candidatos = precios.filter(r => r.PLAN === plan && r.EQUIPO_NORMALIZADO.includes(clave));
  if (candidatos.length === 0) return null;
  // elegir el de TOTAL_MENSUAL más bajo por seguridad
  const row = candidatos.sort((a,b)=>a.TOTAL_MENSUAL - b.TOTAL_MENSUAL)[0];
  const rentaOficial = RENTA_POR_PLAN[plan];
  const pago = row.PAGO_EQUIPO ?? 0;
  const total = (pago + rentaOficial);
  return {
    equipo: row.EQUIPO_ORIGINAL,
    modeloNormalizado: row.EQUIPO_NORMALIZADO,
    plan,
    pagoEquipo: pago,
    rentaPlan: rentaOficial,
    totalMensual: total
  };
}

export function buscarInventario(modelo: string) {
  const inv: InvRow[] = loadJSON("data/inventario_para_asistente_normalizado.json");
  const clave = normalizeName(modelo);
  const piezas = inv.filter(r => r.EQUIPO_NORMALIZADO.includes(clave)).reduce((acc, r)=> acc + (r.PIEZAS || 0), 0);
  return piezas;
}

export function calcularUpgrade(modelo: string, plan: LibrePlan) {
  const base = buscarPrecio(modelo, plan);
  if (!base) return null;
  const sig = planSiguiente(plan);
  if (!sig) return { ...base, upgrade: null };
  const up = buscarPrecio(modelo, sig);
  if (!up) return { ...base, upgrade: null };

  const gbActual = GB_POR_PLAN[plan];
  const gbUp = Math.round(GB_POR_PLAN[sig] * 1.5);
  const diferencia = up.totalMensual - base.totalMensual;
  const gbAdicionales = gbUp - gbActual;
  const costoPorGb = gbAdicionales > 0 ? (diferencia / gbAdicionales) : null;

  return {
    base,
    upgrade: {
      planSiguiente: sig,
      pagoEquipo: up.pagoEquipo,
      rentaPlan: up.rentaPlan,
      totalMensual: up.totalMensual,
      internetGB: gbUp,
      diferencia,
      costoPorGb
    }
  };
}
