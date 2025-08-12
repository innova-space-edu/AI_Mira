// netlify/functions/chat.js
// Serverless Function que puentea tu frontend con Groq (OpenAI-compatible).
// Usa la clave segura del entorno: GROQ_API_KEY (configúrala en Netlify).

export async function handler(event) {
  // Preflight CORS
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
    return json({ error: "Method Not Allowed" }, 405);
  }

  try {
    const { model, messages, temperature = 0.7 } = JSON.parse(event.body || "{}");

    if (!Array.isArray(messages) || messages.length === 0) {
      return json({ error: "messages[] requerido" }, 400);
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return json({ error: "Falta GROQ_API_KEY en variables de entorno" }, 500);
    }

    // Helper para llamar a Groq
    const callGroq = async (msgs) => {
      const resp = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: model || "meta-llama/llama-4-scout-17b-16e-instruct",
          messages: msgs,
          temperature,
        }),
      });
      const text = await resp.text();
      let data;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }
      return { resp, data };
    };

    // Llamada normal
    let { resp, data } = await callGroq(messages);

    // Fallback: si algún despliegue se queja de "property 'system' is unsupported",
    // reintenta transformando el primer system -> user (muy raro, pero robusto).
    if (!resp.ok) {
      const msgStr = JSON.stringify(data);
      if (/property\s+'system'\s+is\s+unsupported/i.test(msgStr)) {
        const msgsNoSystem = messages.map((m, i) =>
          i === 0 && m?.role === "system"
            ? { role: "user", content: m.content }
            : m
        );
        ({ resp, data } = await callGroq(msgsNoSystem));
      }
    }

    if (!resp.ok) {
      // Retorna el error real de Groq
      return json({ error: data?.error || data }, resp.status || 500);
    }

    // Éxito
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify(data),
    };
  } catch (err) {
    return json({ error: String(err?.message || err) }, 500);
  }
}

// Helper JSON
function json(obj, statusCode = 200) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
    body: JSON.stringify(obj),
  };
}
