// Tela Equipamentos: a matriz (cadastro) em ordem, contagem por status e cores da planilha.
import type { EquipamentoCadastro, StatusEquip } from "../tipos";
import { ORDEM_STATUS, compararCadastro } from "./equipamentos";

/** Linhas da matriz em ordem de tipo e posição. */
export const linhasMatriz = (cadastro: readonly EquipamentoCadastro[]): EquipamentoCadastro[] => [...cadastro].sort(compararCadastro);

export const contarStatus = (cadastro: readonly EquipamentoCadastro[]): Record<StatusEquip, number> =>
  Object.fromEntries(ORDEM_STATUS.map((s) => [s, cadastro.filter((c) => c.status === s).length])) as Record<StatusEquip, number>;

/** Cor da célula de status na planilha (como no Excel: verde, amarelo, cinza). */
export const COR_STATUS: Record<StatusEquip, string> = { ATIVO: "#E2EFDA", EM_MANUTENCAO: "#FFF2CC", DESMOBILIZADO: "#E7E6E6" };
