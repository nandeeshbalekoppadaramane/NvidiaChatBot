import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  const { id } = await context.params;

  // Read the documentName from the search params
  const { searchParams } = new URL(req.url);
  const documentName = searchParams.get("name");

  if (!documentName) {
    return new NextResponse("Missing document name", { status: 400 });
  }

  try {
    // Verify collection belongs to user
    const collection = await prisma.collection.findUnique({
      where: { id },
    });

    if (!collection || collection.userId !== userId) {
      return new NextResponse("Not Found", { status: 404 });
    }

    // Delete all chunks associated with this document in this collection
    await prisma.documentChunk.deleteMany({
      where: {
        collectionId: id,
        documentName: documentName
      }
    });

    return new NextResponse("OK");
  } catch (error) {
    console.error("Error deleting document:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
