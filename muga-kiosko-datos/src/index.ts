import { buscarPrecio, buscarInventario, calcularUpgrade } from "./lib/price";

async function demo() {
  const modelo = process.argv[2] || "iPhone 17 Pro Max 256GB";
  const plan = (process.argv[3] as any) || "Libre 4";
  const precio = buscarPrecio(modelo, plan);
  if (!precio) {
    console.log("No disponible");
    return;
  }
  const stock = buscarInventario(modelo);
  const up = calcularUpgrade(modelo, plan as any);

  console.log(`👉 ${modelo} en ${plan}`);
  console.log(`💳 Pago del equipo (24M): $${precio.pagoEquipo.toFixed(2)}`);
  console.log(`📅 Renta del plan: $${precio.rentaPlan.toFixed(2)}`);
  console.log(`💵 Total mensual: $${precio.totalMensual.toFixed(2)}`);
  console.log(`📦 Inventario total: ${stock} unidades disponibles`);
  if (up && up.upgrade) {
    console.log(`\n🚀 Upgrade (plan siguiente: ${up.upgrade.planSiguiente})`);
    console.log(`💳 Pago del equipo: $${up.upgrade.pagoEquipo.toFixed(2)}`);
    console.log(`📅 Renta del plan: $${up.upgrade.rentaPlan.toFixed(2)}`);
    console.log(`💵 Total mensual upgrade: $${up.upgrade.totalMensual.toFixed(2)}`);
    console.log(`🌐 Internet: ${up.upgrade.internetGB} GB (+50% extra)`);
    console.log(`📊 Diferencia: $${up.upgrade.diferencia.toFixed(2)} → ${up.upgrade.costoPorGb !== null ? "$"+up.upgrade.costoPorGb.toFixed(2)+"/GB" : "No disponible"}`);
  }
}

demo();
