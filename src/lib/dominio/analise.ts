// Mapa de análise (desenho: docs/superpowers/specs/2026-10-08-mapa-de-analise-design.md): as paradas dos últimos 30 dias
// (tabela analise_paradas, só fatos) viram números por local com as regras de produtividade.ts. Tudo puro; a tela só desenha.
import type { LatLng, TipoEquip, Veiculo } from "../tipos";
import { areaPoligono, dentroDoPoligono, distanciaM } from "./geo";
import { ehBase, statusProdutivo } from "./produtividade";

/** Uma linha de analise_paradas. */
export interface ParadaAnalise {
  dia: string;
  veiculo_id: string;
  placa: string;
  /** segundos do dia */
  ini: number;
  fim: number;
  lat: number;
  lng: number;
  /** cerca do GAUSS (a menor); null = fora das cercas */
  area: string | null;
  /** minutos de cada status do motor do GAUSS durante a parada */
  motor: Record<string, number>;
  /** categorias do tablet que cobrem a parada */
  apont: string[];
}

export const CATEGORIAS_LOCAL = ["Serviço", "Espera/passagem", "Base", "Base/pernoite", "Oficina/apoio", "Descarte", "Abastecimento"] as const;
export type CategoriaLocal = (typeof CATEGORIAS_LOCAL)[number];
export const MEDIDAS = ["produtivo", "sem_produzir", "parado", "visitas", "categoria", "apontamento"] as const;
export type Medida = (typeof MEDIDAS)[number];
/** Medidas com número (as outras pintam por categoria ou apontamento). */
export type MedidaNumerica = Exclude<Medida, "categoria" | "apontamento">;
export const FAIXAS = ["madrugada", "manha", "tarde", "noite"] as const;
export type Faixa = (typeof FAIXAS)[number];
export const PERIODOS = ["7", "15", "30"] as const;
export type Periodo = (typeof PERIODOS)[number];

export interface EquipAnalise {
  id: string;
  nome: string;
  tipo: TipoEquip;
  supervisor: string | null;
  regime: string | null;
  /** status produtivo (statusProdutivo); null = o tipo não tem regra */
  produtivo: string | null;
}
export interface Local {
  /** nome da cerca, ou "ponto:N" fora das cercas */
  chave: string;
  nome: string;
  cerca: boolean;
  lat: number;
  lng: number;
  categoria: CategoriaLocal;
  /** produtivo aqui não conta (vira "motor ligado na base") */
  naBase: boolean;
  /** na região (até 50 km da Usiminas: Poço Redondo, Aterro, oficinas de fora...); longe dela, vai para a linha "Longe da região" */
  naRegiao: boolean;
}
export interface ParadaNoLocal extends ParadaAnalise {
  local: string;
  equip: EquipAnalise;
}
export interface FiltroAnalise {
  hoje: string;
  periodo: number;
  tipo: TipoEquip | null;
  supervisor: string | null;
  regime: string | null;
  /** vazio = todas */
  faixas: Faixa[];
  /** 0 = domingo ... 6 = sábado; vazio = todos */
  diasSemana: number[];
}
export interface EquipNoLocal {
  id: string;
  nome: string;
  visitas: number;
  min: number;
  ultimoDia: string;
}
export interface ResumoLocal {
  local: Local;
  visitas: number;
  /** minutos */
  parado: number;
  produtivo: number;
  base: number;
  semProduzir: number;
  /** tempo parado dos equipamentos com regra e com dado de motor (base do % produtivo, como a regra dos 15%) */
  paradoComRegra: number;
  porEquip: EquipNoLocal[];
  /** minutos parados pela hora de início (0–23) */
  porHora: number[];
  apont: { nome: string; n: number }[];
  /** só na linha "Longe da região": os lugares e o tempo parado em cada um */
  partes?: { nome: string; parado: number }[];
}

const RAIO_PONTO_M = 120;
const MIN_VISITAS_PONTO = 3;
const LIGADO = ["on", "stopped", "secondary_motor_on"];
const H = 3600;

