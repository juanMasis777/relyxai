/* chat-widget.js — Widget de chat bilingüe (ES/EN) para Relyxai
 * Se inserta con UNA línea en tu HTML, antes de </body>:
 *
 *   <script src="/chat-widget.js"
 *           data-name="Relyxai Assistant"
 *           data-accent="#6d5efc"
 *           data-greeting-en="Hi! I'm the Relyxai assistant..."
 *           data-greeting-es="¡Hola! Soy el asistente de Relyxai..."
 *           defer></script>
 *
 * Detecta el idioma de la página automáticamente (lee tu botón #langBtn,
 * el atributo <html lang> o el navegador) y cambia en vivo al alternar ES/EN.
 * No necesitas tocar este archivo: todo se configura con los data-* de arriba.
 */
(function () {
  "use strict";
  if (window.__relyxChatLoaded) return;
  window.__relyxChatLoaded = true;

  // ── Configuración (desde el <script>) ─────────────────────────────────────
  var script = document.currentScript || (function () {
    var s = document.getElementsByTagName("script");
    return s[s.length - 1];
  })();

  var fallbackGreeting = script.getAttribute("data-greeting");
  var cfg = {
    name: script.getAttribute("data-name") || "Relyxai Assistant",
    accent: script.getAttribute("data-accent") || "#6d5efc",
    endpoint: script.getAttribute("data-endpoint") || "/api/chat",
    greeting: {
      en: script.getAttribute("data-greeting-en") || fallbackGreeting ||
          "Hi! 👋 I'm the Relyxai assistant. Ask me anything about our smart neck massager — features, shipping, returns, or your order.",
      es: script.getAttribute("data-greeting-es") || fallbackGreeting ||
          "¡Hola! 👋 Soy el asistente de Relyxai. Pregúntame lo que quieras sobre nuestro masajeador de cuello — características, envío, devoluciones o tu pedido.",
    },
  };

  // ── Textos del widget en cada idioma ───────────────────────────────────────
  var I18N = {
    en: {
      status: "Online",
      placeholder: "Type your message...",
      credit: "AI assistant",
      open: "Open chat",
      close: "Close chat",
      send: "Send message",
      input: "Message",
      error: "Oops, I had trouble responding. Please try again in a moment.",
    },
    es: {
      status: "En línea",
      placeholder: "Escribe tu mensaje...",
      credit: "Asistente con IA",
      open: "Abrir chat",
      close: "Cerrar chat",
      send: "Enviar mensaje",
      input: "Mensaje",
      error: "Ups, tuve un problema para responder. Inténtalo de nuevo en un momento.",
    },
  };

  var lang = "en";
  var isOpen = false;
  var messages = []; // historial: { role, content }

  // ── Detección de idioma ─────────────────────────────────────────────────────
  // 1) El botón #langBtn muestra el idioma AL QUE cambia: "ES" => página en EN.
  // 2) Atributo <html lang>.  3) Idioma del navegador.
  function detectLang() {
    var btn = document.getElementById("langBtn");
    if (btn) {
      var t = (btn.textContent || "").trim().toUpperCase();
      if (t === "ES") return "en";
      if (t === "EN") return "es";
    }
    var htmlLang = (document.documentElement.getAttribute("lang") || "").toLowerCase();
    if (htmlLang.indexOf("es") === 0) return "es";
    if (htmlLang.indexOf("en") === 0) return "en";
    var nav = (navigator.language || "en").toLowerCase();
    return nav.indexOf("es") === 0 ? "es" : "en";
  }

  // ── Estilos ───────────────────────────────────────────────────────────────
  var css = `
  .rlx-root{--rlx-accent:${cfg.accent};--rlx-ink:#1a1a2e;--rlx-muted:#6b7280;
    --rlx-surface:#ffffff;--rlx-bubble:#f3f4f8;--rlx-border:rgba(0,0,0,.08);
    position:fixed;bottom:20px;right:20px;z-index:2147483000;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,Helvetica,Arial,sans-serif;
    line-height:1.5;color:var(--rlx-ink)}
  .rlx-root *{box-sizing:border-box}
  .rlx-launcher{width:60px;height:60px;border-radius:50%;border:none;cursor:pointer;
    background:linear-gradient(135deg,var(--rlx-accent),color-mix(in srgb,var(--rlx-accent) 60%,#a855f7));
    box-shadow:0 8px 28px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;
    transition:transform .18s ease,box-shadow .18s ease}
  .rlx-launcher:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 12px 32px rgba(0,0,0,.28)}
  .rlx-launcher:focus-visible{outline:3px solid color-mix(in srgb,var(--rlx-accent) 40%,#fff);outline-offset:3px}
  .rlx-launcher svg{width:28px;height:28px;fill:#fff;transition:opacity .15s,transform .15s}

  .rlx-panel{position:absolute;bottom:76px;right:0;width:380px;max-width:calc(100vw - 32px);
    height:560px;max-height:calc(100vh - 110px);background:var(--rlx-surface);border-radius:18px;
    box-shadow:0 24px 60px rgba(0,0,0,.28);display:flex;flex-direction:column;overflow:hidden;
    opacity:0;transform:translateY(12px) scale(.97);pointer-events:none;
    transition:opacity .22s ease,transform .22s ease;border:1px solid var(--rlx-border)}
  .rlx-root.rlx-open .rlx-panel{opacity:1;transform:translateY(0) scale(1);pointer-events:auto}

  .rlx-header{background:linear-gradient(135deg,var(--rlx-accent),color-mix(in srgb,var(--rlx-accent) 55%,#a855f7));
    color:#fff;padding:16px 18px;display:flex;align-items:center;gap:12px}
  .rlx-avatar{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.22);
    display:flex;align-items:center;justify-content:center;flex:0 0 auto;font-weight:700;font-size:16px}
  .rlx-htext{flex:1;min-width:0}
  .rlx-htext b{display:block;font-size:15px;font-weight:600}
  .rlx-htext span.rlx-statusline{display:block;font-size:12px;opacity:.85}
  .rlx-status-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#4ade80;margin-right:5px;vertical-align:middle}
  .rlx-close{background:none;border:none;color:#fff;cursor:pointer;opacity:.85;padding:4px;border-radius:8px;line-height:0}
  .rlx-close:hover{opacity:1;background:rgba(255,255,255,.15)}
  .rlx-close svg{width:20px;height:20px;fill:#fff}

  .rlx-msgs{flex:1;overflow-y:auto;padding:18px;display:flex;flex-direction:column;gap:12px;background:#fafafb}
  .rlx-msg{max-width:84%;padding:10px 14px;border-radius:16px;font-size:14.5px;word-wrap:break-word;white-space:pre-wrap}
  .rlx-msg.bot{align-self:flex-start;background:var(--rlx-bubble);border-bottom-left-radius:5px}
  .rlx-msg.user{align-self:flex-end;color:#fff;border-bottom-right-radius:5px;
    background:linear-gradient(135deg,var(--rlx-accent),color-mix(in srgb,var(--rlx-accent) 70%,#a855f7))}

  .rlx-typing{align-self:flex-start;background:var(--rlx-bubble);padding:13px 16px;border-radius:16px;border-bottom-left-radius:5px;display:flex;gap:4px}
  .rlx-typing i{width:7px;height:7px;border-radius:50%;background:var(--rlx-muted);opacity:.5;animation:rlx-bounce 1.2s infinite}
  .rlx-typing i:nth-child(2){animation-delay:.18s}
  .rlx-typing i:nth-child(3){animation-delay:.36s}
  @keyframes rlx-bounce{0%,60%,100%{transform:translateY(0);opacity:.4}30%{transform:translateY(-5px);opacity:1}}

  .rlx-foot{border-top:1px solid var(--rlx-border);padding:12px;background:var(--rlx-surface)}
  .rlx-inputrow{display:flex;align-items:flex-end;gap:8px;background:var(--rlx-bubble);border-radius:14px;padding:6px 6px 6px 14px}
  .rlx-input{flex:1;border:none;background:none;resize:none;font:inherit;font-size:14.5px;
    color:var(--rlx-ink);max-height:120px;padding:7px 0;outline:none}
  .rlx-input::placeholder{color:var(--rlx-muted)}
  .rlx-send{border:none;cursor:pointer;width:38px;height:38px;border-radius:11px;flex:0 0 auto;
    background:var(--rlx-accent);display:flex;align-items:center;justify-content:center;transition:opacity .15s,transform .15s}
  .rlx-send:hover{transform:scale(1.05)}
  .rlx-send:disabled{opacity:.4;cursor:not-allowed;transform:none}
  .rlx-send svg{width:18px;height:18px;fill:#fff}
  .rlx-credit{text-align:center;font-size:11px;color:var(--rlx-muted);margin-top:8px}

  @media (max-width:480px){
    .rlx-root{bottom:14px;right:14px}
    .rlx-panel{height:calc(100vh - 90px);max-height:none;width:calc(100vw - 28px);bottom:72px}
  }
  @media (prefers-reduced-motion:reduce){
    .rlx-root *{transition:none!important;animation:none!important}
  }`;

  var style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);

  // ── Estructura ──────────────────────────────────────────────────────────────
  var root = document.createElement("div");
  root.className = "rlx-root";
  var initial = (cfg.name.trim()[0] || "R").toUpperCase();
  root.innerHTML = `
    <div class="rlx-panel" role="dialog" aria-label="${cfg.name}" aria-modal="false">
      <div class="rlx-header">
        <div class="rlx-avatar">${initial}</div>
        <div class="rlx-htext">
          <b>${cfg.name}</b>
          <span class="rlx-statusline"><span class="rlx-status-dot"></span><span class="rlx-status-text"></span></span>
        </div>
        <button class="rlx-close">
          <svg viewBox="0 0 24 24"><path d="M18.3 5.71 12 12.01l-6.3-6.3-1.4 1.41 6.29 6.3-6.3 6.29 1.41 1.41 6.3-6.3 6.29 6.3 1.41-1.41-6.3-6.3 6.3-6.29z"/></svg>
        </button>
      </div>
      <div class="rlx-msgs" role="log" aria-live="polite"></div>
      <div class="rlx-foot">
        <div class="rlx-inputrow">
          <textarea class="rlx-input" rows="1"></textarea>
          <button class="rlx-send" disabled>
            <svg viewBox="0 0 24 24"><path d="M2.01 21 23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </button>
        </div>
        <div class="rlx-credit"></div>
      </div>
    </div>
    <button class="rlx-launcher" aria-expanded="false">
      <svg viewBox="0 0 24 24"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
    </button>`;
  document.body.appendChild(root);

  var panel = root.querySelector(".rlx-panel");
  var msgsEl = root.querySelector(".rlx-msgs");
  var input = root.querySelector(".rlx-input");
  var sendBtn = root.querySelector(".rlx-send");
  var launcher = root.querySelector(".rlx-launcher");
  var closeBtn = root.querySelector(".rlx-close");
  var statusText = root.querySelector(".rlx-status-text");
  var creditEl = root.querySelector(".rlx-credit");

  var greetingEl = null; // burbuja de saludo (display, no entra al historial)

  // ── Aplicar idioma a toda la interfaz ───────────────────────────────────────
  function applyLang(next) {
    lang = next;
    var t = I18N[lang];
    statusText.textContent = t.status;
    creditEl.textContent = t.credit;
    input.placeholder = t.placeholder;
    input.setAttribute("aria-label", t.input);
    sendBtn.setAttribute("aria-label", t.send);
    closeBtn.setAttribute("aria-label", t.close);
    launcher.setAttribute("aria-label", isOpen ? t.close : t.open);
    // Si el saludo aún es lo único en pantalla, tradúcelo también.
    if (greetingEl && messages.length === 0) {
      greetingEl.textContent = cfg.greeting[lang];
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  function scrollDown() { msgsEl.scrollTop = msgsEl.scrollHeight; }

  function addBubble(role, text) {
    var b = document.createElement("div");
    b.className = "rlx-msg " + (role === "user" ? "user" : "bot");
    b.textContent = text;
    msgsEl.appendChild(b);
    scrollDown();
    return b;
  }

  function showTyping() {
    var el = document.createElement("div");
    el.className = "rlx-typing";
    el.innerHTML = "<i></i><i></i><i></i>";
    msgsEl.appendChild(el);
    scrollDown();
    return el;
  }

  function setOpen(open) {
    isOpen = open;
    root.classList.toggle("rlx-open", open);
    launcher.setAttribute("aria-expanded", String(open));
    launcher.setAttribute("aria-label", open ? I18N[lang].close : I18N[lang].open);
    launcher.querySelector("svg").style.opacity = open ? "0.85" : "1";
    if (open) {
      if (messages.length === 0 && !greetingEl) {
        greetingEl = addBubble("bot", cfg.greeting[lang]);
      }
      setTimeout(function () { input.focus(); }, 250);
    }
  }

  // ── Envío de mensajes ───────────────────────────────────────────────────────
  var busy = false;
  async function send() {
    var text = input.value.trim();
    if (!text || busy) return;

    busy = true;
    input.value = "";
    input.style.height = "auto";
    sendBtn.disabled = true;

    addBubble("user", text);
    messages.push({ role: "user", content: text });

    var typing = showTyping();

    try {
      var res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages }),
      });

      if (!res.ok || !res.body) throw new Error("bad response");

      typing.remove();
      var bubble = addBubble("bot", "");
      var reader = res.body.getReader();
      var decoder = new TextDecoder();
      var full = "";

      while (true) {
        var chunk = await reader.read();
        if (chunk.done) break;
        full += decoder.decode(chunk.value, { stream: true });
        bubble.textContent = full;
        scrollDown();
      }

      messages.push({ role: "assistant", content: full || "…" });
    } catch (e) {
      typing.remove();
      addBubble("bot", I18N[lang].error);
    } finally {
      busy = false;
      input.focus();
    }
  }

  // ── Eventos ─────────────────────────────────────────────────────────────────
  launcher.addEventListener("click", function () { setOpen(!isOpen); });
  closeBtn.addEventListener("click", function () { setOpen(false); });

  input.addEventListener("input", function () {
    sendBtn.disabled = input.value.trim() === "";
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  input.addEventListener("keydown", function (e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  sendBtn.addEventListener("click", send);

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && isOpen) setOpen(false);
  });

  // ── Seguir el cambio de idioma del sitio (botón ES/EN) ─────────────────────
  function refreshLang() {
    var next = detectLang();
    if (next !== lang) applyLang(next);
  }

  var langBtn = document.getElementById("langBtn");
  if (langBtn) {
    // Tras el clic, main.js actualiza el texto; releemos un instante después.
    langBtn.addEventListener("click", function () { setTimeout(refreshLang, 60); });
    try {
      new MutationObserver(refreshLang).observe(langBtn, {
        childList: true, characterData: true, subtree: true,
      });
    } catch (e) {}
  }
  try {
    new MutationObserver(refreshLang).observe(document.documentElement, {
      attributes: true, attributeFilter: ["lang"],
    });
  } catch (e) {}

  // Idioma inicial.
  applyLang(detectLang());
})();
