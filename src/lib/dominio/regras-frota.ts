// Regras do rastreamento inteligente (questionário do dono, 08/10/2026): horários de cada regime, cercas e limites.
// Um só lugar para mudar. Desenho: docs/superpowers/specs/2026-10-08-excecoes-do-dia-design.md

export type Regime = "adm" | "16h" | "24h";
export const ROTULO_REGIME: Record<Regime, string> = { adm: "ADM", "16h": "16 horas", "24h": "24 horas" };

/**
 * Expedientes de cada regime: sai do Pátio até `saida` e volta a partir de `chegada` (chegada menor que a saída =
 * dia seguinte). Dias: 0 = domingo ... 6 = sábado. 24 horas vale também para as escalas 4X4 (A, B, C e D).
 */
export const EXPEDIENTES: Record<Regime, { dias: number[]; turnos: { saida: string; chegada: string }[] }> = {
  adm: { dias: [1, 2, 3, 4, 5], turnos: [{ saida: "07:45", chegada: "16:30" }] },
  "16h": { dias: [1, 2, 3, 4, 5], turnos: [{ saida: "07:15", chegada: "14:23" }, { saida: "15:15", chegada: "22:23" }] },
  "24h": { dias: [0, 1, 2, 3, 4, 5, 6], turnos: [{ saida: "07:15", chegada: "18:23" }, { saida: "19:15", chegada: "06:23" }] },
};

/** O coletor vê a posição a cada ~5 min: folga nos horários de saída e chegada. */
export const TOLERANCIA_MIN = 5;
/** Parado ligado sem produzir por este tempo seguido vira ociosidade. */
export const OCIOSO_MIN = 30;
/** Motor desligado por este tempo seguido no expediente vira alerta. */
export const DESLIGADO_MIN = 60;
/** Tempo no restaurante acima disto vira alerta. */
export const RESTAURANTE_MIN = 60;
/** Velocidade máxima dentro da usina (km/h). Acima disso, excesso (regra 10). */
export const VELOCIDADE_MAX_USINA = 30;

export const PATIO = ["PÁTIO DO TRANSPORTE RODOVIÁRIO"];
export const SERVITEC = ["OFICINA GPS/SERVITEC"];
export const OFICINAS_FORA = ["OFICINA CENTRO"];
export const BICAS = ["ABAST ÁGUA", "ABASTECIMENTO ÁGUA RUA 29"];
export const RESTAURANTES = [
  "RESTAURANTE DA SINTER",
  "RESTAURANTE DA LUA",
  "RESTAURANTE DA SOL",
  "RESTAURANTE MECANIZADA",
  "RESTAURANTE DA LAGOA",
  "ESTACIONAMENTO RESTAURANTE CENTRAL",
  "ESTACIONAMENTO RESTAURANTE DA LAGOA",
  "ESTACIONAMENTO RESTAURANTE DA MATA",
];

/** Nome de cerca comparável: sem acento, maiúsculo, espaços simples. */
export const normNome = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
export const ehDaLista = (area: string, lista: string[]) => lista.some((n) => normNome(n) === normNome(area));

/** Regime: o da matriz; em branco, pelo nome da vaga ("24 HS", "16 HS"); sem pista, ADM presumido. */
export function regimeDoEquip(matriz: string | null | undefined, vaga: string): { regime: Regime; presumido: boolean } {
  const m = normNome(matriz ?? "");
  if (m.startsWith("ADM")) return { regime: "adm", presumido: false };
  if (/16\s*H/.test(m)) return { regime: "16h", presumido: false };
  if (/4X4|24\s*H|TURNO/.test(m)) return { regime: "24h", presumido: false };
  const v = normNome(vaga);
  if (/\b24\s*HS?\b/.test(v)) return { regime: "24h", presumido: false };
  if (/\b16\s*HS?\b/.test(v)) return { regime: "16h", presumido: false };
  return { regime: "adm", presumido: true };
}
