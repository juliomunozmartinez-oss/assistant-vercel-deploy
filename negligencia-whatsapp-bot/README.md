# Agente de WhatsApp – Negligencia médica

Asistente virtual de WhatsApp para un despacho de negligencia médica, enfocado en dos nichos:

1. **Obstétrico y perinatal**: daño a la madre o al bebé en embarazo, parto, cesárea o posparto.
2. **Cirugía estética**: complicaciones por liposucción, BBL, abdominoplastia, implantes, biopolímeros, etc.

Los casos de otras especialidades también se registran (como `otro_negligencia`) para que el abogado decida.

## Qué hace

- Recibe mensajes por **WhatsApp Cloud API** (Meta) y responde con **Claude** en un tono empático y breve.
- **Pide consentimiento expreso** antes de guardar datos de salud (LFPDPPP); el código rechaza guardarlos sin él.
- Reúne los datos clave poco a poco: fecha de los hechos, lugar de atención (IMSS, ISSSTE, privado, clínica…), daño, documentos, quejas previas, procedimiento y médico.
- **Califica cada caso en código** (`src/scoring.ts`): caliente / tibio / frío, con alertas de prescripción (8+ meses) y de convenios por firmar.
- **Avisa al abogado por WhatsApp** con un resumen y el enlace `wa.me` del cliente cuando el caso está listo, cuando lo piden o cuando es urgente.
- Junta los mensajes seguidos de una misma persona, ignora los reintentos de Meta y valida la firma del webhook.

## Estructura

```
api/webhook.ts     GET verificación de Meta, POST mensajes entrantes
api/health.ts      comprobación rápida
api/sandbox.ts     página de pruebas (requiere SANDBOX_CLAVE); también se sirve en /
demo/              simulador (una página, dos versiones: claude.ai y servidor)
src/prompt.ts      instrucciones del agente (qué pregunta, qué nunca dice)
src/despacho.ts    nombre, horario, aviso de privacidad, honorarios  ← EDITAR
src/scoring.ts     calificación de casos y resumen para el abogado
src/tools.ts       herramientas: guardar_datos_caso, solicitar_abogado
src/agent.ts       llamada a Claude con herramientas y caché de prompt
src/procesar.ts    cola por persona, deduplicación
src/store.ts       Upstash Redis (historial, casos) + versión en memoria
scripts/chat-local.ts  probar el agente en la terminal
```

## Antes de publicar

1. Llena `src/despacho.ts` (nombre del despacho, URL del aviso de privacidad y política de honorarios).
2. Revisa `src/prompt.ts` con el abogado responsable, sobre todo lo que el agente puede y no puede decir.
3. Ajusta los pesos de `src/scoring.ts` si el despacho prioriza otra cosa.

## Simulador en línea (sin instalar nada)

`demo/` genera una página para claude.ai que usa Claude con la cuenta de quien la abre, sin clave de API ni servidor. Usa el mismo prompt, las mismas herramientas y la misma calificación de `src/`. Para regenerarla después de cambiar el prompt o la calificación: `npm run demo` (crea `demo/dist/simulador.html`) y vuelve a publicarla.

## Sandbox de pruebas

Página tipo WhatsApp para probar el agente real (mismo prompt, herramientas y calificación) sin WhatsApp ni Redis. A un lado muestra en vivo los datos del caso, la calificación y los avisos que recibiría el abogado. Trae escenarios listos (obstétrico IMSS, muerte del bebé, lipo + BBL, convenio, caso viejo, emergencia, fuera de tema) y un campo **Hoy** para simular otra fecha y probar las alertas de plazos. Nada de lo que pase ahí se guarda como caso real.

**En Vercel:** agrega la variable `SANDBOX_CLAVE` (una contraseña que tú inventas) y abre la raíz del proyecto, `https://TU-PROYECTO.vercel.app/` (también responde en `/api/sandbox`). Solo hace falta `ANTHROPIC_API_KEY`; no necesita Meta ni Upstash. Si quitas `SANDBOX_CLAVE`, la página se desactiva. La página pide la contraseña, no aparece en buscadores y las respuestas se cobran a la clave de API del proyecto.

