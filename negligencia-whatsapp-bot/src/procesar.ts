import { responder } from "./agent.js";
import type { Store } from "./store.js";
import type { MensajeEntrante, Mensajero } from "./whatsapp.js";

/**
 * Encola el mensaje y, si nadie más está atendiendo a esta persona, procesa la cola.
 * Así, si alguien manda tres mensajes seguidos, el agente los recibe juntos y en orden
 * en lugar de lanzar tres respuestas en paralelo sobre el mismo historial.
 */
export async function procesarMensaje(m: MensajeEntrante, store: Store, mensajero: Mensajero): Promise<void> {
  if (!(await store.marcarMensajeNuevo(m.id))) return; // reintento de Meta
  await store.encolar(m.telefono, m.texto);
  await mensajero.marcarLeido(m.id);
  await atenderCola(m.telefono, m.nombrePerfil, store, mensajero);
}

async function atenderCola(telefono: string, nombrePerfil: string | undefined, store: Store, mensajero: Mensajero) {
  if (!(await store.tomarCandado(telefono))) return; // otra invocación ya lo atiende
  try {
    for (let textos = await store.sacarCola(telefono); textos.length > 0; textos = await store.sacarCola(telefono)) {
      const respuesta = await responder(telefono, textos, { store, mensajero, nombrePerfil });
      await mensajero.enviarTexto(telefono, respuesta);
    }
  } finally {
    await store.soltarCandado(telefono);
  }
  // Un mensaje pudo llegar justo entre la última lectura de la cola y soltar el candado.
  if ((await store.tamanoCola(telefono)) > 0) await atenderCola(telefono, nombrePerfil, store, mensajero);
}
