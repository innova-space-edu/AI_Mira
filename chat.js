// ============================
// Configuración (sin claves)
// ============================

// Endpoint relativo a tu Function en Netlify
const API_URL = "/api/chat";

// Modelo sugerido (el backend puede ignorarlo si define uno por defecto)
const MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";
// Otros posibles en Groq:
// "llama-3.3-70b-versatil", "llama-3.1-8b-instantaneo", "deepseek-r1-distilar-llama-70b"


// ============================
// Prompt del sistema
// ============================
const SYSTEM_PROMPT = `
Eres MIRA, una asistente virtual de inteligencia artificial creada por Innova Space, diseñada para apoyar a estudiantes y profesores en todas las materias escolares. Responde siempre en español, con explicaciones claras, ordenadas y fáciles de entender, adaptando el nivel de detalle según el usuario.

Cuando te pidan una **fórmula, ecuación, función matemática o científica**, sigue estos pasos:

1. **Explica primero con palabras sencillas** el concepto o significado antes de mostrar la fórmula.
2. **Luego muestra la fórmula en LaTeX** (usando signos de dólar: $...$ para fórmulas en línea o $$...$$ para fórmulas centradas).
3. **Después de la fórmula, explica cada variable o símbolo en texto plano (NO uses LaTeX ni signos de dólar, solo texto normal o Markdown)**. Escribe, por ejemplo: - **vm** es la velocidad media, - **Δx** es el cambio en la posición, - **Δt** es el intervalo de tiempo.
4. **Ofrece un ejemplo práctico o aplicación si corresponde**.

**Ejemplo de estructura ideal:**

---
La velocidad media es la variación de la posición dividida por la variación del tiempo.

La fórmula es:
$$
v_m = \\frac{\\Delta x}{\\Delta t}
$$

Donde:
- **vm** es la velocidad media
- **Δx** es el cambio en la posición
- **Δt** es el intervalo de tiempo

¿Quieres un ejemplo de cómo aplicar esta fórmula?
---

**Regla importante**:  
Cuando expliques las variables o símbolos de la fórmula, **nunca uses LaTeX ni signos de dólar ($)**. Solo texto plano, negrita o cursiva si lo deseas.

**Otras instrucciones importantes:**
- Si hay un error ortográfico o la pregunta no está clara, intenta interpretarla y responde de la mejor manera posible.
- Si la pregunta es ambigua, pide aclaración de forma breve y amable.
- Usa títulos, listas, negrita (Markdown) y estructura visualmente agradable.
- Si la respuesta es extensa, ofrece un resumen al final.
- Mantén el contexto conversacional.
- Si no sabes la respuesta, busca alternativas, ejemplos, o intenta explicarlo con lo que sabes, pero evita respuestas negativas directas.
- Si alguna variable contiene letras griegas (como Δx o θ), escribe el símbolo directamente, SIN LaTeX.

Responde con amabilidad y buen ritmo, bien puntuado para facilitar la lectura en voz alta.
`;


// ============================
// Utilidades y helpers
// ============================

