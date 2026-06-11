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
      "glm-5.1",
      "minimax-m2.7",
      "qwen3.5-397b",
      "llama-3.2-90b",
      "llama-3.2-11b",
      "kimi-k2.6"
    ];

    // Filter and format models
    let models = data.data
      .filter((m: any) => {
        const id = m.id.toLowerCase();
        
        // Exclude completely broken models or unsupported types
        if (id.includes("rerank") || 
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
