// Prueba el agente en la terminal sin WhatsApp ni Redis:
//   ANTHROPIC_API_KEY=... npm run chat
import { createInterface } from "node:readline/promises";
import { responder } from "../src/agent.js";
import { calificar } from "../src/scoring.js";
import { MemoriaStore } from "../src/store.js";
import type { Mensajero } from "../src/whatsapp.js";

const store = new MemoriaStore();
const mensajero: Mensajero = {
  async enviarTexto() {},
  async marcarLeido() {},
  async avisarAbogados(resumen) {
    console.log(`\n\x1b[33m--- AVISO AL ABOGADO ---\n${resumen}\n------------------------\x1b[0m\n`);
  },
};
const telefono = "5214440000000";
const rl = createInterface({ input: process.stdin, output: process.stdout });
console.log("Escribe como si fueras un cliente. /caso muestra el registro, /salir termina.\n");

while (true) {
  const linea = (await rl.question("\x1b[36mTú:\x1b[0m ")).trim();
  if (!linea) continue;
  if (linea === "/salir") break;
  if (linea === "/caso") {
    const caso = await store.leerCaso(telefono);
    console.log(caso ? { ...caso, calificacion: calificar(caso) } : "Sin caso registrado");
    continue;
  }
  const respuesta = await responder(telefono, [linea], { store, mensajero, nombrePerfil: "Cliente de prueba" });
  console.log(`\x1b[32mAgente:\x1b[0m ${respuesta}\n`);
}
rl.close();
