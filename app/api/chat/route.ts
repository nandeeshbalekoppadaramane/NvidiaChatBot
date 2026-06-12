import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import * as cheerio from "cheerio";
import { getModelConfig, DEFAULT_MAX_TOKENS } from "@/lib/model-config";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

const SEARCH_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Web Search Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a URL and extract the main text content using cheerio.
 * Returns empty string on any failure (timeout, non-HTML, network error).
 */
async function fetchPageContent(
  url: string,
  maxChars: number = 2500
): Promise<string> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(url, {
      headers: { "User-Agent": SEARCH_USER_AGENT },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (!res.ok) return "";

    const contentType = res.headers.get("content-type") || "";
    if (!contentType.includes("text/html")) return "";

    const html = await res.text();
    const $ = cheerio.load(html);

    // Strip non-content elements
    $(
      "script, style, nav, footer, header, aside, iframe, noscript, svg, form, button, " +
        "[role='navigation'], [role='banner'], [role='complementary'], .sidebar, .menu, .ad, .advertisement"
    ).remove();

    // Try dedicated content containers first
    let text = "";
    const contentSelectors = [
      "article",
      "main",
      "[role='main']",
      ".post-content",
      ".article-body",
      ".entry-content",
      ".article-content",
      "#article-body",
      ".story-body",
      "#content",
      ".content",
    ];

    for (const sel of contentSelectors) {
      const el = $(sel);
      if (el.length && el.text().trim().length > 200) {
        text = el.text();
        break;
      }
    }

    // Fallback to body
    if (!text) text = $("body").text();

    // Collapse whitespace
    text = text.replace(/[\t ]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return text.substring(0, maxChars);
  } catch {
    return "";
  }
}

interface SearchResult {
  title: string;
  snippet: string;
  url: string;
  pageContent?: string;
}

// ---------------------------------------------------------------------------
// 1. SearXNG  (primary — self-hosted on Render, no API key needed)
//    Set SEARXNG_URL env var, e.g. https://my-searxng-instance.onrender.com
// ---------------------------------------------------------------------------

async function searxngSearch(query: string): Promise<SearchResult[]> {
  const baseUrl = process.env.SEARXNG_URL;
  if (!baseUrl) throw new Error("NO_SEARXNG_URL");

  const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json`;

  // Generous timeout — Render free tier cold-starts can take 30-60s
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 90000);

  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`SearXNG HTTP ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = await res.json();
    const results = data.results || [];

    if (results.length === 0) {
      throw new Error("SearXNG returned no results.");
    }

    return results.slice(0, 6).map((r: any) => ({
      title: r.title || "",
      snippet: r.content || "",
      url: r.url || "",
    }));
  } catch (err) {
    clearTimeout(timeoutId);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// 2. DuckDuckGo HTML scraping  (fallback — works locally only)
// ---------------------------------------------------------------------------

async function ddgSearch(query: string): Promise<SearchResult[]> {
  const searchRes = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    { headers: { "User-Agent": SEARCH_USER_AGENT } }
  );

  if (!searchRes.ok) {
    throw new Error(`DuckDuckGo returned HTTP ${searchRes.status}`);
  }

  const html = await searchRes.text();
  const $ = cheerio.load(html);

  const results: SearchResult[] = [];

  $(".result").each((i, el) => {
    if (i >= 6) return false;

    const title = $(el).find(".result__title").text().trim();
    const snippet = $(el).find(".result__snippet").text().trim();
    let url =
      $(el).find(".result__a").attr("href") ||
      $(el).find(".result__url").attr("href") ||
      "";

    if (url.includes("uddg=")) {
      const match = url.match(/uddg=([^&]+)/);
      if (match) url = decodeURIComponent(match[1]);
    }

    if (url && !url.startsWith("http")) {
      url = "https://" + url.replace(/^\/\//, "");
    }

    if (title && snippet && url.startsWith("http")) {
      results.push({ title, snippet, url });
    }
  });

  if (results.length === 0) {
    throw new Error("DuckDuckGo returned no results (likely blocked on this server).");
  }

  return results;
}

// ---------------------------------------------------------------------------
// Unified search: SearXNG → DuckDuckGo fallback → enrich top results
// ---------------------------------------------------------------------------

async function performWebSearch(query: string): Promise<SearchResult[]> {
  let results: SearchResult[] | null = null;

  // Try SearXNG first (self-hosted, free, no key)
  try {
    results = await searxngSearch(query);
    console.log(`[Search] SearXNG returned ${results.length} results`);
  } catch (err: any) {
    if (err.message === "NO_SEARXNG_URL") {
      console.log("[Search] No SEARXNG_URL set, falling back to DuckDuckGo...");
    } else {
      console.warn("[Search] SearXNG failed:", err.message);
    }
  }

  // Fallback: DuckDuckGo scraping (works locally, blocked on cloud)
  if (!results) {
    results = await ddgSearch(query);
    console.log(`[Search] DuckDuckGo returned ${results.length} results`);
  }

  // Enrich top 3 results with actual page content (best-effort)
  await Promise.allSettled(
    results.slice(0, 3).map(async (r) => {
      r.pageContent = await fetchPageContent(r.url);
    })
  );

  return results;
}

/**
 * Build a system prompt section from the search results.
 */
function buildSearchContext(query: string, results: SearchResult[]): string {
  const entries = results
    .map((r, i) => {
      let entry = `[${i + 1}] "${r.title}"\n    URL: ${r.url}\n    Snippet: ${r.snippet}`;
      if (r.pageContent && r.pageContent.length > 100) {
        entry += `\n    Page Content:\n    ${r.pageContent}`;
      }
      return entry;
    })
    .join("\n\n");

  return `You have access to real-time web search results. The user asked: "${query}"

Here are the live search results (searched just now):

${entries}

INSTRUCTIONS:
1. Provide a thorough, accurate, and up-to-date answer using these search results.
2. When page content is available, prefer it over short snippets — it is more detailed.
3. ALWAYS cite your sources inline using markdown links: [Source Title](URL).
4. Synthesize information from multiple sources when possible for a well-rounded answer.
5. If the search results don't fully cover the topic, supplement with your own knowledge but clearly note which parts come from search results vs your training data.
6. Structure your answer clearly with headings, lists, or other formatting as appropriate.`;
}

// ---------------------------------------------------------------------------
// Chat Route
// ---------------------------------------------------------------------------

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
      timeout: 120000, // 2 min timeout — NIM models can be slow on cold start
      maxRetries: 0,  // We handle retries ourselves
    });

    // Parse messages — only keep role + content to avoid sending
    // client-side fields (id, createdAt, data, etc.) that the API rejects
    const formattedMessages = messages.map((msg: any) => {
      // Vision: attach image alongside text
      if (msg.role === "user" && msg.data?.imageUrl) {
        return {
          role: msg.role,
          content: [
            { type: "text", text: msg.content },
            { type: "image_url", image_url: { url: msg.data.imageUrl } },
          ],
        };
      }

      // Only keep what the NVIDIA API expects
      return { role: msg.role, content: msg.content };
    });

    // --- Anti-Gibberish Safeguard: Inject explicit system instructions ---
    // If a system message exists, append our safeguard. Otherwise, create one.
    const safeguardInstruction = "IMPORTANT: You must always respond in coherent, grammatically correct English unless explicitly asked to translate. Never use gibberish, endless repeating characters, or corrupted text. Maintain a professional and clear tone.";
    
    if (formattedMessages.length > 0 && formattedMessages[0].role === "system") {
      formattedMessages[0].content += `\n\n${safeguardInstruction}`;
    } else {
      formattedMessages.unshift({ role: "system", content: safeguardInstruction });
    }

    // ------ Web Search Augmentation ------
    if (webSearchEnabled) {
      const lastUserMsg = [...formattedMessages]
        .reverse()
        .find((m: any) => m.role === "user");

      if (lastUserMsg) {
        let query = "";
        if (typeof lastUserMsg.content === "string") {
          query = lastUserMsg.content;
        } else if (Array.isArray(lastUserMsg.content)) {
          const textPart = lastUserMsg.content.find(
            (c: any) => c.type === "text"
          );
          if (textPart) query = textPart.text;
        }

        if (query.trim().length > 0) {
          try {
            const searchResults = await performWebSearch(query);
            const searchPrompt = buildSearchContext(query, searchResults);

            // Inject into existing system message or prepend a new one
            if (formattedMessages[0]?.role === "system") {
              formattedMessages[0].content += "\n\n" + searchPrompt;
            } else {
              formattedMessages.unshift({
                role: "system",
                content: searchPrompt,
              });
            }
          } catch (searchError: any) {
            console.error("Web Search Error:", searchError);

            const fallbackPrompt = `The user enabled Web Search for: "${query}", but the live search failed (${searchError.message || "unknown error"}). Please answer using your internal knowledge and let the user know that live web search was unavailable this time.`;

            if (formattedMessages[0]?.role === "system") {
              formattedMessages[0].content += "\n\n" + fallbackPrompt;
            } else {
              formattedMessages.unshift({
                role: "system",
                content: fallbackPrompt,
              });
            }
          }
        }
      }
    }

    // ------ Stream the response ------
    const selectedModel = model || "meta/llama-3.1-70b-instruct";
    const modelConfig = getModelConfig(selectedModel);

    // Enforce safe bounds on temperature to prevent chaotic generation
    const safeTemp = Math.min(Math.max(temperature ?? 0.7, 0.0), 0.8);

    const payload: any = {
      model: selectedModel,
      messages: formattedMessages,
      temperature: safeTemp,
      max_tokens: modelConfig?.maxTokens ?? DEFAULT_MAX_TOKENS,
      top_p: 0.9,             // Cuts off the lowest 10% of probability (prevents gibberish)
      presence_penalty: 0.1,  // Helps prevent repetitive loops
      frequency_penalty: 0.1, // Helps prevent repeating the exact same words
      stream: true,
    };

    console.log(
      `[Chat] Model: ${selectedModel} | max_tokens: ${payload.max_tokens} | messages: ${formattedMessages.length}`
    );

    let response;
    try {
      response = await openai.chat.completions.create(payload);
    } catch (apiError: any) {
      console.error(
        `NVIDIA API Error [${selectedModel}]:`,
        apiError.status,
        apiError.message
      );

      // If the model rejected max_tokens (400/422), retry without it
      if (apiError.status === 400 || apiError.status === 422) {
        console.warn("Retrying without max_tokens...");
        delete payload.max_tokens;
        try {
          response = await openai.chat.completions.create(payload);
        } catch (retryError: any) {
          console.error("Retry also failed:", retryError.message);
          return new Response(
            JSON.stringify({
              error: `Model "${selectedModel}" error: ${retryError.message}`,
            }),
            { status: 502, headers: { "Content-Type": "application/json" } }
          );
        }
      } else {
        return new Response(
          JSON.stringify({
            error: `NVIDIA API error (${apiError.status || "unknown"}): ${apiError.message}`,
          }),
          {
            status: apiError.status || 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Convert OpenAI response to AI SDK stream
    const stream = OpenAIStream(response as any);

    return new StreamingTextResponse(stream);
  } catch (error) {
    console.error("Chat API Error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
