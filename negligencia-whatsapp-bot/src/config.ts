// Configuración leída de variables de entorno (Vercel → Settings → Environment Variables).

function requerida(nombre: string): string {
  const valor = process.env[nombre];
  if (!valor) throw new Error(`Falta la variable de entorno ${nombre}`);
  return valor;
}

export const config = {
  // Claude
  modelo: process.env.CLAUDE_MODEL ?? "claude-opus-5-5",
  // Chat de captación: "low" es rápido y barato; súbelo a "medium" si notas respuestas pobres.
  esfuerzo: (process.env.CLAUDE_EFFORT ?? "low") as "low" | "medium" | "high",

  // WhatsApp Cloud API (Meta)
  get waToken() { return requerida("WHATSAPP_TOKEN"); },
  get waPhoneNumberId() { return requerida("WHATSAPP_PHONE_NUMBER_ID"); },
  get waVerifyToken() { return requerida("WHATSAPP_VERIFY_TOKEN"); },
  get waAppSecret() { return requerida("WHATSAPP_APP_SECRET"); },
  waApiVersion: process.env.WHATSAPP_API_VERSION ?? "v23.0",

  // Abogado(s) que reciben los avisos de casos, separados por coma, formato 521XXXXXXXXXX
  abogadosWhatsApp: (process.env.ABOGADO_WHATSAPP ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  // Plantilla aprobada por Meta para avisar fuera de la ventana de 24 h (opcional).
  // Debe tener 1 variable en el cuerpo: {{1}} = resumen del caso.
  plantillaAviso: process.env.WHATSAPP_AVISO_TEMPLATE ?? "",
  plantillaIdioma: process.env.WHATSAPP_AVISO_TEMPLATE_LANG ?? "es_MX",

  // Conversaciones
  diasRetencion: Number(process.env.DIAS_RETENCION ?? 30),
  maxMensajesConversacion: Number(process.env.MAX_MENSAJES ?? 80),
};
