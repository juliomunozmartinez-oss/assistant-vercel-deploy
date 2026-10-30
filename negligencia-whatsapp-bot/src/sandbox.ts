import { responder } from "./agent.js";
import { despacho } from "./despacho.js";
import { calificar, type Caso } from "./scoring.js";
import { MemoriaStore, type Historial } from "./store.js";
import type { Mensajero } from "./whatsapp.js";

// Sandbox de pruebas: el agente real (mismo prompt, herramientas y calificación) pero sin
// WhatsApp ni Redis. El navegador guarda el historial y el caso y los manda en cada mensaje,
// así que no se mezcla con los casos reales. Se activa solo si existe SANDBOX_CLAVE.

const TELEFONO_PRUEBA = "5210000000000";

interface PeticionSandbox {
  textos: string[];
  historial?: Historial;
  caso?: Caso | null;
  nombrePerfil?: string;
  fecha?: string; // AAAA-MM-DD para simular otro día
}

export async function manejarSandbox(request: Request): Promise<Response> {
  const clave = process.env.SANDBOX_CLAVE;
  if (!clave) return new Response("Sandbox desactivado: define SANDBOX_CLAVE.", { status: 404 });

  if (request.method === "GET") {
    return new Response(PAGINA, { headers: { "Content-Type": "text/html; charset=utf-8" } });
  }
  if (request.method !== "POST") return new Response("Método no permitido", { status: 405 });
  if (request.headers.get("x-sandbox-clave") !== clave) {
    return Response.json({ error: "Clave incorrecta" }, { status: 401 });
  }

  let p: PeticionSandbox;
  try {
    p = await request.json();
  } catch {
    return Response.json({ error: "JSON inválido" }, { status: 400 });
  }
  const textos = (p.textos ?? []).map(String).filter((t) => t.trim()).slice(0, 10);
  if (textos.length === 0) return Response.json({ error: "Mensaje vacío" }, { status: 400 });

  const hoy = p.fecha && /^\d{4}-\d{2}-\d{2}$/.test(p.fecha) ? new Date(`${p.fecha}T18:00:00Z`) : new Date();
  const store = new MemoriaStore();
  if (p.historial?.length) await store.guardarHistorial(TELEFONO_PRUEBA, p.historial);
  if (p.caso) await store.guardarCaso({ ...p.caso, telefono: TELEFONO_PRUEBA });

  const avisos: string[] = [];
  const mensajero: Mensajero = {
    async enviarTexto() {},
    async marcarLeido() {},
    async avisarAbogados(resumen) { avisos.push(resumen); },
  };

  const inicio = Date.now();
  try {
    const respuesta = await responder(TELEFONO_PRUEBA, textos, {
      store, mensajero, nombrePerfil: p.nombrePerfil || undefined, hoy,
    });
    const caso = await store.leerCaso(TELEFONO_PRUEBA);
    return Response.json({
      respuesta,
      historial: await store.leerHistorial(TELEFONO_PRUEBA),
      caso,
      calificacion: caso ? calificar(caso, hoy) : null,
      avisos,
      ms: Date.now() - inicio,
    });
  } catch (e) {
    console.error("Sandbox:", e);
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

const ESCENARIOS: [string, string][] = [
  ["Obstétrico IMSS", "Hola, buenas tardes. Mi bebé nació en el IMSS en abril y tardaron muchísimo en hacerme la cesárea, ahora le diagnosticaron parálisis cerebral. Ya no sé qué hacer"],
  ["Muerte del bebé", "Perdí a mi bebé en el parto hace 3 semanas en un hospital privado. Nadie nos explica nada y nos están cobrando todo"],
  ["Lipo + BBL", "Me hice lipo y BBL en una clínica en Tijuana en enero y se me infectó, tuve que estar hospitalizada y me quedaron deformidades"],
  ["Convenio", "La clínica donde me operaron la nariz me quiere dar un reembolso pero me pide firmar un papel donde no los demando"],
  ["Caso viejo", "En 2019 me operaron mal de la vesícula en el seguro y desde entonces tengo problemas"],
  ["Emergencia", "Me operaron del abdomen hace 4 días y tengo fiebre muy alta y la herida huele mal"],
  ["Fuera de tema", "Hola, quiero divorciarme, ¿me pueden ayudar?"],
];

const PAGINA = /* html */ `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sandbox · ${despacho.nombre}</title>
<style>
  :root { --verde:#075e54; --verde2:#128c7e; --fondo:#efeae2; --burbuja:#d9fdd3; --borde:#d1d7db; --texto:#111b21; --gris:#667781; --panel:#fff; }
  * { box-sizing:border-box; }
  body { margin:0; font:15px/1.4 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif; color:var(--texto); background:#d1d7db; height:100vh; display:flex; flex-direction:column; }
  header { background:var(--verde); color:#fff; padding:10px 16px; display:flex; gap:12px; align-items:center; flex-wrap:wrap; }
  header h1 { font-size:16px; margin:0; flex:1; min-width:180px; }
  header input { padding:6px 8px; border-radius:6px; border:0; font:inherit; font-size:13px; }
  header button, .chip { background:#ffffff22; color:#fff; border:1px solid #ffffff55; border-radius:6px; padding:6px 10px; cursor:pointer; font:inherit; font-size:13px; }
  main { flex:1; display:grid; grid-template-columns:minmax(0,1fr) 380px; min-height:0; }
  #chat { display:flex; flex-direction:column; min-height:0; background:var(--fondo); }
  #escenarios { display:flex; gap:6px; padding:8px; flex-wrap:wrap; background:#f0f2f5; border-bottom:1px solid var(--borde); }
  .chip { background:#fff; color:var(--verde); border-color:var(--borde); }
  #mensajes { flex:1; overflow-y:auto; padding:16px 6%; display:flex; flex-direction:column; gap:6px; }
  .msg { max-width:75%; padding:7px 10px 18px; border-radius:8px; position:relative; white-space:pre-wrap; word-wrap:break-word; box-shadow:0 1px 1px #0001; background:#fff; align-self:flex-start; }
  .msg.yo { background:var(--burbuja); align-self:flex-end; }
  .msg .hora { position:absolute; right:8px; bottom:3px; font-size:11px; color:var(--gris); }
  .sistema { align-self:center; background:#fff8c5; font-size:12.5px; padding:4px 10px; border-radius:6px; color:#54656f; max-width:90%; text-align:center; }
  .error { background:#ffd7d7; }
  form { display:flex; gap:8px; padding:10px; background:#f0f2f5; }
  form textarea { flex:1; resize:none; border:0; border-radius:8px; padding:10px; font:inherit; height:44px; }
  form button { background:var(--verde2); color:#fff; border:0; border-radius:50%; width:44px; height:44px; font-size:18px; cursor:pointer; }
  form button:disabled { opacity:.5; }
  aside { background:var(--panel); border-left:1px solid var(--borde); overflow-y:auto; padding:14px; display:flex; flex-direction:column; gap:14px; }
  aside h2 { font-size:13px; text-transform:uppercase; letter-spacing:.04em; color:var(--gris); margin:0 0 6px; }
  .prio { display:inline-block; padding:3px 10px; border-radius:20px; font-weight:600; font-size:13px; }
  .caliente { background:#fde2e1; color:#b42318; } .tibio { background:#fef0c7; color:#93370d; } .frio { background:#e0f2fe; color:#075985; } .no_aplica { background:#eee; color:#555; }
  ul { margin:4px 0; padding-left:18px; } li { margin:2px 0; }
  table { width:100%; border-collapse:collapse; font-size:13px; }
  td { border-bottom:1px solid #eee; padding:4px 2px; vertical-align:top; } td:first-child { color:var(--gris); width:42%; }
  .aviso { background:#fff7e6; border:1px solid #fde68a; border-radius:8px; padding:8px; white-space:pre-wrap; font-size:12.5px; }
  .vacio { color:var(--gris); font-size:13px; }
  @media (max-width: 860px) { main { grid-template-columns:1fr; grid-template-rows:minmax(0,1fr) 40vh; } aside { border-left:0; border-top:1px solid var(--borde); } #mensajes { padding:12px; } }
</style>
</head>
<body>
<header>
  <h1>🧪 Sandbox · ${despacho.nombre}</h1>
  <input id="clave" type="password" placeholder="Clave del sandbox" size="14">
  <input id="perfil" placeholder="Nombre de perfil" size="14" value="Cliente de prueba">
  <label style="font-size:13px">Hoy: <input id="fecha" type="date"></label>
  <button id="reiniciar" type="button">Nueva conversación</button>
</header>
<main>
  <section id="chat">
    <div id="escenarios"></div>
    <div id="mensajes"></div>
    <form id="form">
      <textarea id="entrada" placeholder="Escribe como si fueras el cliente… (Enter envía, Shift+Enter nueva línea)"></textarea>
      <button id="enviar" title="Enviar">➤</button>
    </form>
  </section>
  <aside>
    <div><h2>Calificación</h2><div id="calif" class="vacio">Sin caso registrado todavía.</div></div>
    <div><h2>Datos del caso</h2><div id="caso" class="vacio">—</div></div>
    <div><h2>Avisos al abogado</h2><div id="avisos" class="vacio">Ninguno.</div></div>
  </aside>
</main>
<script>
const ESCENARIOS = ${JSON.stringify(ESCENARIOS)};
const $ = (id) => document.getElementById(id);
const leer = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const escribir = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

let estado = leer("sandbox_estado", null) || nuevoEstado();
function nuevoEstado() { return { historial: [], caso: null, calificacion: null, avisos: [], burbujas: [] }; }
$("clave").value = leer("sandbox_clave", "");
$("clave").onchange = () => escribir("sandbox_clave", $("clave").value);

function html(t) { return t.replace(/[&<>]/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;" }[c])); }
function formatoWA(t) { return html(t).replace(/\\*([^*\\n]+)\\*/g, "<b>$1</b>").replace(/(^|\\s)_([^_\\n]+)_/g, "$1<i>$2</i>").replace(/~([^~\\n]+)~/g, "<s>$1</s>"); }

function pintar() {
  const m = $("mensajes"); m.innerHTML = "";
  if (!estado.burbujas.length) m.innerHTML = '<div class="sistema">Escribe un mensaje o elige un escenario de arriba. Nada de esto llega a WhatsApp ni se guarda como caso real.</div>';
  for (const b of estado.burbujas) {
    const d = document.createElement("div");
    d.className = b.tipo === "sistema" ? "sistema" + (b.error ? " error" : "") : "msg" + (b.tipo === "yo" ? " yo" : "");
    d.innerHTML = b.tipo === "sistema" ? html(b.texto) : formatoWA(b.texto) + '<span class="hora">' + b.hora + "</span>";
    m.appendChild(d);
  }
  m.scrollTop = m.scrollHeight;

  const c = estado.calificacion;
  $("calif").className = c ? "" : "vacio";
  $("calif").innerHTML = !c ? "Sin caso registrado todavía." :
    '<span class="prio ' + c.prioridad + '">' + c.prioridad.replace("_", " ").toUpperCase() + " · " + c.puntaje + " pts</span>" +
    (c.meses_transcurridos !== null ? '<div style="margin-top:6px;font-size:13px">Meses transcurridos: ' + c.meses_transcurridos + "</div>" : "") +
    (c.alertas.length ? "<ul>" + c.alertas.map((a) => "<li>⚠️ " + html(a) + "</li>").join("") + "</ul>" : "") +
    (c.datos_faltantes.length ? '<div style="font-size:13px;margin-top:4px">Falta: ' + html(c.datos_faltantes.join(", ")) + "</div>" : "");

  const caso = estado.caso;
  const filas = caso ? Object.entries(caso).filter(([k, v]) => !["telefono","creado","actualizado"].includes(k) && v !== undefined && v !== null && v !== "") : [];
  $("caso").className = filas.length ? "" : "vacio";
  $("caso").innerHTML = filas.length ? "<table>" + filas.map(([k, v]) => "<tr><td>" + k.replaceAll("_", " ") + "</td><td>" + html(Array.isArray(v) ? v.join(", ") : String(v)) + "</td></tr>").join("") + "</table>" : "—";

  $("avisos").className = estado.avisos.length ? "" : "vacio";
  $("avisos").innerHTML = estado.avisos.length ? estado.avisos.map((a) => '<div class="aviso">🔔 ' + html(a) + "</div>").join("") : "Ninguno.";
  escribir("sandbox_estado", estado);
}

function hora() { return new Date().toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }); }

async function enviar(texto) {
  texto = texto.trim(); if (!texto) return;
  if (!$("clave").value) { alert("Escribe la clave del sandbox (variable SANDBOX_CLAVE)."); $("clave").focus(); return; }
  estado.burbujas.push({ tipo: "yo", texto, hora: hora() });
  estado.burbujas.push({ tipo: "sistema", texto: "Escribiendo…", temporal: true });
  pintar(); $("enviar").disabled = true;
  try {
    const r = await fetch(location.pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-sandbox-clave": $("clave").value },
      body: JSON.stringify({ textos: [texto], historial: estado.historial, caso: estado.caso, nombrePerfil: $("perfil").value, fecha: $("fecha").value || undefined }),
    });
    const datos = await r.json().catch(() => ({ error: "Respuesta inválida (" + r.status + ")" }));
    estado.burbujas = estado.burbujas.filter((b) => !b.temporal);
    if (!r.ok || datos.error) throw new Error(datos.error || r.statusText);
    estado.historial = datos.historial; estado.caso = datos.caso; estado.calificacion = datos.calificacion;
    estado.avisos.push(...datos.avisos);
    estado.burbujas.push({ tipo: "agente", texto: datos.respuesta, hora: hora() });
    if (datos.avisos.length) estado.burbujas.push({ tipo: "sistema", texto: "🔔 Se avisó al abogado (ver panel)" });
    estado.burbujas.push({ tipo: "sistema", texto: (datos.ms / 1000).toFixed(1) + " s" });
  } catch (e) {
    estado.burbujas = estado.burbujas.filter((b) => !b.temporal);
    estado.burbujas.push({ tipo: "sistema", texto: "Error: " + e.message, error: true });
  } finally { $("enviar").disabled = false; pintar(); $("entrada").focus(); }
}

for (const [nombre, texto] of ESCENARIOS) {
  const b = document.createElement("button"); b.className = "chip"; b.type = "button"; b.textContent = nombre;
  b.onclick = () => { $("entrada").value = texto; $("entrada").focus(); };
  $("escenarios").appendChild(b);
}
$("form").onsubmit = (e) => { e.preventDefault(); const t = $("entrada").value; $("entrada").value = ""; enviar(t); };
$("entrada").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); $("form").requestSubmit(); } };
$("reiniciar").onclick = () => { if (confirm("¿Borrar esta conversación de prueba?")) { estado = nuevoEstado(); pintar(); } };
pintar();
</script>
</body>
</html>`;
