import { NextResponse } from "next/server";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "");
    
    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 401 });
    }

    const response = await fetch(`${NVIDIA_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes (matching python cache)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch models from NVIDIA" },
        { status: response.status }
      );
    }

    const data = await response.json();
    
    const allowedKeywords = [
      "llama-3.1-405b",
      "llama-3.1-70b",
      "llama-3.1-8b",
      "llama-3.2-1b",
      "llama-3.2-3b",
      "llama-3.2-90b-vision",
      "llama-3.2-11b-vision",
      "mistral-large",
      "mixtral-8x22b",
      "mistral-nemo",
      "gemma-2-27b",
      "gemma-2-9b",
      "gemma-2-2b",
      "phi-3.5-mini",
      "deepseek-coder",
      "granite-34b",
      "qwen2.5-72b",
      "qwen2.5-coder-32b",
      "qwen2.5-7b",
      "qwen2.5-3b",
      "qwen2.5-1.5b",
      "qwen-vl",
      "moonshot",
      "kimi",
      "minimax",
      "nemotron-4-340b",
      "nemotron-mini-4b"
    ];

    // Filter and format models
    let models = data.data
      .filter((m: any) => {
        const id = m.id.toLowerCase();
        
        // Exclude completely broken models first
        if (id.includes("embed") || 
            id.includes("rerank") || 
            id.includes("retriever") ||
            id.includes("tts") ||
            id.includes("asr") ||
            id.includes("sdxl") ||
            id.includes("stable-diffusion") ||
            id.includes("flux") ||
            id.includes("pixtral") ||
            id.includes("paligemma") ||
            id.includes("llava") ||
            id.includes("fuyu") ||
            id.includes("internvl") ||
            (id.includes("phi") && id.includes("vision"))) {
              return false;
        }

        // Only allow models that match one of our curated keywords
        return allowedKeywords.some(keyword => id.includes(keyword));
      })
      .map((m: any) => {
        const id = m.id.toLowerCase();
        const short = m.id.split("/").pop() || m.id;
        const name = short
          .replace(/-/g, " ")
          .replace(/_/g, " ")
          .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Title case
        
        const isVision = id.includes("vision") || 
                         id.includes("moonshot") ||
                         id.includes("kimi") ||
                         id.includes("qwen-vl");

        return {
          id: m.id,
          name,
          category: isVision ? "vision" : "chat",
          owned_by: m.owned_by || "nvidia",
          created: m.created || null,
        };
      });

    // Sort alphabetically by display name
    models.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ models, model_count: models.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