function agruparPor<T>(xs: T[], chave: (x: T) => string): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of xs) {
    const k = chave(x);
    const l = m.get(k);
    if (l) l.push(x);
    else m.set(k, [x]);
  }
  return m;
}
const centro = (poly: LatLng[]): LatLng => [poly.reduce((n, p) => n + p[0], 0) / poly.length, poly.reduce((n, p) => n + p[1], 0) / poly.length];
export const minutos = (p: ParadaAnalise) => (p.fim - p.ini) / 60;

/** O tipo tem regra de produtividade? (Hiper Vácuo, Ultravac, Brook e Aspiradores não têm) */
export const temRegra = (tipo: TipoEquip) => statusProdutivo(tipo, "") !== null;

/** Cercas da maior para a menor: a pequena é desenhada por cima e recebe o mouse e o clique. */
export const ordemDeDesenho = <A extends { polygon: LatLng[] }>(areas: A[]): A[] => [...areas].sort((a, b) => areaPoligono(b.polygon) - areaPoligono(a.polygon));

/** Contorno da usina: a cerca de planta "PLANTA USIMINAS" (null = sem contorno: tudo conta como dentro). */
export function contornoDaUsina(cercas: { name: string; tipo: string; polygon: LatLng[] }[]): LatLng[] | null {
  return cercas.find((c) => c.tipo === "planta" && /^PLANTA USIMINAS$/i.test(c.name.trim()) && c.polygon.length >= 3)?.polygon ?? null;
}
/** Até onde vai a região do mapa: todas as plantas da Usiminas e arredores ficam a menos de 10 km; 50 km dá folga. */
export const RAIO_REGIAO_KM = 50;
const centroDaUsina = (usina: LatLng[]) => {
  const [lat, lng] = centro(usina);
  return { lat, lng };
};
/** O ponto está na região (sem contorno da usina: tudo está)? */
const naRegiaoDe = (usina: LatLng[] | null, lat: number, lng: number) => !usina || distanciaM(centroDaUsina(usina), { lat, lng }) <= RAIO_REGIAO_KM * 1000;

/** Plantas que o mapa mostra (Usiminas, Poço Redondo, Aterro, oficinas de fora...): as da região. */
export function plantasDaRegiao<C extends { name: string; tipo: string; polygon: LatLng[] }>(cercas: C[]): C[] {
  const usina = contornoDaUsina(cercas);
  return cercas.filter((c) => c.tipo === "planta" && c.polygon.length >= 3 && naRegiaoDe(usina, ...centro(c.polygon)));
}

/** O Pátio do Transporte é a base: sai da análise (decisão do dono, 08/10/2026). A Baia de Resíduos, dentro dele, fica. */
export const ehPatioDaBase = (area: string | null) => !!area && /P[ÁA]TIO DO TRANSPORTE/i.test(area);

/** Mata CDP e USIPA saem da análise (decisão do dono, 13/10/2026): a planta e a cerca de mesmo nome. "ESTACIONAMENTO RESTAURANTE DA MATA" fica. */
export const ehExcluidaDaAnalise = (nome: string | null) => !!nome && /^(PLANTA )?(MATA CDP|USIPA)$/i.test(nome.trim());
/** Cercas sem as excluídas da análise. */
export const semExcluidas = <C extends { name: string }>(cercas: C[]): C[] => cercas.filter((c) => !ehExcluidaDaAnalise(c.name));
/** Polígonos das plantas excluídas: a parada SEM cerca anotada que cai dentro delas também sai (com cerca, vale o nome dela). */
export const plantasExcluidas = (cercas: { name: string; tipo: string; polygon: LatLng[] }[]): LatLng[][] =>
  cercas.filter((c) => c.tipo === "planta" && c.polygon.length >= 3 && ehExcluidaDaAnalise(c.name)).map((c) => c.polygon);

/** Cercas que o mapa desenha: as da região (sem contorno da usina: todas), nunca o Pátio da base. */
export function areasDaRegiao<A extends { name: string; polygon: LatLng[] }>(areas: A[], usina: LatLng[] | null): A[] {
  return areas.filter((a) => a.polygon.length >= 3 && !ehPatioDaBase(a.name) && naRegiaoDe(usina, ...centro(a.polygon)));
}

