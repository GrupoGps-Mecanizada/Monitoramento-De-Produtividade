import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { Casca } from "@/components/casca";
import { NOME_SISTEMA } from "@/lib/marca";

// fontes baixadas no build e servidas pelo próprio site
// letra do padrão SGE (IBM Plex Sans); a variável continua --font-inter para não mexer no resto do estilo
const inter = IBM_Plex_Sans({ variable: "--font-inter", subsets: ["latin"], weight: ["400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: NOME_SISTEMA,
  description: "Mapa ao vivo da frota, trajeto do dia com reprodução e alertas de área, status e sinal",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#12151b" };

/** Aplica o tema escolhido antes da primeira pintura (sem piscar). */
const TEMA = `var t="claro";try{t=localStorage.getItem("sge_tema")||"claro"}catch(e){}document.documentElement.dataset.tema=t==="escuro"?"escuro":"claro"`;

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${inter.variable} h-full`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: TEMA }} />
      </head>
      <body className="min-h-full font-sans">
        <Casca>{children}</Casca>
      </body>
    </html>
  );
}
