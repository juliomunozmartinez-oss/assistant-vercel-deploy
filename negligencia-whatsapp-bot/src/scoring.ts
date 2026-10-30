// Calificación determinista del caso. Vive en código (no en el prompt) para que sea
// auditable y el despacho pueda ajustar los pesos sin tocar al modelo.

export const NICHOS = ["obstetrico_perinatal", "cirugia_estetica", "otro_negligencia", "no_aplica"] as const;
export const INSTITUCIONES = [
  "imss", "issste", "imss_bienestar", "salud_estatal", "pemex_sedena_semar",
  "hospital_privado", "clinica_estetica", "consultorio", "otro", "desconocido",
] as const;
export const GRAVEDADES = [
  "muerte", "dano_permanente", "dano_grave_temporal", "dano_leve", "sin_dano", "desconocido",
] as const;
export const EXPEDIENTE = ["si", "parcial", "no", "desconocido"] as const;
export const QUEJAS = [
  "ninguna", "conamed", "comision_estatal_arbitraje", "cndh_o_derechos_humanos",
  "denuncia_penal", "demanda", "otra",
] as const;
export const RELACIONES = ["paciente", "familiar", "otro"] as const;

export type Nicho = (typeof NICHOS)[number];
export type Institucion = (typeof INSTITUCIONES)[number];
export type Gravedad = (typeof GRAVEDADES)[number];

export interface Caso {
  telefono: string;
  consentimiento_privacidad?: boolean;
  nombre?: string;
  relacion?: (typeof RELACIONES)[number];
  ciudad_estado?: string;
  nicho?: Nicho;
  procedimiento?: string;
  institucion?: Institucion;
  nombre_lugar?: string;
  medico?: string;
  fecha_hechos?: string; // AAAA-MM o AAAA-MM-DD
  fecha_conocimiento_dano?: string;
  gravedad?: Gravedad;
  descripcion?: string;
  estado_actual?: string;
  tiene_expediente?: (typeof EXPEDIENTE)[number];
  documentos?: string[];
  quejas_previas?: (typeof QUEJAS)[number][];
  monto_pagado_mxn?: number;
  ofrecen_convenio?: boolean;
  creado: string;
  actualizado: string;
  escalado?: string; // fecha en que se avisó al abogado
}

export type Prioridad = "caliente" | "tibio" | "frio" | "no_aplica";

export interface Calificacion {
  puntaje: number;
  prioridad: Prioridad;
  meses_transcurridos: number | null;
  alertas: string[];
  datos_faltantes: string[];
}

const INSTITUCION_PUBLICA: Institucion[] = ["imss", "issste", "imss_bienestar", "salud_estatal", "pemex_sedena_semar"];

/** Meses completos entre una fecha AAAA-MM(-DD) y hoy. null si no se puede leer. */
export function mesesDesde(fecha: string | undefined, hoy: Date): number | null {
  if (!fecha) return null;
  const m = /^(\d{4})-(\d{2})(?:-(\d{2}))?/.exec(fecha);
  if (!m) return null;
  const anio = Number(m[1]);
  const mes = Number(m[2]);
  const dia = m[3] ? Number(m[3]) : 1;
  if (mes < 1 || mes > 12) return null;
  let meses = (hoy.getUTCFullYear() - anio) * 12 + (hoy.getUTCMonth() + 1 - mes);
  if (hoy.getUTCDate() < dia) meses -= 1;
  return Math.max(0, meses);
}

