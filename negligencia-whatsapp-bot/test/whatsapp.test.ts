import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { extraerMensajes, firmaValida, partirTexto } from "../src/whatsapp.js";

test("firmaValida", () => {
  const cuerpo = '{"a":1}';
  const firma = "sha256=" + createHmac("sha256", "secreto").update(cuerpo).digest("hex");
  assert.equal(firmaValida(cuerpo, firma, "secreto"), true);
  assert.equal(firmaValida(cuerpo, firma, "otro"), false);
  assert.equal(firmaValida(cuerpo, null, "secreto"), false);
  assert.equal(firmaValida(cuerpo, "sha256=abc", "secreto"), false);
});

test("extraerMensajes: texto, imagen con pie, documento y estados", () => {
  const payload = {
    entry: [{ changes: [{ value: {
      contacts: [{ wa_id: "5214441111111", profile: { name: "María" } }],
      messages: [
        { id: "m1", from: "5214441111111", type: "text", text: { body: "Hola" } },
        { id: "m2", from: "5214441111111", type: "image", image: { id: "IMG1", caption: "mi herida" } },
        { id: "m3", from: "5214441111111", type: "document", document: { id: "DOC1", filename: "expediente.pdf" } },
      ],
      statuses: [{ id: "x", status: "delivered" }],
    } }] }],
  };
  const ms = extraerMensajes(payload);
  assert.equal(ms.length, 3);
  assert.deepEqual(ms[0], { id: "m1", telefono: "5214441111111", nombrePerfil: "María", texto: "Hola" });
  assert.equal(ms[1].texto, '[El usuario envió una imagen con el texto: "mi herida"] [media_id IMG1]');
  assert.equal(ms[2].texto, "[El usuario envió un documento (archivo: expediente.pdf)] [media_id DOC1]");
  assert.deepEqual(extraerMensajes({ entry: [{ changes: [{ value: { statuses: [{}] } }] }] }), []);
});

test("partirTexto respeta el máximo", () => {
  const largo = Array.from({ length: 50 }, (_, i) => `Párrafo ${i} `.repeat(20)).join("\n");
  const partes = partirTexto(largo, 1000);
  assert.ok(partes.length > 1);
  assert.ok(partes.every((p) => p.length <= 1000));
  assert.equal(partes.join("\n").replace(/\n/g, ""), largo.replace(/\n/g, ""));
});
