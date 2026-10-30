import { manejarSandbox } from "../src/sandbox.js";

// Página de pruebas en /api/sandbox (solo si existe la variable SANDBOX_CLAVE).
export const GET = manejarSandbox;
export const POST = manejarSandbox;
