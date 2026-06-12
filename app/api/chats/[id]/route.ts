import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  const chat = await prisma.chat.findUnique({
    where: { id, userId },
    include: {
      messages: {
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!chat) return new NextResponse("Not Found", { status: 404 });

  return NextResponse.json(chat);
}

export async function DELETE(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  try {
    await prisma.chat.delete({
      where: { id, userId },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return new NextResponse("Failed to delete", { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  try {
    const { title } = await req.json();
    if (!title || typeof title !== "string") {
      return new NextResponse("Invalid title", { status: 400 });
    }

    const updatedChat = await prisma.chat.update({
      where: { id, userId },
      data: { title },
    });

    return NextResponse.json(updatedChat);
  } catch (error) {
    return new NextResponse("Failed to update chat", { status: 500 });
  }
}
