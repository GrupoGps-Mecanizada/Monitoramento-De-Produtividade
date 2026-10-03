import { z } from "zod";
import type { Cerca, Evento, Historico, Retrato } from "../tipos";

/** O formato dos dados mudou (ex.: coletor novo gravando outra coisa): a tela avisa em vez de quebrar em silêncio. */
export class FormatoInesperado extends Error {
  constructor(oque: string) {
    super(`${oque} em formato inesperado - avise o responsável pelo sistema`);
    this.name = "FormatoInesperado";
  }
}

function validar<T>(esquema: z.ZodType, valor: unknown, oque: string): T {
  const r = esquema.safeParse(valor);
  if (!r.success) {
    console.error(`[formato] ${oque}`, r.error.issues);
    throw new FormatoInesperado(oque);
  }
  return r.data as T;
}

// confere só o que as telas usam; o resto passa adiante como veio (looseObject)
const numOuNulo = z.number().nullable();
const veiculo = z.looseObject({
  id: z.string(), placa: z.string(), status: z.string(), status_cod: z.number(),
  lat: numOuNulo, lng: numOuNulo, posicao_em: z.string().nullable(), area: z.string(), via: z.string(), sem_sinal: z.boolean(),
});
const retrato = z.looseObject({
  lido_em: z.string().nullable(),
  erro: z.looseObject({ em: z.string(), msg: z.string() }).nullable(),
  intervalo_s: z.number(),
  sem_sinal_min: z.number(),
  veiculos: z.array(veiculo),
});
const cerca = z.looseObject({ name: z.string(), color: z.string(), polygon: z.array(z.tuple([z.number(), z.number()])), tipo: z.enum(["planta", "via", "area"]) });
const evento = z.looseObject({ t: z.string(), tipo: z.enum(["entrada", "saida", "status", "sinal_perdido", "sinal_retomado"]), id: z.string(), placa: z.string() });
const estado = z.enum(["movimento", "parado_ligado", "desligado", "parado", "sem_sinal"]);
const historico = z.looseObject({
  id: z.string(),
  dia: z.string(),
  temRpm: z.boolean(),
  trechos: z.array(z.looseObject({ estado, inicio: z.string(), fim: z.string(), duracao_min: z.number() })),
  resumo: z.looseObject({ primeiro: z.string(), ultimo: z.string(), areas: z.array(z.looseObject({ area: z.string(), min: z.number() })) }).nullable(),
  pontos: z.array(z.tuple([numOuNulo, numOuNulo, z.string(), z.number(), estado, z.union([z.literal(0), z.literal(1), z.null()])])),
});

/** Retrato antes da 1ª leitura do coletor. */
export const RETRATO_VAZIO: Retrato = { lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [] };

export const validarRetrato = (v: unknown): Retrato => (v == null ? RETRATO_VAZIO : validar<Retrato>(retrato, v, "Retrato da frota"));
export const validarCercas = (v: unknown): Cerca[] => validar<Cerca[]>(z.array(cerca), v ?? [], "Cercas");
export const validarEvento = (v: unknown): Evento => validar<Evento>(evento, v, "Evento");

export function validarHistorico(v: unknown): Historico {
  const h = validar<Historico>(historico, v, "Histórico");
  // ponto sem coordenada (o GAUSS mandou vazio) fica fora do mapa e do player
  return { ...h, pontos: h.pontos.filter((p) => p[0] != null && p[1] != null) };
}
