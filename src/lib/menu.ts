import type { IconeNome } from "@/components/icones";

/** Telas do sistema (barra superior, barra inferior do celular e Ctrl K). */
export const MENU: { href: string; rotulo: string; curto: string; icone: IconeNome }[] = [
  { href: "/", rotulo: "Localização", curto: "Mapa", icone: "mapa" },
  { href: "/frota", rotulo: "Dia da frota", curto: "Frota", icone: "frota" },
  { href: "/analise", rotulo: "Análise", curto: "Análise", icone: "analise" },
  { href: "/cronoanalise", rotulo: "Cronoanálise", curto: "Crono", icone: "crono" },
  { href: "/timeline", rotulo: "Timeline", curto: "Timeline", icone: "timeline" },
  { href: "/equipamentos", rotulo: "Equipamentos", curto: "Equip.", icone: "equipamentos" },
  { href: "/alertas", rotulo: "Alertas", curto: "Alertas", icone: "alertas" },
  { href: "/gestao-alertas", rotulo: "Gestão de alertas", curto: "Gestão", icone: "opcoes" },
];

/** A tela atual é esta? (o site usa barra no fim do endereço: /timeline/) */
export const telaAtiva = (caminho: string, href: string) => (href === "/" ? caminho === "/" || caminho === "" : caminho === href || caminho.startsWith(`${href}/`));

type ItemMenu = (typeof MENU)[number];
/** Categorias do menu (barra superior e barra do celular): as telas agrupadas para caber e organizar o espaço. */
export const CATEGORIAS: { id: string; rotulo: string; icone: IconeNome; telas: string[] }[] = [
  { id: "ao-vivo", rotulo: "Ao vivo", icone: "mapa", telas: ["/", "/alertas", "/gestao-alertas"] },
  { id: "analises", rotulo: "Análises", icone: "analise", telas: ["/analise", "/frota", "/timeline", "/cronoanalise"] },
  { id: "cadastros", rotulo: "Cadastros", icone: "equipamentos", telas: ["/equipamentos"] },
];
/** As telas de uma categoria, na ordem dela. */
export const telasDa = (c: (typeof CATEGORIAS)[number]): ItemMenu[] => c.telas.flatMap((h) => MENU.filter((m) => m.href === h));
/** A categoria da tela aberta. */
export const categoriaAtiva = (caminho: string) => CATEGORIAS.find((c) => c.telas.some((h) => telaAtiva(caminho, h)));
