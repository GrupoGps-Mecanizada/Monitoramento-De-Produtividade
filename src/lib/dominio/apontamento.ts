// Apontamento de um veículo num dia, a partir da "Rota" do GAUSS (um ponto a cada ~30 s com velocidade e
// RPM): deslocamentos (por quais ruas/áreas passou), paradas (onde, motor ligado ou desligado), sem sinal.
// Mesmo cálculo do coletor em JS (paridade conferida em coletor/paridade.test.ts).
import type { Apontamento, Cerca, EstadoTrecho, PontoMapa, PontoRota, Trecho } from "../tipos";
import { cercasNoPonto, distanciaM } from "./geo";

export const VEL_MOVIMENTO = 5; // km/h - abaixo disso é parado (GPS oscila 1-4 km/h parado)
export const GAP_SEM_SINAL_MIN = 10;
const SEGMENTO_MIN = 2; // trechos menores que isso são ruído e são absorvidos pelo anterior

/** "AAAA-MM-DD HH:MM:SS" (horário local do GAUSS) → Date */
export const paraData = (t: string) => new Date(t.replace(" ", "T"));
const minutos = (a: string, b: string) => (paraData(b).getTime() - paraData(a).getTime()) / 60000;

/**
 * RPM que não muda o dia inteiro é sensor travado, não motor ligado - ex.: EOF5208 em 01/10/2026 mandou 1316
 * em todas as 1538 leituras, andando e parado. O padrão 0/1000 (liga/desliga) é legítimo, mas 1000 fixo por
 * mais de 6h também é suspeito.
 * @returns o valor travado, ou null se o RPM parece confiável
 */
export function rpmTravado(pts: PontoRota[]): number | null {
  if (pts.length < 30) return null;
  const valores = new Set(pts.map((p) => p.rpm));
  if (valores.size !== 1) return null;
  const v = [...valores][0];
  if (v <= 0) return null;
  if (v === 1000 && minutos(pts[0].t, pts.at(-1)!.t) <= 6 * 60) return null;
  return v;
}

/**
 * Intervalos [início, fim] em que o motor secundário esteve ligado. O rastreador dele manda RPM 0/1000;
 * buraco grande sem leitura encerra o intervalo em vez de supor que ficou ligado o tempo todo.
 */
export function intervalosLigado(pts: PontoRota[]): [string, string][] {
  const out: [string, string][] = [];
  let ini: string | null = null;
  let ult: string | null = null;
  for (const p of pts) {
    if (ini && ult && minutos(ult, p.t) > GAP_SEM_SINAL_MIN) {
      out.push([ini, ult]);
      ini = null;
    }
    if (p.rpm > 0 && !ini) ini = p.t;
    if (p.rpm <= 0 && ini) {
      out.push([ini, p.t]);
      ini = null;
    }
    ult = p.t;
  }
  if (ini && ult) out.push([ini, ult]);
  return out;
}

function sobreposicaoMin(a: string, b: string, intervalos: [string, string][]): number {
  let min = 0;
  for (const [ini, fim] of intervalos) {
    const i = ini > a ? ini : a;
    const f = fim < b ? fim : b;
    if (f > i) min += minutos(i, f);
  }
  return min;
}

interface PontoEnriquecido extends PontoRota {
  area: string;
  via: string;
  estado: EstadoTrecho;
}
interface TrechoBruto {
  estado: EstadoTrecho;
  inicio: string;
  fim?: string;
  pts: PontoEnriquecido[];
}

/**
 * Transforma os pontos em apontamento (trechos contínuos) + resumo do dia. Motor: RPM > 0 = ligado. Se o
 * veículo não manda RPM nenhum no dia, não dá pra afirmar ligado/desligado e a parada fica só "Parado".
 * pontosMotor2: pontos do motor secundário do caminhão (ver frota.ts), se houver.
 */