function normalizeES(s) {
  return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

const WHOAMI_RE =
  /(quien eres|quién eres|quien es mira|quién es mira|presentate|preséntate|que puedes hacer|qué puedes hacer|quien eres tu|quién eres tú|quien sos|quien sos vos|que haces|qué haces|que funcion tienes|qué función tienes)/;

function cleanVariablesLatex(text) {
  // Reemplaza líneas del tipo $vm$ o $\\Delta$ por **vm**, **Δ**, etc.
  return text.replace(
    /^(\s*)\$\??(\\?(?:[a-zA-Z_0-9]+|Delta|theta|phi|pi|lambda|mu|sigma|alpha|beta|gamma))\$\s?/gm,
    (_, s, v) => {
      v = v
        .replace(/^\\?Delta$/i, "Δ")
        .replace(/^\\?theta$/i, "θ")
        .replace(/^\\?phi$/i, "φ")
        .replace(/^\\?pi$/i, "π")
        .replace(/^\\?lambda$/i, "λ")
        .replace(/^\\?mu$/i, "μ")
        .replace(/^\\?sigma$/i, "σ")
        .replace(/^\\?alpha$/i, "α")
        .replace(/^\\?beta$/i, "β")
        .replace(/^\\?gamma$/i, "γ");
      return `${s}**${v}**`;
    }
  );
}

// Avatar: halo cuando “habla”
function setAvatarTalking(isTalking) {
  const avatar = document.getElementById("avatar-mira");
  if (!avatar) return;
  avatar.classList.toggle("pulse", !!isTalking);
}

// Markdown
function renderMarkdown(text) {
  return typeof marked !== "undefined" ? marked.parse(text) : text;
}

// Escape para el input del usuario
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[m]);
}

// “Pensando…”
function showThinking() {
  const chatBox = document.getElementById("chat-box");
  if (!chatBox) return;
  if (document.getElementById("thinking")) return;
  const thinking = document.createElement("div");
  thinking.id = "thinking";
  thinking.className = "text-purple-300 italic my-1";
  thinking.innerHTML = `<span class="animate-pulse">MIRA está pensando<span class="animate-bounce">...</span></span>`;
  chatBox.appendChild(thinking);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Texto para TTS (sin LaTeX ni código)
function plainTextForVoice(markdown) {
  let text = markdown
    .split("\n")
    .filter((line) => {
      const t = line.trim();
      if (t.startsWith("```")) return false;
      if (t.startsWith("$$") || t.endsWith("$$")) return false;
      if (t.includes("$")) return false;
      return true;
    })
    .join(". ")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/__([^_]+)__/g, "$1")
    .replace(/_([^_]+)_/g, "$1")
    .replace(/([.,;:!?\)])([^\s.])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();

  text = text.replace(/\.{2,}/g, ".").replace(/\. \./g, ". ");
  return text;
}

// TTS
function speak(text) {
  try {
    const plain = plainTextForVoice(text);
    if (!plain) return;
    const msg = new SpeechSynthesisUtterance(plain);
    msg.lang = "es-ES";
    msg.rate = 1.0;
    msg.pitch = 1.0;
    window.speechSynthesis.cancel();
    setAvatarTalking(true);
    msg.onend = () => setAvatarTalking(false);
    msg.onerror = () => setAvatarTalking(false);
    window.speechSynthesis.speak(msg);
  } catch {
    setAvatarTalking(false);
  }
}

// Fallback Wikipedia (sin backend)
async function wikiFallback(query) {
  try {
    const res = await fetch(
      `https://es.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
        query
      )}`
    );
    if (!res.ok) return "";
    const data = await res.json().catch(() => ({}));
    return data?.extract || "";
  } catch {
    return "";
  }
}

// ============================
// Estado de conversación
// ============================
const chatHistory = [{ role: "system", content: SYSTEM_PROMPT }];

// API call helper
async function callAI(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const raw = await response.text();
  let data = {};
  try { data = JSON.parse(raw); } catch { data = {}; }
  if (!response.ok) {
    const errMsg = data?.error || `HTTP ${response.status}`;
    throw new Error(typeof errMsg === "string" ? errMsg : JSON.stringify(errMsg));
  }
  return data;
}

// ============================
// Render helpers públicos
// ============================

