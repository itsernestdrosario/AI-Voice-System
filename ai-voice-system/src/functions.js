// Aquí conectas cada función a sistemas reales.
// Por ahora check_availability y create_appointment tienen datos de
// ejemplo (mock) para que puedas probar el flujo de inmediato.
// El siguiente paso es reemplazar esto por la API de Google Calendar
// (o Fresha/Booksy si el negocio ya usa uno de esos sistemas).

export async function checkAvailability({ servicio, fecha }) {
  // TODO: reemplazar por una consulta real a Google Calendar API
  // usando googleapis (calendar.freebusy.query)
  const horariosDeEjemplo = ["10:00 am", "1:00 pm", "4:00 pm"];
  return {
    servicio,
    fecha,
    horarios_disponibles: horariosDeEjemplo
  };
}

export async function createAppointment({ servicio, fecha, hora, nombre, telefono }) {
  // TODO: reemplazar por calendar.events.insert() de Google Calendar,
  // o el endpoint de creación de citas de Fresha/Booksy
  console.log("Nueva cita creada:", { servicio, fecha, hora, nombre, telefono });
  return {
    confirmado: true,
    id_cita: "cita_" + Date.now()
  };
}

export async function transferToHuman({ motivo }, callSid, twilioClient, businessNumber) {
  console.log("Transfiriendo llamada", callSid, "motivo:", motivo);
  // Redirige la llamada de Twilio en curso hacia el número real del negocio
  await twilioClient.calls(callSid).update({
    twiml: `<Response><Dial>${businessNumber}</Dial></Response>`
  });
  return { transferido: true };
}
