// Datos del despacho que el agente puede decir a los clientes.
// EDITA ESTE ARCHIVO antes de publicar: todo lo marcado con [PENDIENTE] debe definirlo el despacho.
// Cambiarlo invalida la caché del prompt una sola vez (es normal).

export const despacho = {
  nombre: "González y Asociados",
  nombreAgente: "Sofía", // nombre del asistente virtual
  ciudad: "San Luis Potosí",
  cobertura: "toda la República Mexicana (reuniones presenciales en San Luis Potosí y en línea)",
  horario: "lunes a viernes de 9:00 a 18:00 h",
  avisoPrivacidadUrl: "[PENDIENTE: URL del aviso de privacidad]",

  // Lo que el agente puede decir sobre costos. Déjalo genérico si no quieres que hable de cifras.
  politicaHonorarios:
    "La primera evaluación del caso no tiene costo. Los honorarios se explican en la cita con el abogado; " +
    "en muchos casos se trabaja con un porcentaje sobre lo que se recupere.",
};
