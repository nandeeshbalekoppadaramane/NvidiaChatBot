import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  try {
    const collections = await prisma.collection.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        _count: {
          select: { chunks: true }
        }
      }
    });

    // We want to return unique document names per collection to show "X documents"
    const enrichedCollections = await Promise.all(collections.map(async (col) => {
      const uniqueDocs = await prisma.documentChunk.findMany({
        where: { collectionId: col.id },
        select: { documentName: true },
        distinct: ['documentName']
      });
      return {
        ...col,
        documentCount: uniqueDocs.length,
        documents: uniqueDocs.map((d: any) => d.documentName)
      };
    }));

    return NextResponse.json(enrichedCollections);
  } catch (error) {
    console.error("Error fetching collections:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string") {
      return new NextResponse("Invalid name", { status: 400 });
    }

    const collection = await prisma.collection.create({
      data: {
        name,
        userId,
      },
    });

    return NextResponse.json(collection);
  } catch (error) {
    console.error("Error creating collection:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