/** Equipamentos da frota (matriz) que entram na análise, sem o motor 2º. */
export function equipDaFrota(veiculos: Veiculo[]): Map<string, EquipAnalise> {
  const m = new Map<string, EquipAnalise>();
  for (const v of veiculos) {
    if (v.motor2_de || !v.equip) continue;
    m.set(v.id, { id: v.id, nome: v.equip.nome, tipo: v.equip.tipo, supervisor: v.equip.supervisor ?? null, regime: v.equip.regime ?? null, produtivo: statusProdutivo(v.equip.tipo, v.placa) });
  }
  return m;
}

/** Faixa do dia pela hora de início da parada. */
export const faixaDe = (ini: number): Faixa => (ini < 6 * H ? "madrugada" : ini < 12 * H ? "manha" : ini < 18 * H ? "tarde" : "noite");
/** 0 = domingo ... 6 = sábado */
export const diaDaSemana = (dia: string) => new Date(`${dia}T12:00:00Z`).getUTCDay();
/** "AAAA-MM-DD" menos n dias */
export function diaMenos(dia: string, n: number): string {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

/** Último dia com paradas quando é anterior a ontem (o envio do histórico parou); null se está em dia ou sem dados. */
export function ultimoDiaVelho(paradas: { dia: string }[], hoje: string): string | null {
  if (!paradas.length) return null;
  const ultimo = paradas.reduce((m, p) => (p.dia > m ? p.dia : m), paradas[0].dia);
  return ultimo < diaMenos(hoje, 1) ? ultimo : null;
}

/** Categoria que o nome já diz (a mesma regra do classificar.js). */
export function categoriaPeloNome(nome: string): CategoriaLocal | null {
  const n = nome.toUpperCase();
  if (/P[ÁA]TIO DO TRANSPORTE|GARAGEM/.test(n)) return "Base";
  if (/ABAST|POSTO|COMBUST/.test(n)) return "Abastecimento";
  if (/BAIA DE RES|ATERRO|DESCARTE/.test(n)) return "Descarte";
  if (/OFICINA|ALMOXARIFADO|LAVADOR|LAVAGEM/.test(n)) return "Oficina/apoio";
  return null;
}

/**
 * Local de cada parada: a cerca do GAUSS ou, fora das cercas, um "ponto" (paradas a menos de 120 m vistas 3 ou mais vezes;
 * as outras ficam de fora). Só entram os equipamentos da frota. Pontos e categorias olham os 30 dias inteiros (sem filtros),
 * para não mudarem ao filtrar.
 */
export function montarLocais(
  paradas: ParadaAnalise[],
  areas: { name: string; polygon: LatLng[] }[],
  equip: Map<string, EquipAnalise>,
  usina: LatLng[] | null = null,
  excluidas: LatLng[][] = [],
): { locais: Map<string, Local>; paradas: ParadaNoLocal[] } {
  const centroDe = new Map(areas.filter((a) => a.polygon.length >= 3).map((a) => [a.name, centro(a.polygon)] as const));
  const comEquip: ParadaNoLocal[] = paradas.flatMap((p) => {
    const e = equip.get(p.veiculo_id);
    return e && !ehPatioDaBase(p.area) && !ehExcluidaDaAnalise(p.area) && !(p.area == null && excluidas.some((pl) => dentroDoPoligono(p.lat, p.lng, pl))) ? [{ ...p, equip: e, local: p.area ?? "" }] : [];
  });

  // fora das cercas: grade de ~110 m, cada parada comparada só com os grupos das 9 casas vizinhas
  type Grupo = { lat: number; lng: number; soma: [number, number]; itens: ParadaNoLocal[] };
  const grupos: Grupo[] = [];
  const grade = new Map<string, Grupo[]>();
  for (const p of comEquip) {
    if (p.area) continue;
    const ci = Math.floor(p.lat / 0.001);
    const cj = Math.floor(p.lng / 0.001);
    let g: Grupo | null = null;
    for (let di = -1; di <= 1 && !g; di++) for (let dj = -1; dj <= 1 && !g; dj++) g = (grade.get(`${ci + di},${cj + dj}`) ?? []).find((x) => distanciaM(x, p) <= RAIO_PONTO_M) ?? null;
    if (g) {
      g.itens.push(p);
      g.soma[0] += p.lat;
      g.soma[1] += p.lng;
      g.lat = g.soma[0] / g.itens.length;
      g.lng = g.soma[1] / g.itens.length;
    } else {
      g = { lat: p.lat, lng: p.lng, soma: [p.lat, p.lng], itens: [p] };
      grupos.push(g);
      const k = `${ci},${cj}`;
      grade.set(k, [...(grade.get(k) ?? []), g]);
    }
  }
  const locais = new Map<string, Local>();
  let n = 0;
  for (const g of grupos.sort((a, b) => b.itens.length - a.itens.length)) {
    if (g.itens.length < MIN_VISITAS_PONTO) continue; // avulso: fica de fora (local "")
    const perto = [...centroDe].map(([nome, c]) => [nome, distanciaM(g, { lat: c[0], lng: c[1] })] as const).sort((a, b) => a[1] - b[1])[0];
    const chave = `ponto:${++n}`;
    locais.set(chave, { chave, nome: `Ponto ${n}${perto ? ` · perto de ${perto[0]} (${Math.round(perto[1])} m)` : ""}`, cerca: false, lat: g.lat, lng: g.lng, categoria: "Espera/passagem", naBase: false, naRegiao: true });
    for (const p of g.itens) p.local = chave;
  }
  const noLocal = comEquip.filter((p) => p.local);
  for (const p of noLocal) {
    if (!p.area || locais.has(p.area)) continue;
    const c = centroDe.get(p.area) ?? [p.lat, p.lng];
    locais.set(p.area, { chave: p.area, nome: p.area, cerca: true, lat: c[0], lng: c[1], categoria: "Espera/passagem", naBase: false, naRegiao: true });
  }

  // categoria: pelo nome; senão produz em 15%+ do tempo parado com motor = Serviço; parada média de 2 h+ = Base/pernoite
  for (const [chave, ps] of agruparPor(noLocal, (p) => p.local)) {
    const l = locais.get(chave)!;
    const comMotor = ps.filter((p) => p.equip.produtivo && Object.keys(p.motor).length);
    const minComMotor = comMotor.reduce((s, p) => s + minutos(p), 0);
    const prod = comMotor.reduce((s, p) => s + (p.motor[p.equip.produtivo!] ?? 0), 0);
    const media = ps.reduce((s, p) => s + minutos(p), 0) / ps.length;
    l.categoria = (l.cerca ? categoriaPeloNome(l.nome) : null) ?? (minComMotor && prod / minComMotor >= 0.15 ? "Serviço" : media >= 120 ? "Base/pernoite" : "Espera/passagem");
    l.naBase = l.categoria === "Base/pernoite" || (l.cerca && ehBase(l.nome));
    l.naRegiao = naRegiaoDe(usina, l.lat, l.lng);
  }
  return { locais, paradas: noLocal };
}

/** Minutos da parada: produtivo que conta, motor ligado na base e ligado sem produzir. null = o tipo não tem regra. */
export function valoresDaParada(p: ParadaNoLocal, naBase: boolean): { produtivo: number | null; base: number; semProduzir: number | null } {
  const cod = p.equip.produtivo;
  if (!cod) return { produtivo: null, base: 0, semProduzir: null };
  const ligado = LIGADO.reduce((n, c) => n + (p.motor[c] ?? 0), 0);
  const prod = p.motor[cod] ?? 0;
  return naBase ? { produtivo: 0, base: prod, semProduzir: ligado } : { produtivo: prod, base: 0, semProduzir: Math.max(0, ligado - prod) };
}

/** Paradas do período (últimos N dias até hoje) e dos filtros escolhidos. */
export function filtrar(paradas: ParadaNoLocal[], f: FiltroAnalise): ParadaNoLocal[] {
  const desde = diaMenos(f.hoje, f.periodo);
  return paradas.filter(
    (p) =>
      p.dia > desde &&
      p.dia <= f.hoje &&
      (!f.tipo || p.equip.tipo === f.tipo) &&
      (!f.supervisor || p.equip.supervisor === f.supervisor) &&
      (!f.regime || p.equip.regime === f.regime) &&
      (!f.faixas.length || f.faixas.includes(faixaDe(p.ini))) &&
      (!f.diasSemana.length || f.diasSemana.includes(diaDaSemana(p.dia))),
  );
}

/** Números de cada local com paradas (quem atende, horário, apontamentos). */
export function resumir(paradas: ParadaNoLocal[], locais: Map<string, Local>): ResumoLocal[] {
  const out: ResumoLocal[] = [];
  for (const [chave, ps] of agruparPor(paradas, (p) => p.local)) {
    const local = locais.get(chave);
    if (!local) continue;
    const r: ResumoLocal = { local, visitas: ps.length, parado: 0, produtivo: 0, base: 0, semProduzir: 0, paradoComRegra: 0, porEquip: [], porHora: Array<number>(24).fill(0), apont: [] };
    const eq = new Map<string, EquipNoLocal>();
    const ap = new Map<string, number>();
    for (const p of ps) {
      const min = minutos(p);
      const v = valoresDaParada(p, local.naBase);
      r.parado += min;
      r.base += v.base;
      if (v.produtivo != null) {
        r.produtivo += v.produtivo;
        r.semProduzir += v.semProduzir ?? 0;
        if (Object.keys(p.motor).length) r.paradoComRegra += min;
      }
      r.porHora[Math.min(23, Math.floor(p.ini / H))] += min;
      const e = eq.get(p.equip.id) ?? { id: p.equip.id, nome: p.equip.nome, visitas: 0, min: 0, ultimoDia: p.dia };
      e.visitas++;
      e.min += min;
      if (p.dia > e.ultimoDia) e.ultimoDia = p.dia;
      eq.set(e.id, e);
      for (const a of p.apont) ap.set(a, (ap.get(a) ?? 0) + 1);
    }
    r.porEquip = [...eq.values()].sort((a, b) => b.min - a.min);
    r.apont = [...ap].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);
    out.push(r);
  }
  return out;
}

