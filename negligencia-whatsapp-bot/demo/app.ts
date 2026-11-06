// Simulador del agente. Se compila en dos versiones (scripts/build-demo.ts):
// - "claude": página de claude.ai que usa la capacidad `sample` (Claude con la cuenta de
//   quien la abre). Las herramientas corren aquí, con el prompt y la calificación de src/.
// - "servidor": la sirve /api/sandbox en Vercel; el agente real corre en el servidor con la
//   clave de API del despacho y la página solo manda mensajes con la contraseña del sandbox.
import { despacho } from "../src/despacho.js";
import { SYSTEM_PROMPT } from "../src/prompt.js";
import { calificar, type Caso } from "../src/scoring.js";
import type { Store } from "../src/store.js";
import { ejecutarTool, TOOLS } from "../src/tools.js";

declare const claude: { use(name: "sample"): Promise<any | null> };
declare const __MODO__: "claude" | "servidor";
const SERVIDOR = __MODO__ === "servidor";

const TELEFONO = "5210000000000";
const CLAVE = "simulador_gya_v1";

const ESCENARIOS: [string, string][] = [
  ["Obstétrico IMSS", "Hola, buenas tardes. Mi bebé nació en el IMSS en abril y tardaron muchísimo en hacerme la cesárea, ahora le diagnosticaron parálisis cerebral. Ya no sé qué hacer"],
  ["Muerte del bebé", "Perdí a mi bebé en el parto hace 3 semanas en un hospital privado. Nadie nos explica nada y nos están cobrando todo"],
  ["Lipo + BBL", "Me hice lipo y BBL en una clínica en Tijuana en enero y se me infectó, tuve que estar hospitalizada y me quedaron deformidades"],
  ["Convenio", "La clínica donde me operaron la nariz me quiere dar un reembolso pero me pide firmar un papel donde no los demando"],
  ["Caso viejo", "En 2019 me operaron mal de la vesícula en el seguro y desde entonces tengo problemas"],
  ["Emergencia", "Me operaron del abdomen hace 4 días y tengo fiebre muy alta y la herida huele mal"],
  ["Fuera de tema", "Hola, quiero divorciarme, ¿me pueden ayudar?"],
];

interface Burbuja { quien: "cliente" | "agente" | "nota"; texto: string; hora?: string; error?: boolean }
interface Estado {
  turnos: { role: "user" | "assistant"; content: string }[];
  burbujas: Burbuja[];
  caso: Caso | null;
  avisos: string[];
  historialServidor: unknown[]; // historial completo del agente (modo servidor), se devuelve tal cual
}

const nuevoEstado = (): Estado => ({ turnos: [], burbujas: [], caso: null, avisos: [], historialServidor: [] });
let estado: Estado = leer(CLAVE) ?? nuevoEstado();

function leer<T>(k: string): T | null {
  try { return JSON.parse(localStorage.getItem(k) ?? "null"); } catch { return null; }
}
function guardar() {
  try { localStorage.setItem(CLAVE, JSON.stringify(estado)); } catch { /* sin almacenamiento */ }
}

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const hora = () => new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const formatoWA = (t: string) =>
  esc(t)
    .replace(/\*([^*\n]+)\*/g, "<strong>$1</strong>")
    .replace(/(^|\s)_([^_\n]+)_/g, "$1<em>$2</em>")
    .replace(/~([^~\n]+)~/g, "<s>$1</s>");

function hoy(): Date {
  const f = $<HTMLInputElement>("fecha").value;
  return /^\d{4}-\d{2}-\d{2}$/.test(f) ? new Date(`${f}T18:00:00Z`) : new Date();
}
function encabezadoFecha(d: Date) {
  return `[Fecha de hoy: ${d.toLocaleDateString("es-MX", { timeZone: "America/Mexico_City", weekday: "long", year: "numeric", month: "long", day: "numeric" })} (${d.toLocaleDateString("en-CA", { timeZone: "America/Mexico_City" })})]`;
}

// ---- Herramientas: las mismas de src/tools.ts, con un almacén en memoria de la página ----
const store = {
  async leerCaso() { return estado.caso ? structuredClone(estado.caso) : null; },
  async guardarCaso(caso: Caso) { estado.caso = structuredClone(caso); },
} as unknown as Store;
const mensajero = {
  async enviarTexto() {}, async marcarLeido() {},
  async avisarAbogados(resumen: string) { estado.avisos.push(resumen); },
};

