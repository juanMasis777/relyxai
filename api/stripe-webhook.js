import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Stripe necesita el cuerpo crudo (sin parsear) para verificar la firma
export const config = {
api: { bodyParser: false },
};

async function leerBodyCrudo(readable) {
const chunks = [];
for await (const chunk of readable) {
chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
}
return Buffer.concat(chunks);
}

export default async function handler(req, res) {
if (req.method !== "POST") {
return res.status(405).send("Método no permitido");
}

const firma = req.headers["stripe-signature"];
const bodyCrudo = await leerBodyCrudo(req);

let evento;
try {
// Verifica que el aviso venga REALMENTE de Stripe (seguridad)
evento = stripe.webhooks.constructEvent(
    bodyCrudo,
    firma,
    process.env.STRIPE_WEBHOOK_SECRET
);
} catch (err) {
console.error("Firma inválida:", err.message);
return res.status(400).send(`Webhook Error: ${err.message}`);
}

// Solo nos interesa cuando un pago se completa
if (evento.type === "checkout.session.completed") {
const venta = evento.data.object;

const monto = (venta.amount_total / 100).toFixed(2);
const moneda = (venta.currency || "usd").toUpperCase();
const nombre = venta.customer_details?.name || "Cliente";
const email = venta.customer_details?.email || "sin email";

const mensaje =
    `🎉 <b>¡NUEVA VENTA en Relyxai!</b>\n\n` +
    `💰 ${monto} ${moneda}\n` +
    `👤 ${nombre}\n` +
    `📧 ${email}`;

try {
    await enviarTelegram(mensaje);
} catch (err) {
    // No fallamos el webhook aunque el Telegram falle:
    // si devolviéramos error, Stripe reintentaría el aviso.
    console.error("Error enviando Telegram:", err.message);
}
}

// Siempre respondemos 200 para que Stripe sepa que recibimos el aviso
return res.status(200).json({ received: true });
}

async function enviarTelegram(texto) {
const token = process.env.TELEGRAM_TOKEN;     // token que te dio @BotFather
const chatId = process.env.TELEGRAM_CHAT_ID;  // tu chat id (un número)

const url = `https://api.telegram.org/bot${token}/sendMessage`;

const respuesta = await fetch(url, {
method: "POST",
headers: { "Content-Type": "application/json" },
body: JSON.stringify({
    chat_id: chatId,
    text: texto,
    parse_mode: "HTML",
}),
});

if (!respuesta.ok) {
const detalle = await respuesta.text();
throw new Error(`Telegram respondió ${respuesta.status}: ${detalle}`);
}
}