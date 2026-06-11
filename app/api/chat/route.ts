import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import * as cheerio from "cheerio";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response("Missing API Key", { status: 401 });
    }
    const apiKey = authHeader.split(" ")[1];

    const { messages, model, temperature, webSearchEnabled } = await req.json();

    // Create a custom OpenAI client pointing to NVIDIA's endpoint
    const openai = new OpenAI({
      baseURL: NVIDIA_BASE_URL,
      apiKey,
    });

    // Parse messages to handle vision images
    const formattedMessages = messages.map((msg: any) => {
      // Check if there's an attached image (sent via data object from frontend)
      if (msg.role === 'user' && msg.data && msg.data.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.data.imageUrl } }
          ]
        };
      }
      
      // Clean up internal properties that OpenAI API doesn't accept
      const { data, id, ...cleanMsg } = msg;
      return cleanMsg;
    });

    if (webSearchEnabled) {
      const lastUserMsg = [...formattedMessages].reverse().find(m => m.role === 'user');
      if (lastUserMsg) {
        let query = "";
        if (typeof lastUserMsg.content === 'string') {
          query = lastUserMsg.content;
        } else if (Array.isArray(lastUserMsg.content)) {
          const textPart = lastUserMsg.content.find((c: any) => c.type === 'text');
          if (textPart) query = textPart.text;
        }

        if (query.trim().length > 0) {
          try {
            // Use custom scraper to bypass bot protection on official DDG API
            const searchRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`, {
              headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
              }
            });
            const html = await searchRes.text();
            const $ = cheerio.load(html);
            
            const results: any[] = [];
            $('.result').each((i, el) => {
              if (i >= 5) return; // limit to top 5
              const title = $(el).find('.result__title').text().trim();
              const snippet = $(el).find('.result__snippet').text().trim();
              let url = $(el).find('.result__url').attr('href') || $(el).find('.result__a').attr('href') || "";
              
              if (url.includes('uddg=')) {
                const match = url.match(/uddg=([^&]+)/);
                if (match) url = decodeURIComponent(match[1]);
              }
              
              if (title && snippet) {
                results.push({ title, snippet, url });
              }
            });

            if (results.length === 0) {
               throw new Error("No results found or search blocked.");
            }
            
            const contextText = results.map((r, i) => `[${i + 1}] Title: ${r.title}\nURL: ${r.url}\nSnippet: ${r.snippet}`).join('\n\n');
            
            const systemSearchPrompt = `You are an AI assistant equipped with real-time web search capabilities.
The user asked: "${query}"

To help you answer, a live web search was performed. Here are the top results:

${contextText}

INSTRUCTIONS:
1. Formulate a highly accurate and helpful answer based ONLY on these search results.
2. IMPORTANT: You MUST actively cite your sources inline using the URLs provided. Format citations as [Title](URL).
3. If the search results do not contain the exact answer, rely on your internal knowledge but explicitly mention that the live search did not find specific details.`;

            // Prepend or replace system message
            if (formattedMessages[0]?.role === 'system') {
              formattedMessages[0].content = formattedMessages[0].content + "\n\n" + systemSearchPrompt;
            } else {
              formattedMessages.unshift({
                role: 'system',
                content: systemSearchPrompt
              });
            }
          } catch (searchError: any) {
            console.error("Web Search Error:", searchError);
            const errorPrompt = `The user enabled Web Search for the query: "${query}", but the live web search failed (Error: ${searchError.message || searchError}). 
INSTRUCTIONS:
1. Politely inform the user that the live web search was blocked or failed.
2. Answer their question to the best of your ability using your internal knowledge.`;

            if (formattedMessages[0]?.role === 'system') {
              formattedMessages[0].content = formattedMessages[0].content + "\n\n" + errorPrompt;
            } else {
              formattedMessages.unshift({
                role: 'system',
                content: errorPrompt
              });
            }
          }
        }
      }
    }

    // Start stream using native OpenAI library
    const payload: any = {
      model: model || "meta/llama-3.1-70b-instruct",
      messages: formattedMessages,
      temperature: temperature ?? 0.7,
      stream: true,
    };

    const response = await openai.chat.completions.create(payload);

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