/** Número da medida (tipo de local e apontamento ordenam o ranking pelas visitas). */
export function valorDe(r: ResumoLocal, m: Medida): number {
  return m === "produtivo" ? r.produtivo : m === "sem_produzir" ? r.semProduzir : m === "parado" ? r.parado : r.visitas;
}
/** Os n locais com mais da medida (só os que têm valor). */
export const ranking = (rs: ResumoLocal[], m: Medida, n = 10) =>
  rs
    .filter((r) => valorDe(r, m) > 0)
    .sort((a, b) => valorDe(b, m) - valorDe(a, m))
    .slice(0, n);

/** Chave da linha "Longe da região". */
export const CHAVE_FORA = "fora";

/** Separa os resumos: os da região (mapa e ranking) e a linha "Longe da região" (soma dos locais longe, com as partes). */
export function separarFora(rs: ResumoLocal[]): { dentro: ResumoLocal[]; fora: ResumoLocal | null } {
  const dentro = rs.filter((r) => r.local.naRegiao);
  const de = rs.filter((r) => !r.local.naRegiao);
  if (!de.length) return { dentro, fora: null };
  const local: Local = { chave: CHAVE_FORA, nome: "Longe da região (mais de 50 km)", cerca: false, lat: 0, lng: 0, categoria: "Espera/passagem", naBase: false, naRegiao: false };
  const fora: ResumoLocal = { local, visitas: 0, parado: 0, produtivo: 0, base: 0, semProduzir: 0, paradoComRegra: 0, porEquip: [], porHora: Array<number>(24).fill(0), apont: [], partes: [] };
  const eq = new Map<string, EquipNoLocal>();
  const ap = new Map<string, number>();
  for (const r of de) {
    fora.visitas += r.visitas;
    fora.parado += r.parado;
    fora.produtivo += r.produtivo;
    fora.base += r.base;
    fora.semProduzir += r.semProduzir;
    fora.paradoComRegra += r.paradoComRegra;
    r.porHora.forEach((m, h) => (fora.porHora[h] += m));
    for (const e of r.porEquip) {
      const t = eq.get(e.id) ?? { ...e, visitas: 0, min: 0 };
      t.visitas += e.visitas;
      t.min += e.min;
      if (e.ultimoDia > t.ultimoDia) t.ultimoDia = e.ultimoDia;
      eq.set(e.id, t);
    }
    for (const a of r.apont) ap.set(a.nome, (ap.get(a.nome) ?? 0) + a.n);
    fora.partes!.push({ nome: r.local.nome, parado: r.parado });
  }
  fora.porEquip = [...eq.values()].sort((a, b) => b.min - a.min);
  fora.apont = [...ap].map(([nome, n]) => ({ nome, n })).sort((a, b) => b.n - a.n);
  fora.partes!.sort((a, b) => b.parado - a.parado);
  return { dentro, fora };
}

