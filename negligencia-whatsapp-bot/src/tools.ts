import type Anthropic from "@anthropic-ai/sdk";
import {
  calificar, resumenCaso, EXPEDIENTE, GRAVEDADES, INSTITUCIONES, NICHOS, QUEJAS, RELACIONES,
  type Caso,
} from "./scoring.js";
import type { Store } from "./store.js";
import type { Mensajero } from "./whatsapp.js";

// Con strict: true todas las propiedades deben ir en "required"; los campos opcionales se
// declaran como nulos y el modelo manda null en lo que no sepa.
const texto = (description: string) => ({ type: ["string", "null"], description });
const opcion = (valores: readonly string[], description: string) => ({
  type: ["string", "null"], enum: [...valores, null], description,
});

const CAMPOS_CASO = {
  consentimiento_privacidad: { type: ["boolean", "null"], description: "true solo si la persona autorizó expresamente el uso de sus datos de salud." },
  nombre: texto("Nombre de quien escribe."),
  relacion: opcion(RELACIONES, "Si quien escribe es el paciente o un familiar."),
  ciudad_estado: texto("Ciudad y estado donde vive."),
  nicho: opcion(NICHOS, "Tipo de caso."),
  procedimiento: texto("Procedimiento: p. ej. 'cesárea', 'parto natural', 'liposucción + BBL'."),
  institucion: opcion(INSTITUCIONES, "Dónde se atendió."),
  nombre_lugar: texto("Nombre del hospital, clínica o unidad, y ciudad."),
  medico: texto("Nombre del médico o médicos, y si sabe su especialidad o certificación."),
  fecha_hechos: texto("Fecha de los hechos en formato AAAA-MM o AAAA-MM-DD."),
  fecha_conocimiento_dano: texto("Fecha en que se supo del daño o de la secuela (AAAA-MM o AAAA-MM-DD), si es distinta."),
  gravedad: opcion(GRAVEDADES, "Daño sufrido."),
  descripcion: texto("Resumen breve de lo que pasó, en tercera persona. Reemplaza al anterior: incluye lo ya sabido."),
  estado_actual: texto("Cómo está hoy el paciente (o el bebé)."),
  tiene_expediente: opcion(EXPEDIENTE, "Si tiene expediente clínico o documentos médicos."),
  documentos: { type: ["array", "null"], items: { type: "string" }, description: "Documentos o archivos que tiene o envió (se suman a los anteriores)." },
  quejas_previas: { type: ["array", "null"], items: { type: "string", enum: [...QUEJAS] }, description: "Quejas o denuncias ya presentadas." },
  monto_pagado_mxn: { type: ["number", "null"], description: "Cuánto pagó por el procedimiento (cirugía estética o privado)." },
  ofrecen_convenio: { type: ["boolean", "null"], description: "true si el hospital o la clínica le ofrece firmar un convenio, finiquito o desistimiento." },
} as const;

export const TOOLS: Anthropic.Beta.BetaTool[] = [
  {
    name: "guardar_datos_caso",
    description:
      "Guarda o actualiza los datos del caso de la persona con la que hablas. Llámala cada vez que te dé datos nuevos, " +
      "enviando solo esos campos y null en los demás. Devuelve la prioridad del caso, alertas de plazos y los datos que faltan.",
    strict: true,
    input_schema: {
      type: "object",
      properties: CAMPOS_CASO,
      required: Object.keys(CAMPOS_CASO),
      additionalProperties: false,
    } as Anthropic.Beta.BetaTool.InputSchema,
  },
  {
    name: "solicitar_abogado",
    description:
      "Avisa a un abogado del despacho para que contacte a la persona. Úsala cuando ya tengas fecha, lugar de atención y daño, " +
      "cuando la persona pida hablar con un abogado, cuando un plazo pueda vencer o cuando la persona esté muy afectada.",
    strict: true,
    input_schema: {
      type: "object",
      properties: {
        motivo: { type: "string", description: "Por qué se pasa al abogado ahora." },
        urgencia: { type: "string", enum: ["alta", "normal"], description: "alta: plazo cercano, convenio por firmar, riesgo emocional o muerte reciente." },
        mejor_horario: texto("Cuándo prefiere que la contacten, si lo dijo."),
      },
      required: ["motivo", "urgencia", "mejor_horario"],
      additionalProperties: false,
    },
  },
];

