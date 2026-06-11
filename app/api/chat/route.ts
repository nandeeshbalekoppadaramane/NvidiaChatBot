import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Missing API Key", { status: 401 });
    }
    const apiKey = authHeader.split(" ")[1];

    const { messages, model, temperature, maxTokens } = await req.json();

    // Create a custom OpenAI client pointing to NVIDIA's endpoint
    const openai = new OpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey,
    });

    // Start stream using native OpenAI library
    const response = await openai.chat.completions.create({
      model: model || "meta/llama-3.1-70b-instruct",
      messages,
      temperature: temperature ?? 0.7,
      max_tokens: maxTokens ?? 4096,
      stream: true,
    });

    // Convert response to AI stream
    const stream = OpenAIStream(response as any);
    
    // Return standard text stream
    return new StreamingTextResponse(stream);

  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