/** Totais do período (resumo da esquerda); `areas` = quantos locais tiveram parada. */
export function totais(rs: ResumoLocal[]) {
  const t = { produtivo: 0, semProduzir: 0, parado: 0, paradoComRegra: 0, base: 0, areas: rs.length };
  for (const r of rs) {
    t.produtivo += r.produtivo;
    t.semProduzir += r.semProduzir;
    t.parado += r.parado;
    t.paradoComRegra += r.paradoComRegra;
    t.base += r.base;
  }
  return t;
}

/** Clique no painel: o lugar (bolha ou ranking), o serviço (apontamento), a hora de início e a placa escolhidos. */
export interface SelecaoCruzada {
  local: string | null;
  servico: string | null;
  hora: number | null;
  placa: string | null;
}
export type DimensaoSelecao = keyof SelecaoCruzada;
export const SELECAO_VAZIA: SelecaoCruzada = { local: null, servico: null, hora: null, placa: null };
/** Hora (0–23) do início da parada. */
export const horaDe = (ini: number) => Math.min(23, Math.floor(ini / H));

/** Paradas da seleção. `ignorar` pula uma dimensão: o gráfico dela mostra todas as opções e destaca a escolhida. */
export function filtrarSelecao(paradas: ParadaNoLocal[], sel: SelecaoCruzada, locais: Map<string, Local>, ignorar?: DimensaoSelecao): ParadaNoLocal[] {
  const noLocal = (p: ParadaNoLocal) => (sel.local === CHAVE_FORA ? locais.get(p.local)?.naRegiao === false : p.local === sel.local);
  return paradas.filter(
    (p) =>
      (ignorar === "local" || !sel.local || noLocal(p)) &&
      (ignorar === "servico" || !sel.servico || p.apont.includes(sel.servico)) &&
      (ignorar === "hora" || sel.hora == null || horaDe(p.ini) === sel.hora) &&
      (ignorar === "placa" || !sel.placa || p.placa === sel.placa),
  );
}

