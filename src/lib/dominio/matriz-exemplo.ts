// Matriz de equipamentos igual à carga inicial do banco (supabase/equipamentos.sql): planilha "PLACAS VEICULOS.xlsx"
// de 05/10/2026 + o Ultravac desmobilizado. Só para os testes (unitários e e2e); o sistema lê do Supabase.
import type { EquipamentoCadastro, TipoEquip } from "../tipos";

const PLACAS: [TipoEquip, string[]][] = [
  ["ap", ["CZC-0453", "DSY-6472", "DSY-6474", "DSY-6475", "EAM-3253", "EAM-3255", "EAM-3256", "EAM-3262", "EGC-2978", "EGC-2983", "EGC-2985", "EGC-2989", "EZS-8764", "PUB-2F80"]],
  ["av", ["ALY-5322", "ANF-2676", "CUB-0763", "DSY-6473", "DSY-6577", "DYB-7210", "EAM-3251", "EAM-3257", "EGC-2993", "FSA-3D71", "HJS-1097"]],
  ["pg", ["DSY-6477", "EGC-2984", "EPN-2463"]],
  ["hv", ["DSY-6471", "EGC-1875", "FMD-2200", "FHD-9264"]],
];

const linha = (o: Partial<EquipamentoCadastro> & Pick<EquipamentoCadastro, "id" | "tipo" | "ordem">): EquipamentoCadastro => ({
  placa: null, numero: null, codigo: null, status: "ATIVO", supervisor_id: null, regime_id: null, supervisor: null, regime: null,
  observacao: null, atualizado_em: "2026-10-05T12:00:00.000Z", ...o,
});

export function matrizExemplo(): EquipamentoCadastro[] {
  const lista: EquipamentoCadastro[] = [];
  for (const [tipo, placas] of PLACAS) placas.forEach((placa, i) => lista.push(linha({ id: lista.length + 1, tipo, placa, ordem: i + 1 })));
  for (let n = 1; n <= 10; n++) lista.push(linha({ id: lista.length + 1, tipo: "as", numero: n, ordem: n }));
  lista.push(linha({ id: lista.length + 1, tipo: "uv", placa: "OWU-1596", ordem: 1, status: "DESMOBILIZADO", observacao: "Não está na planilha de 05/10/2026" }));
  return lista;
}
