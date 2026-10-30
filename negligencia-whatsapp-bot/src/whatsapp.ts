import { createHmac, timingSafeEqual } from "node:crypto";
import { config } from "./config.js";

// Envío por WhatsApp Cloud API. Se puede sustituir en pruebas locales.
export interface Mensajero {
  enviarTexto(telefono: string, texto: string): Promise<void>;
  marcarLeido(idMensaje: string): Promise<void>;
  avisarAbogados(resumen: string): Promise<void>;
}

/** Valida la cabecera X-Hub-Signature-256 que Meta firma con el App Secret. */
export function firmaValida(cuerpoCrudo: string, cabecera: string | null, secreto: string): boolean {
  if (!cabecera?.startsWith("sha256=")) return false;
  const esperada = Buffer.from(createHmac("sha256", secreto).update(cuerpoCrudo, "utf8").digest("hex"));
  const recibida = Buffer.from(cabecera.slice("sha256=".length));
  return esperada.length === recibida.length && timingSafeEqual(esperada, recibida);
}

export interface MensajeEntrante {
  id: string;
  telefono: string;
  nombrePerfil?: string;
  texto: string;
}

const NOTA_MEDIA: Record<string, string> = {
  image: "una imagen",
  document: "un documento",
  audio: "un audio",
  video: "un video",
  sticker: "un sticker",
  location: "una ubicación",
  contacts: "un contacto",
};

/** Extrae los mensajes del payload del webhook; ignora estados de entrega y otros eventos. */
export function extraerMensajes(payload: any): MensajeEntrante[] {
  const salida: MensajeEntrante[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry?.changes ?? []) {
      const value = change?.value;
      const perfiles = new Map<string, string>(
        (value?.contacts ?? []).map((c: any) => [c?.wa_id, c?.profile?.name]),
      );
      for (const m of value?.messages ?? []) {
        let texto: string;
        if (m.type === "text") texto = m.text?.body ?? "";
        else if (m.type === "interactive") texto = m.interactive?.button_reply?.title ?? m.interactive?.list_reply?.title ?? "";
        else if (m.type === "button") texto = m.button?.text ?? "";
        else {
          const que = NOTA_MEDIA[m.type] ?? `un mensaje de tipo ${m.type}`;
          const pie = m[m.type]?.caption ? ` con el texto: "${m[m.type].caption}"` : "";
          const archivo = m.document?.filename ? ` (archivo: ${m.document.filename})` : "";
          const idMedia = m[m.type]?.id ? ` [media_id ${m[m.type].id}]` : "";
          texto = `[El usuario envió ${que}${archivo}${pie}]${idMedia}`;
        }
        if (!texto.trim()) continue;
        salida.push({ id: m.id, telefono: m.from, nombrePerfil: perfiles.get(m.from), texto });
      }
    }
  }
  return salida;
}

/** WhatsApp limita el texto a 4096 caracteres; partimos por párrafos. */
export function partirTexto(texto: string, max = 4000): string[] {
  if (texto.length <= max) return [texto];
  const partes: string[] = [];
  let actual = "";
  for (const parrafo of texto.split("\n")) {
    if ((actual + "\n" + parrafo).length > max && actual) {
      partes.push(actual);
      actual = parrafo;
    } else {
      actual = actual ? actual + "\n" + parrafo : parrafo;
    }
    while (actual.length > max) {
      partes.push(actual.slice(0, max));
      actual = actual.slice(max);
    }
  }
  if (actual) partes.push(actual);
  return partes;
}

export class WhatsAppCloud implements Mensajero {
  private async llamar(cuerpo: unknown) {
    const res = await fetch(
      `https://graph.facebook.com/${config.waApiVersion}/${config.waPhoneNumberId}/messages`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${config.waToken}`, "Content-Type": "application/json" },
        body: JSON.stringify(cuerpo),
      },
    );
    if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  }

  async enviarTexto(telefono: string, texto: string) {
    for (const parte of partirTexto(texto)) {
      await this.llamar({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: telefono,
        type: "text",
        text: { preview_url: false, body: parte },
      });
    }
  }

  async marcarLeido(idMensaje: string) {
    // Palomitas azules + indicador de "escribiendo…" mientras responde Claude.
    await this.llamar({
      messaging_product: "whatsapp",
      status: "read",
      message_id: idMensaje,
      typing_indicator: { type: "text" },
    }).catch((e) => console.warn("marcarLeido:", e.message));
  }

  async avisarAbogados(resumen: string) {
    for (const abogado of config.abogadosWhatsApp) {
      try {
        if (config.plantillaAviso) {
          // Las plantillas funcionan aunque el abogado no haya escrito al bot en las últimas 24 h.
          await this.llamar({
            messaging_product: "whatsapp",
            to: abogado,
            type: "template",
            template: {
              name: config.plantillaAviso,
              language: { code: config.plantillaIdioma },
              components: [{
                type: "body",
                // Los parámetros de plantilla no admiten saltos de línea.
                parameters: [{ type: "text", text: resumen.replace(/\s*\n\s*/g, " | ").slice(0, 1000) }],
              }],
            },
          });
        } else {
          await this.enviarTexto(abogado, `🔔 Nuevo caso\n${resumen}`);
        }
      } catch (e) {
        console.error(`No se pudo avisar al abogado ${abogado}:`, (e as Error).message);
      }
    }
  }
}
