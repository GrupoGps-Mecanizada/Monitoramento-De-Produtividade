/** Identidade do sistema (título, barra superior): a mesma do SST, com o nome deste sistema. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const NOME_SISTEMA = "Monitoramento - Grupo GPS - Mecanizada";
export const MARCA = { sigla: "Monitoramento", empresa: "Grupo GPS", area: "Mecanizada", dona: "SGE", logo: `${BASE}/logo-sge.png` } as const;
