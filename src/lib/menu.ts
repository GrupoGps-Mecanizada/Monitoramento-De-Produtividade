import type { IconeNome } from "@/components/icones";

/** Telas do sistema (barra superior, barra inferior do celular e Ctrl K). */
export const MENU: { href: string; rotulo: string; curto: string; icone: IconeNome }[] = [
  { href: "/", rotulo: "Localização", curto: "Mapa", icone: "mapa" },
  { href: "/timeline", rotulo: "Timeline", curto: "Timeline", icone: "timeline" },
  { href: "/alertas", rotulo: "Alertas", curto: "Alertas", icone: "alertas" },
];

/** A tela atual é esta? (o site usa barra no fim do endereço: /timeline/) */
export const telaAtiva = (caminho: string, href: string) => (href === "/" ? caminho === "/" || caminho === "" : caminho === href || caminho.startsWith(`${href}/`));