/** Nome da barra que junta os serviços depois dos 10 primeiros (não é um serviço: não vira filtro). */
export const OUTROS = "Outros";
const MAX_SERVICOS = 10;
/** Paradas por apontamento do tablet, do maior ao menor (a parada com 2 apontamentos conta nos dois); depois do 10º, "Outros". */
export function porServico(paradas: ParadaNoLocal[]): { nome: string; n: number; min: number }[] {
  const m = new Map<string, { nome: string; n: number; min: number }>();
  for (const p of paradas) {
    for (const a of new Set(p.apont)) {
      const s = m.get(a) ?? { nome: a, n: 0, min: 0 };
      s.n++;
      s.min += minutos(p);
      m.set(a, s);
    }
  }
  const xs = [...m.values()].sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome));
  if (xs.length <= MAX_SERVICOS) return xs;
  const resto = xs.slice(MAX_SERVICOS);
  return [...xs.slice(0, MAX_SERVICOS), { nome: OUTROS, n: resto.reduce((s, x) => s + x.n, 0), min: resto.reduce((s, x) => s + x.min, 0) }];
}
/** Os n serviços com mais paradas: ganham cor no mapa. Calcular sobre os 30 dias inteiros, para a cor não trocar ao filtrar. */
export const servicosPrincipais = (paradas: ParadaNoLocal[], n = 3): string[] =>
  porServico(paradas)
    .filter((s) => s.nome !== OUTROS)
    .slice(0, n)
    .map((s) => s.nome);

