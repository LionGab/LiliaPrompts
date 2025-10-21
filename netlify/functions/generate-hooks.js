import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

const SYSTEM_PROMPT = `Você é um especialista em criação de conteúdo viral para redes sociais.

Crie roteiros persuasivos e autênticos que convertem, seguindo estrutura de gancho, contexto, revelação e CTA.`;

function validateUserPrompt(prompt) {
  if (!prompt || typeof prompt !== "string") {
    throw new Error("Prompt inválido");
  }
  if (prompt.length > 10000) {
    throw new Error("Prompt muito longo (máximo 10000 caracteres)");
  }
  if (prompt.length < 10) {
    throw new Error("Prompt muito curto");
  }
  return prompt.trim();
}

export const handler = async (event, context) => {
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
      console.error("CLAUDE_API_KEY not found in environment variables");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Key nao configurada" }),
      };
    }

    console.log("API Key detected:", process.env.CLAUDE_API_KEY.substring(0, 10) + "...");
    console.log("Making request to Anthropic API...");

    const message = await client.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 4096,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: validatedPrompt }],
    });

    console.log("Response received successfully");

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
    console.error("Full error object:", JSON.stringify(error, null, 2));
    console.error("Error message:", error.message);
    console.error("Error status:", error.status);

    if (error.status === 401) {
      console.error("401 Unauthorized - API Key may be invalid or expired");
      return {
        statusCode: 401,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "API Key invalida ou expirada" }),
      };
    }

    if (error.status === 429) {
      console.error("429 Rate limit exceeded");
      return {
        statusCode: 429,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Rate limit atingido" }),
      };
    }

    if (error.status === 500) {
      console.error("500 Server error from Anthropic");
      return {
        statusCode: 500,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ error: "Erro no servidor Anthropic" }),
      };
    }

    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: error.message || "Erro ao gerar" }),
    };
  }
};
