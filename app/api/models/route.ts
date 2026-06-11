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
    
    // Format models as in the original python code
    const models = data.data.map((m: any) => {
      const short = m.id.split("/").pop() || m.id;
      const name = short
        .replace(/-/g, " ")
        .replace(/_/g, " ")
        .replace(/\b\w/g, (l: string) => l.toUpperCase()); // Title case
      
      return {
        id: m.id,
        name,
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
