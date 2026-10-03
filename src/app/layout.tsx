import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Casca } from "@/components/casca";
import { NOME_SISTEMA } from "@/lib/marca";

// fontes baixadas no build e servidas pelo próprio site
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

export const metadata: Metadata = {
  title: NOME_SISTEMA,
  description: "Mapa ao vivo da frota, trajeto do dia com reprodução e alertas de área, status e sinal",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#12151b" };

/** Aplica o tema escolhido antes da primeira pintura (sem piscar). */
const TEMA = `try{var t=localStorage.getItem("mon-tema");if(t==="claro"||t==="escuro")document.documentElement.dataset.tema=t}catch(e){}`;

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
