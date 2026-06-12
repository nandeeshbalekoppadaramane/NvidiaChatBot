import { NextResponse } from "next/server";
import { CURATED_MODELS } from "@/lib/model-config";

const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export async function GET(req: Request) {
  try {
    const apiKey = req.headers.get("Authorization")?.replace("Bearer ", "");

    if (!apiKey) {
      return NextResponse.json(
        { error: "API key is required" },
        { status: 401 }
      );
    }

    const response = await fetch(`${NVIDIA_BASE_URL}/models`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return NextResponse.json(
        { error: errorData.detail || "Failed to fetch models from NVIDIA" },
        { status: response.status }
      );
    }

    const data = await response.json();

    // Match NVIDIA models against our curated config
    let models = data.data
      .filter((m: any) => {
        const id = m.id.toLowerCase();
        return CURATED_MODELS.some((c) => id.includes(c.keyword));
      })
      .map((m: any) => {
        const id = m.id.toLowerCase();
        const config = CURATED_MODELS.find((c) => id.includes(c.keyword))!;

        return {
          id: m.id,
          name: config.displayName,
          category: config.category,
          description: config.description,
          maxTokens: config.maxTokens,
          owned_by: m.owned_by || "nvidia",
          created: m.created || null,
        };
      });

    // Sort by display name
    models.sort((a: any, b: any) => a.name.localeCompare(b.name));

    return NextResponse.json({ models, model_count: models.length });
  } catch (error: any) {
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}
