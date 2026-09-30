import "../globals.css";
import type { Metadata, Viewport } from "next";
import { Barlow, Barlow_Condensed } from "next/font/google";
import { SiteHeader } from "@/components/SiteHeader";

const body = Barlow({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });

export const metadata: Metadata = { title: "StreamChoice", description: "A comunidade escolhe o próximo filme ou jogo da live." };
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#0B0E0F" };

export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable}`}>
      <body className="min-h-screen bg-ink font-body text-[#E8EEF0]">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
