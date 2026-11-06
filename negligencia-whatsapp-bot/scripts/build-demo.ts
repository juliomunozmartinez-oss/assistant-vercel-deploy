// Genera las dos versiones del simulador a partir de demo/app.ts y demo/pagina.html:
// - demo/dist/simulador.html       → página para claude.ai (usa Claude de quien la abre)
// - src/sandbox-pagina.generado.ts → página que sirve /api/sandbox en Vercel
//   npm run demo   (córrelo después de cambiar el prompt, las herramientas o la página)
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

async function compilar(modo: "claude" | "servidor"): Promise<string> {
  const { outputFiles } = await build({
    entryPoints: ["demo/app.ts"],
    bundle: true,
    write: false,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    define: { __MODO__: JSON.stringify(modo) },
  });
  const js = outputFiles[0].text.replace(/<\/(script)/gi, "<\\/$1");
  return readFileSync("demo/pagina.html", "utf8").replace("/*APP*/", () => js);
}

export async function generar() {
  const simulador = await compilar("claude");
  // claude.ai agrega doctype y head al publicar; en Vercel la página va completa.
  const documento =
    '<!doctype html><html lang="es"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
    '<meta name="robots" content="noindex,nofollow">' +
    "<style>body{margin:0}img{max-width:100%}</style></head><body>" +
    (await compilar("servidor")) +
    "</body></html>";
  const sandbox =
    "// ARCHIVO GENERADO por scripts/build-demo.ts (npm run demo). No lo edites a mano.\n" +
    `export const PAGINA = ${JSON.stringify(documento)};\n`;
  return { simulador, sandbox };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { simulador, sandbox } = await generar();
  mkdirSync("demo/dist", { recursive: true });
  writeFileSync("demo/dist/simulador.html", simulador);
  writeFileSync("src/sandbox-pagina.generado.ts", sandbox);
  console.log(`demo/dist/simulador.html (${(simulador.length / 1024).toFixed(0)} KB)`);
  console.log(`src/sandbox-pagina.generado.ts (${(sandbox.length / 1024).toFixed(0)} KB)`);
}