export function montarApontamento(pontos: PontoRota[], cercas: Cerca[], pontosMotor2: PontoRota[] | null = null): Apontamento {
  if (!pontos.length) return { trechos: [], resumo: null, temRpm: false, pontos: [], motor2: null };
  const travadoMotor2 = pontosMotor2 ? rpmTravado(pontosMotor2) : null;
  const motor2 = pontosMotor2 && travadoMotor2 == null ? intervalosLigado(pontosMotor2) : null;
  const travado = rpmTravado(pontos);
  const temRpm = travado == null && pontos.some((p) => p.rpm > 0);

  const enriquecidos: PontoEnriquecido[] = pontos.map((p) => {
    const dentro = cercasNoPonto(p.lat, p.lng, cercas);
    const area = dentro.find((c) => c.tipo === "area")?.name ?? "";
    const via = dentro.find((c) => c.tipo === "via")?.name ?? "";
    let estado: EstadoTrecho = "parado";
    if (p.vel >= VEL_MOVIMENTO) estado = "movimento";
    else if (temRpm) estado = p.rpm > 0 ? "parado_ligado" : "desligado";
    return { ...p, area, via, estado };
  });

  // trechos brutos: muda de estado = novo trecho; buraco grande = trecho "sem sinal"
  let trechos: TrechoBruto[] = [];
  for (let i = 0; i < enriquecidos.length; i++) {
    const p = enriquecidos[i];
    const ant = enriquecidos[i - 1];
    if (ant && minutos(ant.t, p.t) > GAP_SEM_SINAL_MIN) trechos.push({ estado: "sem_sinal", inicio: ant.t, fim: p.t, pts: [] });
    const atual = trechos.at(-1);
    if (atual && atual.estado === p.estado) atual.pts.push(p);
    else trechos.push({ estado: p.estado, inicio: p.t, pts: [p] });
  }
  // cada trecho vai até o começo do próximo (linha do tempo contínua)
  trechos.forEach((t, i) => {
    t.fim = trechos[i + 1]?.inicio ?? t.fim ?? t.pts.at(-1)!.t;
  });

  // suaviza: trecho curto (ex.: parou 40 s no cruzamento) é absorvido pelo anterior
  const suavizados: TrechoBruto[] = [];
  for (const t of trechos) {
    const anterior = suavizados.at(-1);
    const curto = t.estado !== "sem_sinal" && minutos(t.inicio, t.fim!) < SEGMENTO_MIN;
    if (anterior && (curto || anterior.estado === t.estado) && anterior.estado !== "sem_sinal") {
      anterior.fim = t.fim;
      anterior.pts.push(...t.pts);
    } else {
      suavizados.push({ ...t, pts: [...t.pts] });
    }
  }
  trechos = suavizados;

  const resultado: Trecho[] = trechos.map((t): Trecho => {
    const fim = t.fim!;
    const duracao_min = Math.round(minutos(t.inicio, fim));
    const extra = motor2 ? { motor2_min: Math.round(sobreposicaoMin(t.inicio, fim, motor2)) } : {};
    if (t.estado === "movimento") {
      // sequência de lugares por onde passou, sem repetir o mesmo seguido
      const percurso: string[] = [];
      for (const p of t.pts) {
        const lugar = p.area || p.via;
        if (lugar && percurso.at(-1) !== lugar) percurso.push(lugar);
      }
      let km = 0;
      for (let i = 1; i < t.pts.length; i++) km += distanciaM(t.pts[i - 1], t.pts[i]) / 1000;
      return {
        estado: t.estado, inicio: t.inicio, fim, duracao_min,
        de: t.pts[0]?.area || t.pts[0]?.via || "", para: t.pts.at(-1)?.area || t.pts.at(-1)?.via || "",
        percurso, km: Math.round(km * 10) / 10, vel_max: Math.max(0, ...t.pts.map((p) => p.vel)), ...extra,
      };
    }
    // parado: o lugar onde passou mais tempo nesse trecho
    const conta: Record<string, number> = {};
    for (const p of t.pts) {
      const lugar = p.area || p.via || "Fora de cerca";
      conta[lugar] = (conta[lugar] ?? 0) + 1;
    }
    const local = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0] ?? "";
    const ref = t.pts[Math.floor(t.pts.length / 2)];
    return { estado: t.estado, inicio: t.inicio, fim, duracao_min, local, lat: ref?.lat, lng: ref?.lng, ...extra };
  });

  const total = (estado: EstadoTrecho) => resultado.filter((t) => t.estado === estado).reduce((s, t) => s + t.duracao_min, 0);
  // tempo por área: soma do intervalo até o próximo ponto (limitado, pra buraco não inflar)
  const tempoArea: Record<string, number> = {};
  for (let i = 0; i < enriquecidos.length - 1; i++) {
    const p = enriquecidos[i];
    if (!p.area) continue;
    tempoArea[p.area] = (tempoArea[p.area] ?? 0) + Math.min(minutos(p.t, enriquecidos[i + 1].t), GAP_SEM_SINAL_MIN);
  }

  return {
    temRpm,
    rpm_travado: travado,
    motor2_rpm_travado: travadoMotor2,
    trechos: resultado,
    resumo: {
      primeiro: pontos[0].t,
      ultimo: pontos.at(-1)!.t,
      pontos: pontos.length,
      // só os trechos em movimento têm km (no JS: t.km ?? 0, mesmo resultado)
      km: Math.round(resultado.reduce((s, t) => s + (t.estado === "movimento" ? t.km : 0), 0) * 10) / 10,
      vel_max: Math.max(0, ...pontos.map((p) => p.vel)),
      movimento_min: total("movimento"),
      parado_ligado_min: total("parado_ligado"),
      desligado_min: total("desligado"),
      parado_min: total("parado"),
      sem_sinal_min: total("sem_sinal"),
      motor2_ligado_min: motor2 ? Math.round(motor2.reduce((s, [a, b]) => s + minutos(a, b), 0)) : null,
      areas: Object.entries(tempoArea)
        .map(([area, min]) => ({ area, min: Math.round(min) }))
        .filter((a) => a.min >= 1)
        .sort((a, b) => b.min - a.min),
    },
    // pontos leves pro mapa: [lat, lng, hora, km/h, estado, motor 2º ligado (1/0, ou null sem motor 2º)]
    pontos: enriquecidos.map((p): PontoMapa => [p.lat, p.lng, p.t.slice(11, 19), p.vel, p.estado, motor2 ? (motor2.some(([a, b]) => p.t >= a && p.t <= b) ? 1 : 0) : null]),
    motor2: motor2 ? { intervalos: motor2.map(([a, b]): [string, string] => [a.slice(11, 19), b.slice(11, 19)]) } : null,
  };
}
