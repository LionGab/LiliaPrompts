const Anthropic = require("@anthropic-ai/sdk");

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const SYSTEM_PROMPT = `Você é um especialista em React Hooks.

Crie hooks bem estruturados com:
- JSDoc completo
- Comentários explicativos
- Tratamento de erros
- Exemplos de uso
- Compatível com React 18+`;

function validateUserPrompt(prompt) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt inválido");
  }
  if (prompt.length > 2000) {
    throw new Error("Prompt muito longo");
  }
  if (prompt.length < 10) {
    throw new Error("Prompt muito curto");
  }
  return prompt.trim();
}

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({ error: "Use POST" }),
    };
  }

  try {
    let body;
    try {
      body = JSON.parse(event.body);
    } catch (error) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "JSON invalido" }),
      };
    }

    const { prompt } = body;
    const validatedPrompt = validateUserPrompt(prompt);

    if (!process.env.CLAUDE_API_KEY) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Key nao configurada" }),
      };
    }

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 2048,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: validatedPrompt }],
    });

    const generatedHooks = message.content[0].type === "text" ? message.content[0].text : "";

    if (!generatedHooks) {
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Resposta vazia" }),
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
      body: JSON.stringify({
        success: true,
        hooks: generatedHooks,
        metadata: {
          model: message.model,
          usage: {
            input_tokens: message.usage.input_tokens,
            output_tokens: message.usage.output_tokens,
          },
        },
      }),
    };
  } catch (error) {
    console.error("Erro:", error);

    if (error.status === 401) {
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Key invalida" }),
      };
    }

    if (error.status === 429) {
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Rate limit atingido" }),
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || "Erro ao gerar" }),
    };
  }
};
