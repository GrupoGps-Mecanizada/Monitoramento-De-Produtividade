/** Identidade do sistema (título, barra superior): a mesma do SST, com o nome deste sistema. */
export const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
export const NOME_SISTEMA = "Controle de Frota - Grupo GPS - Mecanizada"; // um nome só (dono, 17/11/2026)
export const MARCA = { sigla: "Controle de Frota", empresa: "Grupo GPS", area: "Mecanizada", dona: "SGE", logo: `${BASE}/logo-sge.png` } as const;
