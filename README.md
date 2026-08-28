# Tu propio sistema de AI Voice (motor propio, sin mensualidad de terceros)

Este es un backend completo que TÚ controlas: recibe llamadas telefónicas
reales, entiende lo que dice el cliente, decide qué responder usando la
API de Claude, agenda la cita en un calendario y puede transferir a un
humano. No depende de Retell, Vapi ni Synthflow — es tu propio producto,
listo para ponerle tu marca y venderlo a negocios.

## Arquitectura (cómo fluye una llamada)

```
Cliente llama al número
        |
        v
   Twilio (telefonía) ---- webhook ----> tu servidor (server.js)
        |                                       |
        | <---- audio en vivo (WebSocket) ----> |
        |                                       |
        |                              Deepgram (voz -> texto)
        |                                       |
        |                              Claude API (decide qué responder,
        |                                          y llama funciones:
        |                                          check_availability,
        |                                          create_appointment,
        |                                          transfer_to_human)
        |                                       |
        |                              ElevenLabs (texto -> voz)
        |                                       |
        | <------- audio de respuesta ----------|
        v
   Cliente escucha la respuesta
```

## Costo real (aprox, pagando directo, sin intermediario)

- Twilio (número + minutos): ~$0.014/min entrante en EE.UU.
- Deepgram (voz a texto en tiempo real): ~$0.005-0.01/min
- Claude API (el cerebro): centavos por llamada, depende de la duración
- ElevenLabs (texto a voz): ~$0.02-0.05/min según plan

Total aproximado: **$0.05-0.10 por minuto de llamada, todo tuyo, sin
mensualidad de plataforma**. Para un salón con 100-300 min/mes, hablamos
de $10-30/mes en costos reales — tú le cobras al negocio $150-500/mes
y el margen es tuyo.

## Qué necesitas crear (cuentas, no código)

1. Cuenta de Twilio + comprar un número (unos $1/mes + uso)
2. Cuenta de Deepgram (tiene tier gratis para probar)
3. Tu API key de Anthropic (ya la usas)
4. Cuenta de ElevenLabs (o alternativa más barata como Cartesia/PlayHT)
5. Un servidor donde correr esto 24/7 (Render, Railway, un VPS de
   DigitalOcean ~$6/mes) — este código está listo para desplegar en
   cualquiera de esos

## Archivos de este proyecto

- `server.js` — el servidor principal: recibe la llamada de Twilio,
  abre el stream de audio, coordina STT -> Claude -> TTS
- `src/agent.js` — la lógica del agente: el prompt del sistema y las
  funciones (herramientas) que puede usar
- `src/functions.js` — las funciones reales: consultar disponibilidad,
  crear la cita, transferir a humano (aquí conectas tu calendario real)
- `.env.example` — dónde van tus API keys (nunca subas el `.env` real
  a ningún repositorio público)

## Cómo correrlo

```bash
npm install
cp .env.example .env
# rellena .env con tus API keys reales
npm start
```

Luego apuntas el webhook de tu número de Twilio a:
`https://tu-servidor.com/voice`

## Siguiente paso honesto

Este scaffold te da la arquitectura completa y funcional. Antes de
ponerlo en producción con clientes reales, hay que:
1. Conectar `src/functions.js` a tu calendario real (Google Calendar API)
2. Probarlo con llamadas reales y ajustar el prompt en `src/agent.js`
3. Manejar errores de red / reconexión del WebSocket
4. Desplegarlo en un servidor con buena latencia hacia EE.UU./LatAm

Puedo ayudarte con cada uno de estos pasos, uno a la vez.
