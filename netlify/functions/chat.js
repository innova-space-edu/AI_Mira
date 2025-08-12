// netlify/functions/chat.js
export async function handler(event) {
  // Preflight CORS (por si accedes desde otro origen en el futuro)
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Method Not Allowed" }),
    };
  }

  try {
    const { model, messages, temperature = 0.7 } = JSON.parse(event.body || "{}");

    if (!Array.isArray(messages) || messages.length === 0) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "messages[] requerido" }),
      };
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Falta GROQ_API_KEY en variables de entorno" }),
      };
    }

    // Llama al endpoint OpenAI-compatible de Groq
    const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model || "meta-llama/llama-4-scout-17b-16e-instruct",
        messages,
        temperature,
        // Si alguna vez vieras "property 'system' is unsupported",
        // puedes transformar el primer 'system' a 'user' aquí como fallback.
      }),
    });

    const data = await resp.json();
    if (!resp.ok) {
      return {
        statusCode: resp.status,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: data?.error || data }),
      };
    }

    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        // Mismo origen: no hace falta CORS, pero lo dejamos abierto por si expandes.
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: String(err?.message || err) }),
    };
  }
}
