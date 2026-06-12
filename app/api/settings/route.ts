import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;

  const settings = await prisma.userSettings.findUnique({
    where: { userId },
  });

  return NextResponse.json(settings || { apiKey: "" });
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  const userId = (session.user as any).id;
  const { apiKey } = await req.json();

  const settings = await prisma.userSettings.upsert({
    where: { userId },
    update: { apiKey },
    create: { userId, apiKey },
  });

  return NextResponse.json(settings);
}