export function calificar(caso: Caso, hoy = new Date()): Calificacion {
  const alertas: string[] = [];
  const faltantes: string[] = [];

  if (caso.nicho === "no_aplica") {
    return { puntaje: 0, prioridad: "no_aplica", meses_transcurridos: null, alertas, datos_faltantes: [] };
  }

  let puntaje = 0;

  // Nicho
  if (caso.nicho === "obstetrico_perinatal" || caso.nicho === "cirugia_estetica") puntaje += 25;
  else if (caso.nicho === "otro_negligencia") puntaje += 10;
  else faltantes.push("tipo de caso");

  // Gravedad del daño: es lo que más pesa en el monto de una indemnización.
  switch (caso.gravedad) {
    case "muerte":
    case "dano_permanente": puntaje += 35; break;
    case "dano_grave_temporal": puntaje += 20; break;
    case "dano_leve": puntaje += 5; break;
    case "sin_dano": puntaje -= 10; break;
    default: faltantes.push("daño sufrido y estado actual");
  }

  // Tiempo transcurrido: el plazo corre desde que se conoce el alcance del daño, así que
  // se usa la fecha más reciente que tengamos.
  const meses = mesesDesde(caso.fecha_conocimiento_dano ?? caso.fecha_hechos, hoy);
  if (meses === null) {
    faltantes.push("fecha de los hechos");
  } else if (meses <= 12) {
    puntaje += 20;
    if (meses >= 8) alertas.push(`Han pasado ${meses} meses: algunos plazos de reclamación son de 1 año o menos.`);
  } else if (meses <= 24) {
    puntaje += 10;
    alertas.push(`Han pasado ${meses} meses: revisar prescripción de inmediato.`);
  } else {
    puntaje -= 10;
    alertas.push(`Han pasado ${meses} meses: posible prescripción, revisar si el daño se conoció después.`);
  }

  // Lugar de atención: define la vía (administrativa vs. civil/penal) y la solvencia del demandado.
  if (!caso.institucion || caso.institucion === "desconocido") faltantes.push("lugar de atención (IMSS, ISSSTE, privado, clínica…)");
  else if (INSTITUCION_PUBLICA.includes(caso.institucion) || caso.institucion === "hospital_privado") puntaje += 10;
  else if (caso.institucion === "clinica_estetica") puntaje += 5;
  else if (caso.institucion === "consultorio") puntaje += 3;

  // Pruebas
  if (caso.tiene_expediente === "si") puntaje += 10;
  else if (caso.tiene_expediente === "parcial") puntaje += 5;
  else if (!caso.tiene_expediente || caso.tiene_expediente === "desconocido") faltantes.push("si tiene expediente o documentos");

  if (caso.quejas_previas?.some((q) => q !== "ninguna" && q !== "otra")) puntaje += 5;

  if (caso.ofrecen_convenio) {
    puntaje += 10;
    alertas.push("Le ofrecen firmar un convenio o finiquito: contactar antes de que firme.");
  }

  if (!caso.nombre) faltantes.push("nombre");
  if (!caso.ciudad_estado) faltantes.push("ciudad y estado");
  if (caso.nicho === "cirugia_estetica" && !caso.procedimiento) faltantes.push("procedimiento estético realizado");

  const prioridad: Prioridad = puntaje >= 70 ? "caliente" : puntaje >= 45 ? "tibio" : "frio";
  return { puntaje, prioridad, meses_transcurridos: meses, alertas, datos_faltantes: faltantes };
}

/** Texto corto para el aviso al abogado. */
export function resumenCaso(caso: Caso, c: Calificacion): string {
  const linea = (etq: string, v: unknown) => (v === undefined || v === null || v === "" ? "" : `${etq}: ${v}\n`);
  return (
    `Prioridad: ${c.prioridad.toUpperCase()} (${c.puntaje} pts)\n` +
    linea("Nombre", caso.nombre) +
    linea("Relación", caso.relacion) +
    linea("Ciudad", caso.ciudad_estado) +
    linea("Tipo", caso.nicho) +
    linea("Procedimiento", caso.procedimiento) +
    linea("Atención", [caso.institucion, caso.nombre_lugar].filter(Boolean).join(" – ")) +
    linea("Médico", caso.medico) +
    linea("Fecha hechos", caso.fecha_hechos) +
    linea("Daño", caso.gravedad) +
    linea("Expediente", caso.tiene_expediente) +
    linea("Quejas previas", caso.quejas_previas?.join(", ")) +
    linea("Resumen", caso.descripcion) +
    (c.alertas.length ? `⚠️ ${c.alertas.join(" ")}\n` : "") +
    `Chat: https://wa.me/${caso.telefono}`
  ).trim();
}
