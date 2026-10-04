import { cx } from "./ui";

export type IconeNome = "mapa" | "timeline" | "alertas" | "busca" | "tema" | "fechar" | "voltar" | "play" | "pausa" | "anterior" | "proximo" | "opcoes" | "baixar" | "alvo" | "frota";

export const CAMINHOS: Record<IconeNome, string> = {
  mapa: "M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14",
  timeline: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM10 8.5v7l6-3.5z",
  alertas: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  busca: "M21 21l-4.3-4.3M17 10.5a6.5 6.5 0 1 1-13 0 6.5 6.5 0 0 1 13 0z",
  tema: "M12 3a9 9 0 1 0 9 9 7 7 0 0 1-9-9z",
  fechar: "M6 6l12 12M18 6L6 18",
  voltar: "M15 6l-6 6 6 6",
  play: "M7 5v14l11-7z",
  pausa: "M8 5v14M16 5v14",
  anterior: "M18 6v12l-8-6zM6 6v12",
  proximo: "M6 6v12l8-6zM18 6v12",
  opcoes: "M4 7h10M18 7h2M4 17h4M12 17h8M14 5v4M8 15v4",
  baixar: "M12 3v12m0 0-4-4m4 4 4-4M4 17v3h16v-3",
  alvo: "M12 2v4M12 18v4M2 12h4M18 12h4M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
  frota: "M4 6h16M4 12h11M4 18h14",
};

export function Icone({ nome, className }: { nome: IconeNome; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={cx("h-5 w-5 shrink-0", className)}>
      <path d={CAMINHOS[nome]} />
    </svg>
  );
}
