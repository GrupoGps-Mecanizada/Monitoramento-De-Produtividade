/** Cor dos 3 serviços principais no mapa, nesta ordem (validada no fundo preto: validate_palette.js --mode dark --pairs all, 10/10/2026). */
export const CORES_SERVICO = ["#3987e5", "#d95926", "#199e70"] as const;
/** Os outros serviços e as paradas sem apontamento. */
export const COR_OUTROS = "#6b7280";
/** Cor do serviço pela posição entre os principais (a cor segue o serviço; não muda quando o filtro muda). */
export function corDoServico(nome: string | null, principais: string[]): string {
  const i = nome ? principais.indexOf(nome) : -1;
  return i >= 0 && i < CORES_SERVICO.length ? CORES_SERVICO[i] : COR_OUTROS;
}
