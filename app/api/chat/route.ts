import OpenAI from "openai";
import { OpenAIStream, StreamingTextResponse } from "ai";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as cheerio from "cheerio";
import { getModelConfig, DEFAULT_MAX_TOKENS } from "@/lib/model-config";

const PROVIDER_BASE_URL = "https://integrate.api.nvidia.com/v1";

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
    const session = await getServerSession(authOptions);
    if (!session?.user) return new Response("Unauthorized", { status: 401 });
    const userId = (session.user as any).id;

    const { messages, model, temperature, webSearchEnabled, chatId, collectionId } = await req.json();

    // Fetch API Key from database
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.apiKey) {
      return new Response("API Key not configured in settings", { status: 401 });
    }
    const apiKey = settings.apiKey;

    let currentChatId = chatId;
    
    // Auto-create chat if it doesn't exist
    if (!currentChatId) {
      const lastMessage = messages[messages.length - 1];
      let title = "New Chat";
      
      if (lastMessage && lastMessage.role === "user" && typeof lastMessage.content === "string") {
        const text = lastMessage.content.trim().split('\n')[0]; // Take first line
        if (text.length > 35) {
          const truncated = text.slice(0, 35);
          const lastSpace = truncated.lastIndexOf(' ');
          title = (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + "...";
        } else {
          title = text || "New Chat";
        }
        // Capitalize first letter like Claude does
        title = title.charAt(0).toUpperCase() + title.slice(1);
      }
        
        const newChat = await prisma.chat.create({
          data: {
            title,
            userId,
            collectionId: collectionId || null,
          }
        });
      currentChatId = newChat.id;
    }

    // Save the incoming user message to the database
    const lastMessageToSave = messages[messages.length - 1];
    if (lastMessageToSave && lastMessageToSave.role === "user") {
      await prisma.message.create({
        data: {
          chatId: currentChatId,
          role: "user",
          content: typeof lastMessageToSave.content === "string" ? lastMessageToSave.content : JSON.stringify(lastMessageToSave.content),
        },
      });
      // Bump chat updatedAt to push it to the top
      await prisma.chat.update({
        where: { id: currentChatId },
        data: { updatedAt: new Date() }
      });
    }

    // Create a custom OpenAI client pointing to the provider's endpoint
    const openai = new OpenAI({
      baseURL: PROVIDER_BASE_URL,
      apiKey,
      timeout: 300000, // 5 min timeout to allow massive PDF context processing
      maxRetries: 0,  // We handle retries ourselves
    });

    // Parse messages — only keep role + content to avoid sending
    // client-side fields (id, createdAt, data, etc.) that the API rejects
    const formattedMessages = messages.map((msg: any, index: number) => {
      // Vision: attach multiple images alongside text
      if (msg.role === "user" && msg.data?.images && Array.isArray(msg.data.images)) {
        const textContent = (msg.content || "").trim();
        const contentArr: any[] = [{ 
          type: "text", 
          text: textContent.length > 0 ? textContent : "Please analyze the attached images." 
        }];
        
        const imagesToProcess = msg.data.images.slice(0, 10); // API Hardcap to 10 images to prevent 400 Payload Too Large errors
        imagesToProcess.forEach((imgUrl: string) => {
          contentArr.push({ type: "image_url", image_url: { url: imgUrl } });
        });
        
        return {
          role: msg.role,
          content: contentArr,
        };
      }

      if (msg.role === "user" && msg.data?.fileContexts) {
        const isLastMessage = index === messages.length - 1;
        // 150k chars for the active turn (~37k tokens), 10k chars for historic turns (~2.5k tokens)
        const maxTotalChars = isLastMessage ? 150000 : 10000;
        
        let fileText = "\n\n--- ATTACHED DOCUMENTS ---\n";
        let totalFileLength = 0;
        
        msg.data.fileContexts.forEach((f: any) => {
          const allowedLength = Math.max(0, maxTotalChars - totalFileLength);
          if (allowedLength === 0) return;
          
          const safeContent = f.content.length > allowedLength ? f.content.slice(0, allowedLength) + "\n...[CONTENT TRUNCATED FOR LENGTH]" : f.content;
          totalFileLength += safeContent.length;
          fileText += `\nDocument Name: ${f.name}\nContent:\n${safeContent}\n---`;
        });
        return { role: msg.role, content: msg.content + fileText };
      }

      // Only keep what the Provider API expects
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

    // ------ RAG / Knowledge Base Retrieval ------
    const targetCollectionId = collectionId || null;

    if (targetCollectionId) {
      // Find the actual text query to embed
      const lastMsgWithData = messages.findLast((m: any) => m.role === "user");
      let queryText = "";
      if (lastMsgWithData) {
        if (typeof lastMsgWithData.content === "string") {
          queryText = lastMsgWithData.content;
        } else if (Array.isArray(lastMsgWithData.content)) {
          const textPart = lastMsgWithData.content.find((c: any) => c.type === "text");
          if (textPart) queryText = textPart.text;
        }
      }

      if (queryText.trim().length > 0) {
        try {
          // 1. Check Embedding Cache
          let queryEmbedding = null;
          try {
            const cachedArr: any[] = await prisma.$queryRaw`
              SELECT "embedding" FROM "CachedEmbedding" WHERE "query" = ${queryText} LIMIT 1
            `;
            if (cachedArr.length > 0 && cachedArr[0].embedding) {
              console.log("[RAG] Using cached embedding for query.");
              const embStr = cachedArr[0].embedding;
              queryEmbedding = typeof embStr === 'string' ? JSON.parse(embStr) : embStr;
            }
          } catch (e) {
            console.error("[RAG] Cache lookup failed:", e);
          }

          if (!queryEmbedding) {
            console.log(`[RAG] Generating new embedding for collection: ${targetCollectionId}`);
            // Embed the user's question
            const embedRes = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
              },
              body: JSON.stringify({
                input: [queryText],
                model: "nvidia/nv-embedqa-e5-v5",
                input_type: "query",
                truncate: "END"
              })
            });

            if (!embedRes.ok) throw new Error("Failed to embed query");
            const embedData = await embedRes.json();
            queryEmbedding = embedData.data[0].embedding;

            // Save to Cache (fire and forget)
            prisma.$executeRaw`
              INSERT INTO "CachedEmbedding" ("id", "query", "embedding", "createdAt")
              VALUES (gen_random_uuid()::text, ${queryText}, ${JSON.stringify(queryEmbedding)}::vector, NOW())
              ON CONFLICT ("query") DO NOTHING
            `.catch(e => console.error("[RAG] Failed to cache embedding:", e));
          }

          if (queryEmbedding) {

            // 2. Perform Hybrid Search (Cosine Similarity + BM25 Full-Text Search)
            const rawChunks: any[] = await prisma.$queryRaw`
              SELECT "content", "documentName", "chunkIndex",
                     (0.7 * (1 - ("embedding" <=> ${JSON.stringify(queryEmbedding)}::vector)) + 
                      0.3 * ts_rank(to_tsvector('english', "content"), plainto_tsquery('english', ${queryText})))
                     AS score
              FROM "DocumentChunk"
              WHERE "collectionId" = ${targetCollectionId}
              ORDER BY score DESC
              LIMIT 15;
            `;

            let finalChunks = rawChunks.slice(0, 5);

            if (rawChunks.length > 0) {
              try {
                console.log(`[RAG] Re-ranking ${rawChunks.length} chunks...`);
                const rerankResponse = await fetch('https://integrate.api.nvidia.com/v1/reranking', {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                  },
                  body: JSON.stringify({
                    model: "nvidia/nv-rerankqa-mistral-4b-v3",
                    query: queryText,
                    documents: rawChunks.map(c => c.content),
                    top_n: 5
                  })
                });

                if (rerankResponse.ok) {
                  const reranked = await rerankResponse.json();
                  if (reranked.results && Array.isArray(reranked.results)) {
                    finalChunks = reranked.results.map((r: any) => rawChunks[r.index]);
                  }
                } else {
                  console.error("[RAG] Reranking failed:", await rerankResponse.text());
                }
              } catch (e) {
                console.error("[RAG] Reranking error:", e);
              }
            }

            if (finalChunks.length > 0) {
              // 3. Fetch Parent Documents (surrounding chunks) for Context Injection
              console.log("[RAG] Expanding chunks into Parent Documents...");
              const expandedContexts = await Promise.all(
                finalChunks.map(async (chunk, i) => {
                  if (chunk.chunkIndex === undefined || chunk.chunkIndex === null) {
                     return `[Source ${i+1}: ${chunk.documentName}]\n${chunk.content}`;
                  }
                  
                  const startIdx = Math.max(0, chunk.chunkIndex - 2);
                  const endIdx = chunk.chunkIndex + 2;
                  
                  // Fetch surrounding chunks
                  const parentChunks: any[] = await prisma.$queryRaw`
                    SELECT "content" 
                    FROM "DocumentChunk"
                    WHERE "documentName" = ${chunk.documentName}
                      AND "collectionId" = ${targetCollectionId}
                      AND "chunkIndex" >= ${startIdx}
                      AND "chunkIndex" <= ${endIdx}
                    ORDER BY "chunkIndex" ASC
                    LIMIT 15
                  `;
                  
                  if (parentChunks && parentChunks.length > 0) {
                    return `[Source ${i+1}: ${chunk.documentName}]\n${parentChunks.map(c => c.content).join("\n...\n")}`;
                  }
                  return `[Source ${i+1}: ${chunk.documentName}]\n${chunk.content}`;
                })
              );
              
              let ragContext = expandedContexts.join("\n\n");
              
              // Extreme Safety Net: If the PDF was parsed poorly and created a massive 100k+ chunk, truncate it
              if (ragContext.length > 80000) {
                console.warn(`[RAG] Warning: RAG Context is unusually large (${ragContext.length} chars). Truncating to 80,000 characters.`);
                ragContext = ragContext.slice(0, 80000) + "\n\n...[ADDITIONAL CONTEXT TRUNCATED FOR SAFETY]";
              }
              
              const ragInstruction = `You are a highly intelligent tutor and assistant. You have been provided with excerpts from the user's personal Knowledge Base.\n\nKNOWLEDGE BASE CONTEXT:\n${ragContext}\n\nINSTRUCTIONS:\n1. Answer the user's question accurately using the information provided in the Context above.\n2. Do NOT use outside knowledge unless the context lacks the answer.\n3. Answer naturally and fluently in your own words. You DO NOT need to constantly append [Source: Filename] to every sentence. Only mention the source document name if it's necessary to distinguish between multiple documents or if the user explicitly asks for the source. Keep your tone helpful, conversational, and natural.`;

              if (formattedMessages[0]?.role === "system") {
                formattedMessages[0].content += `\n\n${ragInstruction}`;
              } else {
                formattedMessages.unshift({ role: "system", content: ragInstruction });
              }
              console.log(`[RAG] Successfully injected expanded context for ${finalChunks.length} chunks.`);
            }
          }
        } catch (e) {
          console.error("[RAG] Retrieval failed:", e);
        }
      }
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

        // --- AI Intent Classifier (LLaMA 3.1 8B) ---
        const evaluateSearchIntent = async (q: string): Promise<boolean> => {
          // Fast-path bypass for tiny small-talk to save the API call
          const cleanQuery = q.trim().toLowerCase().replace(/[^\w\s]/g, "");
          const smallTalk = ["hi", "hello", "hey", "thanks", "thank you", "bye", "goodbye", "good morning", "how are you", "ok", "okay", "cool", "awesome", "yes", "no"];
          if (smallTalk.includes(cleanQuery)) return false;

          // Explicit user command override: If they explicitly ask to search, force TRUE immediately
          const explicitSearchCommands = ["search the web", "search for", "google", "look up", "find online", "search internet"];
          if (explicitSearchCommands.some(cmd => cleanQuery.includes(cmd))) return true;

          try {
            // Ask a lightning-fast 8B model to classify the intent
            const intentRes = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: "meta/llama-3.1-8b-instruct",
                messages: [
                  {
                    role: "system",
                    content: "You are a web search routing engine. Does the user's query require querying a search engine for real-time data, current events, facts, or external knowledge? Reply ONLY with the exact word TRUE or FALSE. Do not write any other text.",
                  },
                  { role: "user", content: q },
                ],
                max_tokens: 5,
                temperature: 0.0,
              }),
            });

            if (intentRes.ok) {
              const data = await intentRes.json();
              const answer = data.choices[0]?.message?.content?.trim().toUpperCase() || "";
              console.log(`[Intent] LLaMA 8B evaluated "${q}" -> ${answer}`);
              return answer.includes("TRUE");
            }
          } catch (e) {
            console.warn("[Intent] LLM Classifier failed, falling back to heuristic", e);
          }
          
          // Fallback if the API ping fails
          const words = cleanQuery.split(/\s+/);
          if (words.length <= 2) {
            const searchWords = ["search", "find", "who", "what", "where", "when", "why", "price", "stock", "news", "weather"];
            return searchWords.some(w => cleanQuery.includes(w));
          }
          return true;
        };

        const shouldSearch = await evaluateSearchIntent(query);

        if (query.trim().length > 0 && shouldSearch) {
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

    // --- Context Length Safeguard ---
    // Enforce a hard cap on the total characters sent to the API (~300k chars = ~75k tokens)
    // This prevents 400 Context Exceeded errors for long chats with massive historical messages.
    const MAX_TOTAL_CHARS = 300000;
    let currentTotalChars = 0;
    
    // Always keep the system message (which contains RAG context & Safeguards)
    let systemMsg = formattedMessages.length > 0 && formattedMessages[0].role === "system" ? formattedMessages.shift() : null;
    if (systemMsg && typeof systemMsg.content === "string") {
      currentTotalChars += systemMsg.content.length;
    }

    const prunedMessages = [];
    // Iterate from newest to oldest
    for (let i = formattedMessages.length - 1; i >= 0; i--) {
      const msg = formattedMessages[i];
      let msgLength = 0;
      if (typeof msg.content === "string") {
        msgLength = msg.content.length;
      } else if (Array.isArray(msg.content)) {
        msgLength = JSON.stringify(msg.content).length;
      }
      
      if (currentTotalChars + msgLength > MAX_TOTAL_CHARS && prunedMessages.length > 0) {
        // Stop adding older messages once we hit the safe limit
        console.warn(`[Chat] Truncating chat history at ${currentTotalChars} chars to prevent 400 error.`);
        break;
      }
      
      currentTotalChars += msgLength;
      prunedMessages.unshift(msg);
    }

    if (systemMsg) {
      prunedMessages.unshift(systemMsg);
    }

    // ------ Stream the response ------
    const selectedModel = model || "meta/llama-3.1-70b-instruct";
    const modelConfig = getModelConfig(selectedModel);

    // Enforce safe bounds on temperature to prevent chaotic generation (max 1.0)
    const safeTemp = Math.min(Math.max(temperature ?? 0.7, 0.0), 1.0);

    const payload: any = {
      model: selectedModel,
      messages: prunedMessages,
      temperature: safeTemp,
      max_tokens: modelConfig?.maxTokens ?? DEFAULT_MAX_TOKENS,
      top_p: 0.9,             // Cuts off the lowest 10% of probability (prevents gibberish)
      presence_penalty: 0.1,  // Helps prevent repetitive loops
      frequency_penalty: 0.1, // Helps prevent repeating the exact same words
      stream: true,
    };

    console.log(
      `[Chat] Model: ${selectedModel} | max_tokens: ${payload.max_tokens} | messages: ${prunedMessages.length}`
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

      // If the model rejected our strict parameters (400/422/503), retry with a minimal payload
      if (apiError.status === 400 || apiError.status === 422 || apiError.status === 503) {
        console.warn(`[Chat] Model rejected parameters. Retrying minimal payload for ${selectedModel}...`);
        delete payload.max_tokens;
        delete payload.top_p;
        delete payload.presence_penalty;
        delete payload.frequency_penalty;
        
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
            error: `API error (${apiError.status || "unknown"}): ${apiError.message}`,
          }),
          {
            status: apiError.status || 500,
            headers: { "Content-Type": "application/json" },
          }
        );
      }
    }

    // Convert OpenAI response to AI SDK stream
    const stream = OpenAIStream(response as any, {
      async onCompletion(completion) {
        try {
          // Save the AI's response to the database once the stream finishes
          await prisma.message.create({
            data: {
              chatId: currentChatId,
              role: "assistant",
              content: completion,
              model: selectedModel,
            },
          });
          // Bump chat updatedAt to push it to the top
          await prisma.chat.update({
            where: { id: currentChatId },
            data: { updatedAt: new Date() }
          });
        } catch (dbError) {
          console.error("Failed to save message to DB:", dbError);
        }
      },
    });

    return new StreamingTextResponse(stream, {
      headers: {
        "x-chat-id": currentChatId,
      },
    });
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

