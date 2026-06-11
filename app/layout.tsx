import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "NVIDIA AI Interface",
  description: "Connect to NVIDIA's powerful AI models",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${jetbrainsMono.variable} dark antialiased`}
    >
      <body>
        {/* Background Grid Animation */}
        <div className="bg-grid" aria-hidden="true">
          <div className="grid-lines"></div>
          <div className="grid-glow"></div>
        </div>
        {children}
      </body>
    </html>
  );
}
