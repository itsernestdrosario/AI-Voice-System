import "dotenv/config";
import express from "express";
import { WebSocketServer } from "ws";
import twilio from "twilio";
import { createClient as createDeepgramClient } from "@deepgram/sdk";
import Anthropic from "@anthropic-ai/sdk";
import fetch from "node-fetch";
import { SYSTEM_PROMPT, TOOLS } from "./src/agent.js";
import { checkAvailability, createAppointment, transferToHuman } from "./src/functions.js";

const app = express();
const PORT = process.env.PORT || 3000;

const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const deepgram = createDeepgramClient(process.env.DEEPGRAM_API_KEY);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// 1. Twilio llama aquí cuando entra una llamada al número comprado.
// Respondemos con TwiML que abre un stream de audio en vivo hacia
// nuestro WebSocket (/media).
app.post("/voice", express.urlencoded({ extended: false }), (req, res) => {
  const host = req.headers.host;
  res.type("text/xml");
  res.send(`
    <Response>
      <Connect>
        <Stream url="wss://${host}/media" />
      </Connect>
    </Response>
  `);
});

const server = app.listen(PORT, () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});

// 2. El WebSocket recibe el audio de la llamada en tiempo real
const wss = new WebSocketServer({ server, path: "/media" });

wss.on("connection", (twilioWs) => {
  let callSid = null;
  let conversation = [];

  // Conexión en vivo a Deepgram para transcribir lo que dice el cliente
  const dgConnection = deepgram.listen.live({
    model: "nova-2",
    language: "es",
    encoding: "mulaw",
    sample_rate: 8000,
    smart_format: true
  });

  dgConnection.on("Results", async (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript || !data.is_final) return;

    conversation.push({ role: "user", content: transcript });
    const respuesta = await pensarConClaude(conversation, callSid);
    conversation.push({ role: "assistant", content: respuesta.textoParaElCliente });

    const audioBuffer = await textoAVoz(respuesta.textoParaElCliente);
    enviarAudioATwilio(twilioWs, audioBuffer);
  });

  twilioWs.on("message", (msg) => {
    const data = JSON.parse(msg);
    if (data.event === "start") {
      callSid = data.start.callSid;
    }
    if (data.event === "media") {
      dgConnection.send(Buffer.from(data.media.payload, "base64"));
    }
    if (data.event === "stop") {
      dgConnection.finish();
    }
  });

  // 3. Le pasa la conversación a Claude, y ejecuta las funciones
  // (herramientas) que decida usar: consultar disponibilidad, crear
  // la cita, o transferir la llamada a un humano.
  async function pensarConClaude(mensajes, callSid) {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: mensajes
    });

    const toolUse = response.content.find((b) => b.type === "tool_use");
    if (!toolUse) {
      const textBlock = response.content.find((b) => b.type === "text");
      return { textoParaElCliente: textBlock?.text || "" };
    }

    let resultado;
    if (toolUse.name === "check_availability") {
      resultado = await checkAvailability(toolUse.input);
    } else if (toolUse.name === "create_appointment") {
      resultado = await createAppointment(toolUse.input);
    } else if (toolUse.name === "transfer_to_human") {
      resultado = await transferToHuman(
        toolUse.input,
        callSid,
        twilioClient,
        process.env.BUSINESS_TRANSFER_NUMBER
      );
    }

    // Le devolvemos el resultado de la función a Claude para que
    // formule la respuesta final en lenguaje natural
    mensajes.push({ role: "assistant", content: response.content });
    mensajes.push({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: toolUse.id, content: JSON.stringify(resultado) }]
    });
    const followUp = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system: SYSTEM_PROMPT,
      tools: TOOLS,
      messages: mensajes
    });
    const textBlock = followUp.content.find((b) => b.type === "text");
    return { textoParaElCliente: textBlock?.text || "" };
  }

  // 4. Convierte la respuesta en texto a audio real (voz) via ElevenLabs
  async function textoAVoz(texto) {
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID}/stream?output_format=ulaw_8000`,
      {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: texto, model_id: "eleven_multilingual_v2" })
      }
    );
    return Buffer.from(await res.arrayBuffer());
  }

  // 5. Envía el audio de vuelta a Twilio para que el cliente lo escuche
  function enviarAudioATwilio(ws, audioBuffer) {
    const payload = audioBuffer.toString("base64");
    ws.send(JSON.stringify({ event: "media", media: { payload } }));
  }

  twilioWs.on("close", () => {
    dgConnection.finish();
  });
});
