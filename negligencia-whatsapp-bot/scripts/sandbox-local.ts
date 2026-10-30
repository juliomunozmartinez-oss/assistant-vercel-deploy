// Sandbox en tu computadora:
//   ANTHROPIC_API_KEY=... SANDBOX_CLAVE=prueba npm run sandbox
// y abre http://localhost:3000
import { createServer } from "node:http";
import { manejarSandbox } from "../src/sandbox.js";

process.env.SANDBOX_CLAVE ??= "prueba";
const puerto = Number(process.env.PORT ?? 3000);

createServer(async (req, res) => {
  const cuerpo: Buffer[] = [];
  for await (const parte of req) cuerpo.push(parte as Buffer);
  const request = new Request(`http://localhost:${puerto}${req.url}`, {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: req.method === "GET" || req.method === "HEAD" ? undefined : Buffer.concat(cuerpo),
  });
  const response = await manejarSandbox(request);
  res.writeHead(response.status, Object.fromEntries(response.headers));
  res.end(Buffer.from(await response.arrayBuffer()));
}).listen(puerto, () => {
  console.log(`Sandbox en http://localhost:${puerto}  (clave: ${process.env.SANDBOX_CLAVE})`);
});