// Claude puede pedir varias herramientas a la vez; se ejecutan en fila porque todas
// leen y escriben el mismo caso.
let fila: Promise<unknown> = Promise.resolve();
function enFila<T>(fn: () => Promise<T>): Promise<T> {
  const p = fila.then(fn, fn);
  fila = p.catch(() => {});
  return p;
}

const herramientas = TOOLS.map((t) => ({
  name: t.name,
  description: t.description!,
  inputSchema: t.input_schema,
  execute: (input: Record<string, unknown>) =>
    enFila(async () => {
      const r = await ejecutarTool(
        { type: "tool_use", id: crypto.randomUUID(), name: t.name, input } as any,
        { telefono: TELEFONO, nombrePerfil: $<HTMLInputElement>("perfil").value || undefined, store, mensajero, hoy: hoy() },
      );
      pintarPanel();
      if (r.is_error) throw new Error(String(r.content));
      return JSON.parse(String(r.content));
    }),
}));

const INSTRUCCIONES =
  "Actúa exactamente como el asistente descrito abajo. Estás en un simulador: cada mensaje del usuario es de un cliente que " +
  "escribe por WhatsApp. Usa las herramientas guardar_datos_caso y solicitar_abogado como se indica. Responde solo con el " +
  "mensaje que se le enviaría al cliente, sin comentarios sobre el simulador.\n\n" + SYSTEM_PROMPT;

// ---- Pintado ----
function pintarChat() {
  const m = $("mensajes");
  m.replaceChildren();
  if (!estado.burbujas.length) {
    const d = document.createElement("div");
    d.className = "vacio-chat";
    d.innerHTML = `<p class="vacio-titulo">Escriba como si fuera un cliente</p><p>Cuente un caso con sus palabras o elija un escenario de arriba. El agente responde igual que en WhatsApp y a la derecha verá lo que registra.</p>`;
    m.append(d);
  }
  for (const b of estado.burbujas) {
    const d = document.createElement("div");
    if (b.quien === "nota") {
      d.className = "nota" + (b.error ? " nota-error" : "");
      d.textContent = b.texto;
    } else {
      d.className = `burbuja ${b.quien}`;
      d.innerHTML = (b.texto ? formatoWA(b.texto) : '<span class="pensando">Pensando…</span>') +
        (b.hora ? `<span class="hora">${b.hora}</span>` : "");
    }
    m.append(d);
  }
  m.scrollTop = m.scrollHeight;
}

function pintarPanel() {
  const caso = estado.caso;
  const c = caso ? calificar(caso, hoy()) : null;
  $("calif").innerHTML = !c
    ? '<p class="tenue">Aún no hay caso registrado. Aparece en cuanto el cliente autoriza el uso de sus datos.</p>'
    : `<div class="prio prio-${c.prioridad}">${c.prioridad.replace("_", " ")}<span>${c.puntaje} pts</span></div>` +
      (c.meses_transcurridos !== null ? `<p class="dato">Meses desde los hechos: <b>${c.meses_transcurridos}</b></p>` : "") +
      (c.alertas.length ? `<ul class="alertas">${c.alertas.map((a) => `<li>${esc(a)}</li>`).join("")}</ul>` : "") +
      (c.datos_faltantes.length ? `<p class="dato">Falta: ${esc(c.datos_faltantes.join(", "))}</p>` : '<p class="dato">Datos completos.</p>');

  const filas = caso
    ? Object.entries(caso).filter(([k, v]) => !["telefono", "creado", "actualizado"].includes(k) && v !== null && v !== undefined && v !== "")
    : [];
  $("caso").innerHTML = filas.length
    ? `<dl>${filas.map(([k, v]) => `<dt>${esc(k.replaceAll("_", " "))}</dt><dd>${esc(Array.isArray(v) ? v.join(", ") : v === true ? "sí" : String(v))}</dd>`).join("")}</dl>`
    : '<p class="tenue">—</p>';

  $("avisos").innerHTML = estado.avisos.length
    ? estado.avisos.map((a) => `<pre class="aviso">${esc(a)}</pre>`).join("")
    : '<p class="tenue">Ninguno. Cuando el agente pase el caso, aquí verá el mensaje exacto que recibiría el abogado.</p>';
  $("contador-avisos").textContent = estado.avisos.length ? String(estado.avisos.length) : "";
  guardar();
}

