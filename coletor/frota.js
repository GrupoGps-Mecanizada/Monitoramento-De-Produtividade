// Regras da frota que não vêm prontas do GAUSS.
//
// Motor secundário: placas têm 7 caracteres (EOF5208, DTW5E38). O GAUSS cadastra o
// motor secundário do caminhão (bomba de alta pressão, vácuo...) como outro
// "veículo", com a mesma placa + "2" no fim: EOF5208 -> EOF52082. Ele tem rastreador
// e status próprios (o RPM dele é 0/1000 = desligado/ligado), mas NÃO é outro
// caminhão: não pode entrar na contagem da frota nem aparecer duplicado no mapa.
// Conferido em 01/10/2026: 12 pares, todos com o secundário a 4-25 m do principal
// quando os dois comunicam.

export const normPlaca = (p) => String(p ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * @param {{id: string|number, placa: string}[]} veiculos
 * @returns {{ principalDe: Map<string,string>, secundarioDe: Map<string,string> }}
 *   principalDe: id do secundário -> id do principal
 *   secundarioDe: id do principal -> id do secundário
 */
export function parearMotores(veiculos) {
  const porPlaca = new Map(veiculos.map((v) => [normPlaca(v.placa), v]));
  const principalDe = new Map();
  const secundarioDe = new Map();
  for (const v of veiculos) {
    const n = normPlaca(v.placa);
    if (n.length !== 8 || !n.endsWith('2')) continue;
    const principal = porPlaca.get(n.slice(0, 7));
    if (!principal) continue;
    principalDe.set(String(v.id), String(principal.id));
    secundarioDe.set(String(principal.id), String(v.id));
  }
  return { principalDe, secundarioDe };
}