**En `simulador.muga.com.mx`:**

1. En Vercel → el proyecto → **Settings → Domains**, agrega `simulador.muga.com.mx`.
2. En el panel donde se administra el DNS de `muga.com.mx`, crea un registro **CNAME** con nombre `simulador` y el valor que Vercel muestre (normalmente `cname.vercel-dns.com`).
3. Espera a que Vercel marque el dominio como válido (minutos, a veces hasta unas horas). El certificado HTTPS lo pone Vercel solo.
4. Abre `https://simulador.muga.com.mx`, escribe la contraseña y prueba.

La página del sandbox es la misma del simulador de claude.ai, compilada en modo servidor (`src/sandbox-pagina.generado.ts`). Si cambias `demo/`, el prompt o la calificación, corre `npm run demo`; una prueba avisa si se te olvida.

**En tu computadora:**

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm run sandbox   # abre http://localhost:3000, clave: prueba
ANTHROPIC_API_KEY=sk-ant-... npm run chat      # versión de terminal (/caso muestra el registro)
npm test                                       # pruebas automáticas, sin red
```

## Desplegar en Vercel

1. En Vercel, importa este repositorio y en **Root Directory** elige `negligencia-whatsapp-bot`.
2. En **Storage**, agrega **Upstash Redis** y conéctalo al proyecto (crea `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`).
3. En **Settings → Environment Variables**, agrega las variables de `.env.example`.
4. Despliega. La URL del webhook queda como `https://TU-PROYECTO.vercel.app/api/webhook`.

## Configurar WhatsApp (Meta)

1. En developers.facebook.com crea una app de tipo **Business** y agrega el producto **WhatsApp**.
2. Registra el número del despacho y copia el **Phone number ID** → `WHATSAPP_PHONE_NUMBER_ID`.
3. Crea un **usuario del sistema** en Business Manager con token permanente (permisos `whatsapp_business_messaging` y `whatsapp_business_management`) → `WHATSAPP_TOKEN`.
4. En **Configuración de la app → Básica** copia la **Clave secreta de la app** → `WHATSAPP_APP_SECRET`.
5. En **WhatsApp → Configuración → Webhook** pon la URL `/api/webhook` y el mismo texto de `WHATSAPP_VERIFY_TOKEN`; suscríbete al campo **messages**.
6. **Avisos al abogado**: WhatsApp solo deja mandar texto libre si el abogado escribió al número del bot en las últimas 24 h. Para que siempre llegue, crea una plantilla de categoría *Utilidad*, por ejemplo `aviso_caso_nuevo` con el cuerpo `Nuevo caso para revisar: {{1}}`, y pon su nombre en `WHATSAPP_AVISO_TEMPLATE`.

## Dónde ver los casos

Cada caso se guarda en Redis como `caso:<teléfono>`, y `casos:por_puntaje` los ordena por prioridad. Se pueden consultar desde el navegador de datos de Upstash. Los historiales de chat expiran a los `DIAS_RETENCION` días; los casos no expiran.

## Costos aproximados

- **Claude**: se usa `claude-opus-5-5` con esfuerzo `low` y caché de prompt (las instrucciones se cobran a ~10% en cada mensaje después del primero). Para bajar costo se puede cambiar `CLAUDE_MODEL=claude-sonnet-5-5`.
- **WhatsApp**: las respuestas a mensajes del cliente dentro de 24 h no tienen costo por mensaje en la Cloud API; las plantillas de aviso se cobran según la tarifa de Meta para México.
- **Vercel y Upstash**: el plan gratuito alcanza para empezar.

## Siguientes pasos sugeridos

- Comando para que el abogado **pause el bot** en una conversación cuando la tome.
- Descargar fotos y PDFs (usando el `media_id`) y guardarlos en un almacenamiento privado.
- Panel web de casos y exportación a Google Sheets o CRM.
- Anuncios de Facebook/Instagram tipo *Click to WhatsApp* que lleguen a este número.