/** Minutos parados pela hora de início (0–23). */
export function porHora(paradas: ParadaNoLocal[]): number[] {
  const h = Array<number>(24).fill(0);
  for (const p of paradas) h[horaDe(p.ini)] += minutos(p);
  return h;
}

/** Os 4 números do placar. `produtivo` e `pct` = null quando nenhuma parada tem regra de produtividade com dado de motor. */
export interface Placar {
  produtivo: number | null;
  pct: number | null;
  parado: number;
  servicos: number;
}
export function placar(paradas: ParadaNoLocal[], locais: Map<string, Local>): Placar {
  let produtivo = 0;
  let comRegra = 0;
  let parado = 0;
  let servicos = 0;
  for (const p of paradas) {
    const min = minutos(p);
    parado += min;
    if (p.apont.length) servicos++;
    const v = valoresDaParada(p, locais.get(p.local)?.naBase ?? false);
    if (v.produtivo != null && Object.keys(p.motor).length) {
      produtivo += v.produtivo;
      comRegra += min;
    }
  }
  return { produtivo: comRegra ? produtivo : null, pct: comRegra ? produtivo / comRegra : null, parado, servicos };
}

const RAIO_MIN = 5;
const RAIO_MAX = 28;
/** Raio da bolha em pixels: a ÁREA cresce com as horas paradas (raiz quadrada), com um mínimo que dá para clicar. */
export const raioDaBolha = (min: number, max: number) => (max <= 0 ? RAIO_MIN : Math.max(RAIO_MIN, RAIO_MAX * Math.sqrt(min / max)));

/** Lugares do gráfico: os n com mais tempo parado, o escolhido (se ficou fora dos n, para aparecer em destaque) e, no fim, "Longe da região". */
export function lugaresDoGrafico(dentro: ResumoLocal[], fora: ResumoLocal | null, escolhido: string | null, n = 10): ResumoLocal[] {
  const top = ranking(dentro, "parado", n);
  const extra = escolhido && escolhido !== CHAVE_FORA && !top.some((r) => r.local.chave === escolhido) ? dentro.filter((r) => r.local.chave === escolhido) : [];
  return [...top, ...extra, ...(fora ? [fora] : [])];
}

/** Furos da máscara preta: as plantas que não estão dentro de outra maior (furo dentro de furo voltaria a ficar preto). */
export function buracosDaMascara(plantas: { polygon: LatLng[] }[]): LatLng[][] {
  const ps = plantas.filter((pl) => pl.polygon.length >= 3);
  return ps
    .filter((pl) => {
      const [lat, lng] = centro(pl.polygon);
      const a = areaPoligono(pl.polygon);
      return !ps.some((q) => q !== pl && areaPoligono(q.polygon) > a && dentroDoPoligono(lat, lng, q.polygon));
    })
    .map((pl) => pl.polygon);
}

/** Pontos do mapa de calor: [lat, lng, peso]; peso = minutos ÷ percentil 95 das paradas, no máximo 1 (uma parada enorme não apaga as outras). */
export function pontosDoCalor(paradas: ParadaAnalise[]): [number, number, number][] {
  const mins = paradas.map(minutos).sort((a, b) => a - b);
  const p95 = mins[Math.floor(0.95 * (mins.length - 1))] ?? 0;
  return p95 <= 0 ? [] : paradas.map((p) => [p.lat, p.lng, Math.min(1, minutos(p) / p95)]);
}
