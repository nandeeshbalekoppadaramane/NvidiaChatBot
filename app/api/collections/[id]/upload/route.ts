import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Utility to split text into chunks
function chunkText(text: string, maxWords: number = 200, overlap: number = 50): string[] {
  const words = text.split(/\s+/);
  const chunks = [];
  for (let i = 0; i < words.length; i += maxWords - overlap) {
    const chunk = words.slice(i, i + maxWords).join(" ");
    chunks.push(chunk);
    if (i + maxWords >= words.length) break;
  }
  return chunks;
}

export async function POST(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  try {
    const { text, documentName } = await req.json();
    
    if (!text || !documentName) {
      return new NextResponse("Missing text or documentName", { status: 400 });
    }

    // Verify collection belongs to user
    const collection = await prisma.collection.findUnique({
      where: { id, userId }
    });

    if (!collection) {
      return new NextResponse("Collection not found", { status: 404 });
    }

    // Get API Key
    const settings = await prisma.userSettings.findUnique({ where: { userId } });
    if (!settings?.apiKey) {
      return new NextResponse("API Key not found", { status: 400 });
    }

    // Chunk the document
    const chunks = chunkText(text, 250); // ~250 words per chunk

    // Process chunks in batches of 10 to avoid API rate limits
    const batchSize = 10;
    let totalProcessed = 0;

    for (let i = 0; i < chunks.length; i += batchSize) {
      const batchChunks = chunks.slice(i, i + batchSize);
      
      const response = await fetch('https://integrate.api.nvidia.com/v1/embeddings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          input: batchChunks,
          model: "nvidia/nv-embedqa-e5-v5",
          input_type: "passage",
          truncate: "END"
        })
      });

      if (!response.ok) {
        const err = await response.text();
        console.error("Embedding failed:", err);
        throw new Error(`Embedding API failed: ${err}`);
      }

      const data = await response.json();
      
      // Save chunks and vectors to database
      for (let j = 0; j < batchChunks.length; j++) {
        const embedding = data.data[j].embedding; // 1024-dimensional array
        const content = batchChunks[j];
        const chunkIndex = i + j;
        const totalChunks = chunks.length;
        
        // Use raw query for pgvector insert (must use JSON stringification for Postgres array syntax)
        await prisma.$executeRaw`
          INSERT INTO "DocumentChunk" ("id", "collectionId", "documentName", "content", "embedding", "chunkIndex", "totalChunks", "createdAt")
          VALUES (
            gen_random_uuid()::text,
            ${id},
            ${documentName},
            ${content},
            ${JSON.stringify(embedding)}::vector,
            ${chunkIndex},
            ${totalChunks},
            NOW()
          )
        `;
      }
      
      totalProcessed += batchChunks.length;
    }

    return NextResponse.json({ success: true, chunksProcessed: totalProcessed });
  } catch (error: any) {
    console.error("Error processing document:", error);
    return new NextResponse(error.message || "Internal Server Error", { status: 500 });
  }
}