export interface ContextoTools {
  telefono: string;
  nombrePerfil?: string;
  store: Store;
  mensajero: Mensajero;
  hoy: Date;
}

function casoVacio(ctx: ContextoTools): Caso {
  const ahora = ctx.hoy.toISOString();
  return { telefono: ctx.telefono, nombre: ctx.nombrePerfil, creado: ahora, actualizado: ahora };
}

async function guardarDatosCaso(input: Record<string, unknown>, ctx: ContextoTools) {
  const caso = (await ctx.store.leerCaso(ctx.telefono)) ?? casoVacio(ctx);
  const consiente = input.consentimiento_privacidad === true || caso.consentimiento_privacidad === true;
  const camposMedicos = Object.entries(input).filter(
    ([k, v]) => v !== null && !["consentimiento_privacidad", "nombre", "ciudad_estado", "relacion"].includes(k),
  );
  // LFPDPPP: los datos de salud son sensibles y requieren consentimiento expreso.
  if (!consiente && camposMedicos.length > 0) {
    return {
      error: "No hay consentimiento para datos de salud. Pide primero la autorización expresa (aviso de privacidad) y guárdala con consentimiento_privacidad = true.",
    };
  }

  for (const [k, v] of Object.entries(input)) {
    if (v === null || v === undefined) continue;
    if (k === "documentos" || k === "quejas_previas") {
      const previos = (caso[k] as string[] | undefined) ?? [];
      (caso as any)[k] = [...new Set([...previos, ...(v as string[])])];
    } else {
      (caso as any)[k] = v;
    }
  }
  caso.actualizado = ctx.hoy.toISOString();

  const c = calificar(caso, ctx.hoy);
  await ctx.store.guardarCaso(caso, c.puntaje);
  return {
    guardado: true,
    prioridad: c.prioridad,
    alertas: c.alertas,
    datos_faltantes: c.datos_faltantes,
    abogado_ya_avisado: Boolean(caso.escalado),
  };
}

async function solicitarAbogado(input: Record<string, unknown>, ctx: ContextoTools) {
  const caso = (await ctx.store.leerCaso(ctx.telefono)) ?? casoVacio(ctx);
  const c = calificar(caso, ctx.hoy);
  const encabezado =
    `${input.urgencia === "alta" ? "URGENTE – " : ""}Motivo: ${input.motivo}` +
    (input.mejor_horario ? `\nHorario preferido: ${input.mejor_horario}` : "");
  await ctx.mensajero.avisarAbogados(`${encabezado}\n${resumenCaso(caso, c)}`);
  caso.escalado = ctx.hoy.toISOString();
  await ctx.store.guardarCaso(caso, c.puntaje);
  return { avisado: true, mensaje: "El abogado fue notificado y contactará a la persona por este mismo número." };
}

export async function ejecutarTool(
  bloque: Anthropic.Beta.BetaToolUseBlock,
  ctx: ContextoTools,
): Promise<Anthropic.Beta.BetaToolResultBlockParam> {
  try {
    const input = bloque.input as Record<string, unknown>;
    const resultado =
      bloque.name === "guardar_datos_caso" ? await guardarDatosCaso(input, ctx)
      : bloque.name === "solicitar_abogado" ? await solicitarAbogado(input, ctx)
      : { error: `Herramienta desconocida: ${bloque.name}` };
    const esError = "error" in resultado;
    return { type: "tool_result", tool_use_id: bloque.id, content: JSON.stringify(resultado), is_error: esError };
  } catch (e) {
    console.error(`Tool ${bloque.name} falló:`, e);
    return { type: "tool_result", tool_use_id: bloque.id, content: `Error interno: ${(e as Error).message}`, is_error: true };
  }
}
