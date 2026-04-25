// api/chat.js
// Endpoint seguro para Vercel: /api/chat
// Variable requerida en Vercel: GROQ_API_KEY

const DEFAULT_MODEL = "meta-llama/llama-4-scout-17b-16e-instruct";

function sendJson(res, status, obj) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.end(JSON.stringify(obj));
}

module.exports = async function handler(req, res) {
  if (req.method === "OPTIONS") return sendJson(res, 204, {});
  if (req.method !== "POST") return sendJson(res, 405, { error: "Method Not Allowed" });

  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return sendJson(res, 500, {
        error: "Falta la variable GROQ_API_KEY en Vercel → Settings → Environment Variables.",
      });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    const {
      model = DEFAULT_MODEL,
      messages,
      temperature = 0.45,
      max_tokens = 1200,
    } = body;

    if (!Array.isArray(messages) || messages.length === 0) {
      return sendJson(res, 400, { error: "messages[] requerido" });
    }

    const safeMessages = messages
      .filter((m) => m && typeof m.content === "string" && ["system", "user", "assistant"].includes(m.role))
      .slice(-12);

    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: safeMessages,
        temperature,
        max_tokens,
      }),
    });

    const text = await resp.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }

    if (!resp.ok) {
      return sendJson(res, resp.status || 500, {
        error: data?.error?.message || data?.error || data || "Error al llamar a Groq",
      });
    }

    return sendJson(res, 200, data);
  } catch (err) {
    return sendJson(res, 500, { error: String(err?.message || err) });
  }
};