function pintar() { pintarChat(); pintarPanel(); }

// ---- Conversación ----
let sample: any = null;
let control: AbortController | null = null;

const MENSAJES_ERROR: Record<string, string> = {
  not_granted: "No se autorizó el uso de Claude en esta página. Recárguela para volver a intentarlo.",
  sampling_disabled: "Claude no está disponible para esta cuenta.",
  rate_limited: "Se alcanzó el límite de uso por ahora. Espere un momento y vuelva a enviar.",
  session_expired: "La sesión expiró. Vuelva a iniciar sesión en claude.ai.",
  refused: "Claude no respondió a este mensaje. Pruebe redactarlo de otra forma.",
  tools_unavailable: "Esta vista no puede ejecutar las herramientas del agente. Ábrala en claude.ai desde un navegador.",
  empty_completion: "El agente no devolvió texto. Vuelva a enviar el mensaje.",
};

async function enviar(texto: string) {
  texto = texto.trim();
  if (!texto || control) return;
  if (!SERVIDOR && !sample) return;

  const contenido = `${encabezadoFecha(hoy())}\n${texto}`;
  estado.turnos.push({ role: "user", content: contenido });
  estado.burbujas.push({ quien: "cliente", texto, hora: hora() });
  const respuesta: Burbuja = { quien: "agente", texto: "" };
  estado.burbujas.push(respuesta);
  const avisosAntes = estado.avisos.length;
  pintar();
  ocupado(true);

  // Lo ya registrado va en el último mensaje, como lo verían los resultados de herramientas en el bot.
  const turnos = estado.turnos.map((t, i) =>
    i === estado.turnos.length - 1 && estado.caso
      ? { ...t, content: `${t.content}\n\n[Nota del sistema: datos ya registrados del caso: ${JSON.stringify({ ...estado.caso, telefono: undefined })}]` }
      : t,
  );

  const modo = $<HTMLSelectElement>("modo").value;
  control = new AbortController();
  const inicio = performance.now();
  try {
    if (SERVIDOR) {
      await enviarAlServidor(texto, respuesta, control.signal);
    } else {
      const r = await sample([{ role: "user", content: INSTRUCCIONES }, ...turnos], {
        signal: control.signal,
        tools: herramientas,
        ...(modo === "rapido" ? { modelTier: "quick" } : { modelTier: "default", effort: "low" }),
        onText: ({ text }: { text: string }) => { respuesta.texto = text; pintarChat(); },
      });
      respuesta.texto = r.text.trim();
    }
    respuesta.hora = hora();
    estado.turnos.push({ role: "assistant", content: respuesta.texto });
    if (estado.avisos.length > avisosAntes) estado.burbujas.push({ quien: "nota", texto: "Se avisó al abogado. Vea el panel de avisos." });
    estado.burbujas.push({ quien: "nota", texto: `${((performance.now() - inicio) / 1000).toFixed(0)} s` });
  } catch (e: any) {
    if (e?.name === "AbortError") e = { code: "cancelled" };
    if (e?.text) { respuesta.texto = e.text; respuesta.hora = hora(); estado.turnos.push({ role: "assistant", content: e.text }); }
    else estado.burbujas.splice(estado.burbujas.indexOf(respuesta), 1);
    if (e?.code !== "cancelled") {
      estado.burbujas.push({ quien: "nota", error: true, texto: e?.mensaje ?? MENSAJES_ERROR[e?.code] ?? "Se interrumpió la respuesta. Vuelva a enviar el mensaje." });
    }
  } finally {
    control = null;
    ocupado(false);
    pintar();
  }
}

const MENSAJES_SERVIDOR: Record<number, string> = {
  401: "Contraseña incorrecta. Escríbala arriba, en el campo Contraseña.",
  404: "El simulador está desactivado en este servidor.",
};

