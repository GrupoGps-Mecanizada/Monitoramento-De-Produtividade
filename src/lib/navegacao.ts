/** Pedido para mostrar um veículo ou uma cerca no mapa (busca Ctrl K, alertas, cartões). */
export type PedidoNavegacao = { tipo: "veiculo"; id: string } | { tipo: "cerca"; nome: string };

const ouvintes = new Set<(p: PedidoNavegacao) => boolean>();

/** A tela de Localização escuta enquanto está aberta. */
export function ouvirNavegacao(f: (p: PedidoNavegacao) => boolean): () => void {
  ouvintes.add(f);
  return () => {
    ouvintes.delete(f);
  };
}

/** Atendido pela tela aberta (true) ou não (false: quem pediu navega por link /#v= ou /#cerca=). */
export function pedirNavegacao(p: PedidoNavegacao): boolean {
  for (const f of ouvintes) if (f(p)) return true;
  return false;
}
