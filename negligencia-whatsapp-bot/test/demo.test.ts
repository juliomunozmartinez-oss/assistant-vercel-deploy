import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { generar } from "../scripts/build-demo.js";

test("la página del sandbox está al día con demo/ y src/ (si falla: npm run demo)", async () => {
  const { sandbox } = await generar();
  assert.equal(readFileSync("src/sandbox-pagina.generado.ts", "utf8"), sandbox);
});
