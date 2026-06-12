import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = (req: Request, res: any) => {
  // Dynamically set NEXTAUTH_URL to support accessing from phones/tablets on the local network!
  const host = req.headers.get("host");
  const protocol = process.env.NODE_ENV === "development" ? "http" : "https";
  if (host) {
    process.env.NEXTAUTH_URL = `${protocol}://${host}`;
  }
  return NextAuth(authOptions)(req, res);
};

export { handler as GET, handler as POST };
