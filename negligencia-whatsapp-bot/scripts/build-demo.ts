// Genera demo/dist/simulador.html: la página del simulador en línea con el prompt,
// las herramientas y la calificación de src/ ya incluidos.
//   npm run demo
import { build } from "esbuild";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const { outputFiles } = await build({
  entryPoints: ["demo/app.ts"],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2020",
  minify: true,
  legalComments: "none",
});
const js = outputFiles[0].text.replace(/<\/(script)/gi, "<\\/$1");
const html = readFileSync("demo/pagina.html", "utf8").replace("/*APP*/", () => js);
mkdirSync("demo/dist", { recursive: true });
writeFileSync("demo/dist/simulador.html", html);
console.log(`demo/dist/simulador.html (${(html.length / 1024).toFixed(0)} KB)`);