function addAssistantMessage(text) {
  const chatBox = document.getElementById("chat-box");
  const html = renderMarkdown(text);
  chatBox.innerHTML += `<div><strong>MIRA:</strong> <span class="chat-markdown">${html}</span></div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
  if (window.MathJax?.typesetPromise) MathJax.typesetPromise();
  speak(text);
}

function addUserMessage(text) {
  const chatBox = document.getElementById("chat-box");
  chatBox.innerHTML += `<div><strong>Tú:</strong> ${escapeHtml(text)}</div>`;
  chatBox.scrollTop = chatBox.scrollHeight;
}

// ============================
// Envío de mensaje
// ============================
async function sendMessage() {
  const input = document.getElementById("user-input");
  const chatBox = document.getElementById("chat-box");
  if (!input || !chatBox) return;

  const userMessage = (input.value || "").trim();
  if (!userMessage) return;

  addUserMessage(userMessage);
  input.value = "";
  showThinking();

  // Intento “quién eres”
  const norm = normalizeES(userMessage);
  if (WHOAMI_RE.test(norm)) {
    document.getElementById("thinking")?.remove();
    const aiReplyLocal =
      "Soy **MIRA**, una asistente virtual creada por **Innova Space**. Estoy diseñada para ayudarte a aprender y resolver tus dudas en todas las materias. Puedo explicarte conceptos, fórmulas (mostrando LaTeX), resolver ejercicios paso a paso, hacer resúmenes y darte ejemplos prácticos. ¿Con qué te ayudo hoy?";
    addAssistantMessage(aiReplyLocal);
    chatHistory.push({ role: "user", content: userMessage });
    chatHistory.push({ role: "assistant", content: aiReplyLocal });
    return;
  }

  // Flujo normal con Function (key segura en Netlify)
  chatHistory.push({ role: "user", content: userMessage });

  // Mantener contexto: system + últimos 8 turnos (máx ~9 elementos)
  if (chatHistory.length > 9) {
    chatHistory.splice(1, chatHistory.length - 8);
  }

  try {
    const data = await callAI({
      model: MODEL,
      messages: chatHistory,
      temperature: 0.7,
    });

    let aiReply = data?.choices?.[0]?.message?.content || "";

    if (!aiReply || /no encontr[ée] una respuesta|no se pudo/i.test(aiReply)) {
      const wikiText = await wikiFallback(userMessage);
      aiReply = wikiText || "Lo siento, no encontré una respuesta adecuada.";
    }

    aiReply = cleanVariablesLatex(aiReply);
    chatHistory.push({ role: "assistant", content: aiReply });

    document.getElementById("thinking")?.remove();
    addAssistantMessage(aiReply);
  } catch (error) {
    document.getElementById("thinking")?.remove();
    const msg = String(error?.message || error);
    const chatBox = document.getElementById("chat-box");
    chatBox.innerHTML += `<div><strong>MIRA:</strong> Error al conectar con la IA: ${escapeHtml(msg)}</div>`;
    setAvatarTalking(false);
    console.error(error);
  }
}

// ============================
// Inicio + saludo hablado
// ============================
window.addEventListener("DOMContentLoaded", () => {
  const chatBox = document.getElementById("chat-box");
  const saludo = "¡Hola! Soy MIRA, tu asistente virtual. ¿En qué puedo ayudarte hoy?";
  if (chatBox && chatBox.textContent.trim().length === 0) {
    const html = renderMarkdown(saludo);
    chatBox.innerHTML += `<div><strong>MIRA:</strong> <span class="chat-markdown">${html}</span></div>`;
  }

  // Hablar saludo (con fallback iOS/Safari)
  setTimeout(() => {
    speak(saludo);
    const unlockOnce = () => {
      window.speechSynthesis.cancel();
      speak(saludo);
      window.removeEventListener("click", unlockOnce);
      window.removeEventListener("touchend", unlockOnce);
    };
    window.addEventListener("click", unlockOnce, { once: true });
    window.addEventListener("touchend", unlockOnce, { once: true });
  }, 300);

  // Enter + botón
  const input = document.getElementById("user-input");
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  });
  document.getElementById("send-btn")?.addEventListener("click", sendMessage);

  // Halo apagado al inicio
  setAvatarTalking(false);
});

// Exponer funciones globales si hiciera falta
window.sendMessage = sendMessage;
window.addAssistantMessage = addAssistantMessage;