async function enviarAlServidor(texto: string, respuesta: Burbuja, signal: AbortSignal) {
  const clave = $<HTMLInputElement>("clave").value;
  if (!clave) throw { mensaje: MENSAJES_SERVIDOR[401] };
  const r = await fetch(location.pathname, {
    method: "POST",
    signal,
    headers: { "Content-Type": "application/json", "x-sandbox-clave": clave },
    body: JSON.stringify({
      textos: [texto],
      historial: estado.historialServidor,
      caso: estado.caso,
      nombrePerfil: $<HTMLInputElement>("perfil").value,
      fecha: $<HTMLInputElement>("fecha").value || undefined,
    }),
  });
  const datos = await r.json().catch(() => null);
  if (!r.ok || !datos || datos.error) throw { mensaje: MENSAJES_SERVIDOR[r.status] ?? `El servidor no pudo responder (${datos?.error ?? r.status}).` };
  try { localStorage.setItem(CLAVE + "_clave", clave); } catch { /* sin almacenamiento */ }
  respuesta.texto = String(datos.respuesta).trim();
  estado.historialServidor = datos.historial;
  estado.caso = datos.caso;
  estado.avisos.push(...datos.avisos);
}

function ocupado(si: boolean) {
  $<HTMLButtonElement>("enviar").hidden = si;
  $<HTMLButtonElement>("detener").hidden = !si;
  document.querySelectorAll<HTMLButtonElement>(".escenario").forEach((b) => (b.disabled = si));
}

// ---- Arranque ----
function iniciar() {
  $("nombre-despacho").textContent = despacho.nombre;
  $("nombre-agente").textContent = despacho.nombreAgente;
  for (const [nombre, texto] of ESCENARIOS) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "escenario";
    b.textContent = nombre;
    b.onclick = () => { const e = $<HTMLTextAreaElement>("entrada"); e.value = texto; e.focus(); };
    $("escenarios").append(b);
  }
  const entrada = $<HTMLTextAreaElement>("entrada");
  $("formulario").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const t = entrada.value;
    if (!t.trim() || control || (!SERVIDOR && !sample)) return;
    entrada.value = "";
    enviar(t);
  });
  entrada.addEventListener("keydown", (ev) => {
    if (ev.key === "Enter" && !ev.shiftKey) { ev.preventDefault(); $<HTMLFormElement>("formulario").requestSubmit(); }
  });
  $("detener").onclick = () => control?.abort();
  $("fecha").addEventListener("change", pintarPanel);

  // Reiniciar pide un segundo clic en lugar de confirm(), que el visor no muestra.
  const reiniciar = $<HTMLButtonElement>("reiniciar");
  let armado = 0;
  reiniciar.onclick = () => {
    if (control) return;
    if (Date.now() - armado < 4000) {
      estado = nuevoEstado(); armado = 0; reiniciar.textContent = "Nueva conversación"; pintar(); entrada.focus();
    } else {
      armado = Date.now(); reiniciar.textContent = "¿Borrar? Toque otra vez";
      setTimeout(() => { if (armado && Date.now() - armado >= 4000) { armado = 0; reiniciar.textContent = "Nueva conversación"; } }, 4100);
    }
  };

  pintar();

  if (SERVIDOR) {
    // En el servidor el modelo lo fija la configuración del bot.
    $("campo-modo").hidden = true;
    $("campo-clave").hidden = false;
    try { $<HTMLInputElement>("clave").value = localStorage.getItem(CLAVE + "_clave") ?? ""; } catch { /* sin almacenamiento */ }
    $<HTMLButtonElement>("enviar").disabled = false;
    entrada.disabled = false;
    entrada.placeholder = "Escriba como el cliente… (Enter envía, Shift+Enter salto de línea)";
    $("pie").textContent = "Simulación: nada se envía por WhatsApp ni se guarda como caso real. Las respuestas usan el agente real del servidor.";
    return;
  }

  const aviso = $("aviso-estado");
  if (typeof claude === "undefined") { aviso.textContent = "Abra esta página en claude.ai para conversar con el agente."; aviso.hidden = false; return; }
  claude.use("sample").then(async (s) => {
    const limites = s ? await s.limits().catch(() => null) : null;
    if (!s || (limites && !limites.tools)) {
      aviso.textContent = "Esta vista no puede ejecutar al agente. Ábrala en claude.ai desde un navegador con su sesión iniciada.";
      aviso.hidden = false;
      return;
    }
    sample = s;
    $<HTMLButtonElement>("enviar").disabled = false;
    entrada.disabled = false;
    entrada.placeholder = "Escriba como el cliente… (Enter envía, Shift+Enter salto de línea)";
  });
}

iniciar();
