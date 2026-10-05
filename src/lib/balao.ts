// Onde o balão (Localização e Timeline) aparece: do lado pedido se couber, senão do outro; sempre dentro da tela.
export type Lado = "cima" | "baixo";
export interface Caixa {
  left: number;
  top: number;
  width: number;
  height: number;
}
const MARGEM = 8;
const VAO = 6;

export function posicionarBalao(ancora: Caixa, balao: { width: number; height: number }, tela: { width: number; height: number }, lado: Lado): { left: number; top: number; lado: Lado } {
  const emCima = ancora.top - VAO - balao.height;
  const embaixo = ancora.top + ancora.height + VAO;
  const cabeCima = emCima >= MARGEM;
  const cabeBaixo = embaixo + balao.height <= tela.height - MARGEM;
  const usado: Lado = lado === "cima" ? (cabeCima || !cabeBaixo ? "cima" : "baixo") : cabeBaixo || !cabeCima ? "baixo" : "cima";
  const top = Math.max(MARGEM, Math.min(usado === "cima" ? emCima : embaixo, tela.height - MARGEM - balao.height));
  const left = Math.max(MARGEM, Math.min(ancora.left + ancora.width / 2 - balao.width / 2, tela.width - MARGEM - balao.width));
  return { left: Math.round(left), top: Math.round(top), lado: usado };
}
