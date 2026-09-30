import "../globals.css";
import { Barlow, Barlow_Condensed } from "next/font/google";

const body = Barlow({ subsets: ["latin"], weight: ["500", "600"], variable: "--font-body" });
const display = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "800"], variable: "--font-display" });

export const metadata = { title: "StreamChoice · Overlay", robots: { index: false, follow: false } };

/** Layout raiz próprio: fundo 100% transparente, sem barras de rolagem (RF18). */
export default function OverlayLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${body.variable} ${display.variable}`} style={{ background: "rgba(0,0,0,0)" }}>
      <body style={{ background: "rgba(0,0,0,0)", margin: 0, overflow: "hidden" }} className="font-body">
        {children}
      </body>
    </html>
  );
}
