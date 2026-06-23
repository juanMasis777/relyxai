// api/chat.js
// Función serverless de Vercel que conecta tu widget con la IA de Claude.
// La API key NUNCA llega al navegador: vive solo aquí, en el servidor.
//
// Configura tu key en Vercel:  Settings → Environment Variables → ANTHROPIC_API_KEY

// ─────────────────────────────────────────────────────────────────────────────
// PERSONALIDAD DEL ASISTENTE (ya cargada con la info de Relyxai).
// Revisa el bloque CONTACTO y ajusta cualquier dato que cambie.
// ─────────────────────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `Eres el asistente virtual de Relyxai (relyxai.com), una tienda online
de un masajeador de cuello inteligente.

PRODUCTO — Relyxai Smart Neck Relief:
- Masajeador de cuello con terapia EMS (estimulación muscular eléctrica) + calor.
- Ayuda a relajar el cuello y aliviar tensión, rigidez y estrés del día a día.
- Pensado para usar en casa tras el trabajo, conducir, entrenar o muchas horas de pantalla.

PRECIO Y OFERTA:
- Precio de lanzamiento: \$31.99 USD (precio regular \$59.99).

CARACTERÍSTICAS:
- 6 modos de masaje (incluye Masaje, Acupuntura, Raspado/Scraping y Pulsación).
- 9 niveles de intensidad, de suave a fuerte.
- Calor suave de hasta 42°C para mayor confort.
- Sesiones cortas de unos 15 minutos.
- Recargable por cable USB estándar; carga completa en ~3 horas; varias sesiones por carga.
- Ligero, portátil y sin cables durante el uso.

ENVÍO, GARANTÍA Y PAGO:
- Envío GRATIS en todo Estados Unidos.
- Devoluciones dentro de 30 días.
- 1 año de garantía.
- Pago seguro con Stripe. Para comprar: botón "Buy Now" / sección de pedido en la web.

CONTACTO:
- Página de contacto: relyxai.com/contact.html  [ajusta o añade email/redes si quieres]

IMPORTANTE (legal y seguridad):
- Relyxai es un producto de bienestar, NO un dispositivo médico. No está pensado para
  diagnosticar, tratar, curar ni prevenir enfermedades.
- Nunca des consejo médico ni hagas promesas de salud. Si la persona menciona dolor
  fuerte, lesiones o dudas médicas, recomiéndale consultar a un profesional de la salud.

TU FORMA DE ATENDER:
- Responde de forma cálida, breve y clara. Ve al grano y ayuda a decidir/comprar.
- Contesta SIEMPRE en el mismo idioma en que te escriba la persona (español o inglés).
- Si no sabes algo o requiere a una persona del equipo, dilo con honestidad y ofrece
  tomar su correo para que el equipo le contacte. No inventes datos, precios ni fechas.`;

// Modelo: Haiku es rápido y económico (ideal para un chat de web).
// Para respuestas más elaboradas, cambia a: "claude-sonnet-4-6"
const MODEL = "claude-haiku-4-5-20251001";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "Falta ANTHROPIC_API_KEY en las variables de entorno." });
    return;
  }

  try {
    const { messages } = req.body || {};
    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: "Se requiere un arreglo 'messages'." });
      return;
    }

    // Limitamos el historial para controlar costos (últimos 20 turnos).
    const trimmed = messages.slice(-20).map((m) => ({
      role: m.role === "assistant" ? "assistant" : "user",
      content: String(m.content || "").slice(0, 4000),
    }));

    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: SYSTEM_PROMPT,
        messages: trimmed,
        stream: true,
      }),
    });

    if (!upstream.ok || !upstream.body) {
      const detail = await upstream.text().catch(() => "");
      res.status(502).json({ error: "Error al contactar la IA.", detail });
      return;
    }

    // Reenviamos solo el texto al navegador, en streaming (aparece palabra por palabra).
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");

    const reader = upstream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split("\n");
      buffer = lines.pop() || ""; // guardamos la línea incompleta

      for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine.startsWith("data:")) continue;
        const payload = trimmedLine.slice(5).trim();
        if (!payload || payload === "[DONE]") continue;

        try {
          const evt = JSON.parse(payload);
          if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
            res.write(evt.delta.text);
          }
        } catch {
          /* ignoramos fragmentos no-JSON */
        }
      }
    }

    res.end();
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({ error: "Error interno del servidor." });
    } else {
      res.end();
    }
  }
}
