# MuGa Kiosko – Datos + Utilidades

Este repo contiene:
- `/data/precios_para_asistente_normalizado.json` (EQUIPO_NORMALIZADO, PLAN, PAGO_EQUIPO, RENTA_PLAN, TOTAL_MENSUAL)
- `/data/inventario_para_asistente_normalizado.json` (EQUIPO_NORMALIZADO, PLAN, PIEZAS)

Y utilidades en TypeScript para:
- Normalizar nombres de equipo
- Buscar precio por modelo + plan
- Calcular upgrade (plan siguiente)

## Uso rápido
```bash
npm i
npx ts-node src/index.ts "iPhone 17 Pro Max 256GB" "Libre 4"
```
Edita los JSON según actualizaciones.
