// Cronoanálise × telemetria (desenho em docs/superpowers/specs/2026-10-14-cronoanalise-design.md).
// Junta as folhas da cronoanálise (crono_registros) com a timeline de motor do GAUSS e os apontamentos do tablet
// numa régua só: segundos desde o início do turno. Só regras puras (sem banco, sem tela).
import type { TipoEquip, Tom } from "../tipos";
import { pad } from "./formato";
import { montarStatusGauss, montarTablet, type ApontamentoTablet, type BlocoGauss, type LinhaMotorGauss, type LinhaTablet } from "./gauss-dia";
import { statusProdutivo } from "./produtividade";

const DIA = 86400;
/** Turnos do 4x4 (regra do dono, 14/10/2026): dia 06:40–18:40, noite 18:40–06:40 do dia seguinte. */
const INICIO_DIA = 6 * 3600 + 40 * 60;
const INICIO_NOITE = 18 * 3600 + 40 * 60;
const DURACAO = 12 * 3600;

/** Linha crua de crono_registros (só o que a tela usa). */
export interface LinhaCrono {
  data: string;
  turno: string | null;
  horario: string | null;
  area: string | null;
  nome: string | null;
  papel: string | null;
  placa: string | null;
  vaga: string | null;
  equip: string | null;
  hi: string | null;
  hf: string | null;
  cod: number | null;
  descricao: string | null;
  cls: string | null;
  obs: string | null;
  supervisor: string | null;
  kit: string | null;
}

export type Classe = "produzindo" | "necessario" | "improdutivo" | "sem";
export const CLASSES: Record<Classe, { rotulo: string; tom: Tom }> = {
  produzindo: { rotulo: "Produzindo", tom: "ok" },
  necessario: { rotulo: "Improdutivo necessário", tom: "warn" },
  improdutivo: { rotulo: "Improdutivo", tom: "bad" },
  sem: { rotulo: "Sem código", tom: "neu" },
};

export function classeDe(cls: string | null): Classe {
  const c = (cls ?? "").toLowerCase();
  if (c.startsWith("produz")) return "produzindo";
  if (c.includes("necess")) return "necessario";
  if (c.startsWith("improdut")) return "improdutivo";
  return "sem";
}

/** Um pedaço do turno (segundos desde o início do turno). */
export interface BlocoCrono {
  a: number;
  b: number;
  cod: number | null;
  descricao: string;
  classe: Classe;
  obs: string | null;
}
export interface PessoaCrono {
  nome: string;
  papel: string;
  blocos: BlocoCrono[];
}
export interface TurnoCrono {
  chave: string;
  data: string;
  letra: string;
  periodo: "dia" | "noite";
  supervisor: string | null;
  placa: string;
  vaga: string | null;
  equip: string | null;
  area: string | null;
  kit: string | null;
  /** início da régua: "AAAA-MM-DDTHH:MM:SS" (hora local) */
  inicio: string;
  /** tamanho da régua em segundos (12 h, ou mais se a folha passar do horário) */
  duracao: number;
  pessoas: PessoaCrono[];
}

const ORDEM_PAPEL = ["motorista", "operador 1", "operador 2", "operador"];
const ordemPapel = (p: string) => {
  const i = ORDEM_PAPEL.indexOf(p.toLowerCase());
  return i < 0 ? ORDEM_PAPEL.length : i;
};

/** "19h às 07h", "19–07" ou "18:40" → noite; o resto é dia. Sem horário: noite se a folha tem hora de madrugada. */
export function periodoDoTurno(horario: string | null, linhas: Pick<LinhaCrono, "hi">[] = []): "dia" | "noite" {
  const h = (horario ?? "").trim();
  if (/^(18|19)/.test(h)) return "noite";
  if (/^0?[5-8]/.test(h)) return "dia";
  return linhas.some((l) => l.hi && l.hi < "05:00") ? "noite" : "dia";
}

/** "HH:MM" da folha → segundos desde 00:00 do dia do turno (na noite, antes do meio-dia é o dia seguinte). */
export function segDaFolha(hhmm: string, periodo: "dia" | "noite"): number {
  const [h, m] = hhmm.split(":").map(Number);
  const s = h * 3600 + (m || 0) * 60;
  return periodo === "noite" && s < 12 * 3600 ? s + DIA : s;
}

const somarDias = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Segundos desde 00:00 de `dia` de um carimbo "AAAA-MM-DD HH:MM:SS" (ou com T). */
export function segDesde(dia: string, ts: string): number {
  const d = ts.slice(0, 10);
  const [h, m, s] = ts.slice(11, 19).split(":").map(Number);
  const dias = Math.round((Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) - Date.UTC(+dia.slice(0, 4), +dia.slice(5, 7) - 1, +dia.slice(8, 10))) / 86400000);
  return dias * DIA + h * 3600 + (m || 0) * 60 + (s || 0);
}

const limpaPlaca = (p: string) => p.replace(/[^A-Za-z0-9]/g, "").toUpperCase();

/** Agrupa as folhas em turnos (dia + letra + placa), do mais recente para o mais antigo. */
export function montarTurnos(linhas: LinhaCrono[]): TurnoCrono[] {
  const grupos = new Map<string, LinhaCrono[]>();
  for (const l of linhas) {
    if (!l.placa || !l.data) continue;
    const chave = `${l.data}|${l.turno ?? "?"}|${limpaPlaca(l.placa)}`;
    grupos.set(chave, [...(grupos.get(chave) ?? []), l]);
  }
  const turnos: TurnoCrono[] = [];
  for (const [chave, ls] of grupos) {
    const l0 = ls[0];
    const periodo = periodoDoTurno(l0.horario, ls);
    const base = periodo === "noite" ? INICIO_NOITE : INICIO_DIA;
    const pessoas = new Map<string, PessoaCrono>();
    let menor = base;
    let maior = base + DURACAO;
    const crus: { pessoa: PessoaCrono; a: number; b: number; l: LinhaCrono }[] = [];
    for (const l of ls) {
      if (!l.hi || !l.hf) continue;
      const nome = (l.nome ?? "").trim() || (l.papel ?? "Sem nome");
      const papel = (l.papel ?? "").trim() || "Colaborador";
      const id = `${papel}|${nome}`;
      if (!pessoas.has(id)) pessoas.set(id, { nome, papel, blocos: [] });
      const a = segDaFolha(l.hi, periodo);
      let b = segDaFolha(l.hf, periodo);
      if (b <= a) b += DIA; // passou da meia-noite no turno do dia (ou folha com hora trocada)
      if (b - a > DURACAO) continue; // hora impossível: fica fora (não estica o turno)
      menor = Math.min(menor, a);
      maior = Math.max(maior, b);
      crus.push({ pessoa: pessoas.get(id)!, a, b, l });
    }
    for (const { pessoa, a, b, l } of crus) {
      pessoa.blocos.push({ a: a - menor, b: b - menor, cod: l.cod, descricao: l.descricao?.trim() || "Sem código", classe: classeDe(l.cls), obs: l.obs?.trim() || null });
    }
    for (const p of pessoas.values()) p.blocos.sort((x, y) => x.a - y.a);
    turnos.push({
      chave,
      data: l0.data,
      letra: (l0.turno ?? "?").toUpperCase(),
      periodo,
      supervisor: ls.find((l) => l.supervisor)?.supervisor ?? null,
      placa: limpaPlaca(l0.placa!),
      vaga: ls.find((l) => l.vaga)?.vaga ?? null,
      equip: ls.find((l) => l.equip)?.equip ?? null,
      area: ls.find((l) => l.area)?.area ?? null,
      kit: ls.find((l) => l.kit)?.kit ?? null,
      inicio: hora(l0.data, menor),
      duracao: maior - menor,
      pessoas: [...pessoas.values()].filter((p) => p.blocos.length).sort((x, y) => ordemPapel(x.papel) - ordemPapel(y.papel) || x.nome.localeCompare(y.nome)),
    });
  }
  return turnos.sort((x, y) => y.inicio.localeCompare(x.inicio) || (x.vaga ?? "").localeCompare(y.vaga ?? ""));
}

/** "AAAA-MM-DDTHH:MM:SS" de `dia` + segundos (pode passar para o dia seguinte). */
function hora(dia: string, seg: number): string {
  const d = Math.floor(seg / DIA);
  const s = seg - d * DIA;
  return `${somarDias(dia, d)}T${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

/** Régua do turno: carimbo do banco → segundos desde o início do turno, preso entre 0 e a duração. */
export function reguaDoTurno(t: Pick<TurnoCrono, "inicio" | "duracao">): (ts: string) => number {
  const dia = t.inicio.slice(0, 10);
  const zero = segDesde(dia, t.inicio);
  return (ts) => Math.min(t.duracao, Math.max(0, segDesde(dia, ts) - zero));
}

/** Hora do relógio de um segundo da régua ("19:40"). */
export function relogio(t: Pick<TurnoCrono, "inicio">, seg: number): string {
  const s = segDesde(t.inicio.slice(0, 10), t.inicio) + seg;
  const r = ((s % DIA) + DIA) % DIA;
  return `${pad(Math.floor(r / 3600))}:${pad(Math.floor((r % 3600) / 60))}`;
}

/** Fim da régua em carimbo (para a consulta ao banco). */
export const fimDoTurno = (t: Pick<TurnoCrono, "inicio" | "duracao">) => hora(t.inicio.slice(0, 10), segDesde(t.inicio.slice(0, 10), t.inicio) + t.duracao);

/** Tipo do equipamento pela vaga da folha ("AP-01" → ap). */
export function tipoDaVaga(vaga: string | null, equip: string | null = null): TipoEquip | undefined {
  const v = (vaga ?? "").toUpperCase();
  if (v.startsWith("AP")) return "ap";
  if (v.startsWith("AV")) return "av";
  if (v.startsWith("HV")) return "hv";
  if (v.startsWith("AS")) return "as";
  const e = (equip ?? "").toLowerCase();
  if (e.includes("alta press")) return "ap";
  if (e.includes("hiper")) return "hv";
  if (e.includes("vácuo") || e.includes("vacuo")) return "av";
  return undefined;
}

const NOME_GAUSS: Partial<Record<TipoEquip, string>> = { ap: "ALTA PRESS", av: "AUTO V", hv: "HIPER V", as: "ASPIRADOR" };

/**
 * A timeline de motor do GAUSS é gravada por vaga ("ALTA PRESSÃO - GPS - 01 - 24 HS"), e o caminhão pode trocar de
 * vaga: a folha registra a vaga do dia. "AP-01" → padrão ilike "ALTA PRESS% - GPS - 01%". null = vaga sem número.
 */
export function padraoVagaGauss(vaga: string | null, equip: string | null = null): string | null {
  const tipo = tipoDaVaga(vaga, equip);
  const num = (vaga ?? "").match(/(\d+)/)?.[1];
  const nome = tipo ? NOME_GAUSS[tipo] : undefined;
  if (!nome || !num) return null;
  return `${nome}% - GPS - ${pad(Number(num))}%`;
}

// ---------- conferência ----------

/** Família de um apontamento (tablet ou folha): o que cada um quer dizer, para comparar textos diferentes. */
const FAMILIAS: [string, RegExp][] = [
  ["Refeição", /refei|almo|lanche|jant/i],
  ["DDS, checklist e documentos", /dds|check|ppt|art\b|document|fechamento|libera[çc][ãa]o de servi/i],
  // "Aguardando" antes de "Água" e água só como palavra: "AGUArdando" contém "agua"
  ["Aguardando", /aguard/i],
  ["Água", /(^|[^a-z])[áa]gua([^a-z]|$)|abastec/i],
  ["Trajeto", /trajeto|desloc|manobra|posicionamento do caminh/i],
  ["Troca de turno e ponto", /turno|ponto/i],
  ["Resíduos", /descarte|res[íi]duo|basculamento|esvazia/i],
  ["Manutenção", /manuten|mec[âa]nic|oficina|pneu|quebra/i],
];
export function familiaDe(texto: string): string | null {
  for (const [nome, re] of FAMILIAS) if (re.test(texto)) return nome;
  return null;
}

export interface Frase {
  tom: Tom;
  texto: string;
  a: number;
  b: number;
}

export interface Conferencia {
  /** status do GAUSS que conta como produtivo para este equipamento (null = tipo sem regra) */
  produtivo: string | null;
  motor: BlocoGauss[];
  tablet: ApontamentoTablet[];
  /** minutos com a folha preenchida (qualquer pessoa) */
  minFolha: number;
  minEquipeProduzindo: number;
  minMotorProdutivo: number;
  minTablet: number;
  /** % dos minutos com folha em que folha e motor dizem o mesmo (produzindo × motor produtivo); null sem regra/dados */
  concordancia: number | null;
  /** % do tempo dos apontamentos do tablet (que dá para comparar) em que a folha diz a mesma coisa */
  tabletConfere: number | null;
  frases: Frase[];
}

const MIN_TRECHO = 10 * 60;

type Faixa = { a: number; b: number };

/** Junta pedaços que se encostam ou se cruzam. */
export function unir(faixas: Faixa[]): Faixa[] {
  const ord = [...faixas].filter((x) => x.b > x.a).sort((x, y) => x.a - y.a);
  const r: Faixa[] = [];
  for (const x of ord) {
    const u = r[r.length - 1];
    if (u && x.a <= u.b) u.b = Math.max(u.b, x.b);
    else r.push({ a: x.a, b: x.b });
  }
  return r;
}

const sobreposto = (faixas: Faixa[], a: number, b: number) => faixas.reduce((s, x) => s + Math.max(0, Math.min(b, x.b) - Math.max(a, x.a)), 0);
const total = (faixas: Faixa[]) => faixas.reduce((s, x) => s + (x.b - x.a), 0);

/** Status do GAUSS que mais pesa entre a e b. */
function statusDominante(motor: BlocoGauss[], a: number, b: number): BlocoGauss | null {
  const min = new Map<string, { bloco: BlocoGauss; s: number }>();
  for (const x of motor) {
    const s = Math.max(0, Math.min(b, x.b) - Math.max(a, x.a));
    if (!s) continue;
    const r = min.get(x.cod) ?? { bloco: x, s: 0 };
    r.s += s;
    min.set(x.cod, r);
  }
  return [...min.values()].sort((p, q) => q.s - p.s)[0]?.bloco ?? null;
}

const nomeCurto = (n: string) => n.split(/\s+/)[0];

/** Cruza a folha com o motor (GAUSS) e o tablet e escreve o que não bate. */
export function conferir(t: TurnoCrono, linhasMotor: LinhaMotorGauss[], linhasTablet: LinhaTablet[], agora: Date = new Date()): Conferencia {
  const regua = reguaDoTurno(t);
  const motor = montarStatusGauss(linhasMotor, t.data, regua);
  const fimAgora = Math.min(t.duracao, regua(`${agora.getFullYear()}-${pad(agora.getMonth() + 1)}-${pad(agora.getDate())}T${pad(agora.getHours())}:${pad(agora.getMinutes())}:00`));
  const tablet = montarTablet(linhasTablet, t.data, fimAgora || t.duracao, regua).filter((x) => x.b > x.a);
  const produtivo = statusProdutivo(tipoDaVaga(t.vaga, t.equip), t.placa);

  const folha = unir(t.pessoas.flatMap((p) => p.blocos));
  const produzindo = unir(t.pessoas.flatMap((p) => p.blocos.filter((x) => x.classe === "produzindo")));
  const motorProd = produtivo ? unir(motor.filter((x) => x.cod === produtivo)) : [];
  const temMotor = motor.some((x) => x.cod !== "no_data");

  // concordância minuto a minuto, só onde há folha
  let iguais = 0;
  let vistos = 0;
  if (produtivo && temMotor) {
    for (const f of folha) {
      for (let s = f.a; s < f.b; s += 60) {
        const meio = Math.min(s + 30, f.b - 1);
        const naFolha = produzindo.some((x) => x.a <= meio && meio < x.b);
        const noMotor = motorProd.some((x) => x.a <= meio && meio < x.b);
        vistos++;
        if (naFolha === noMotor) iguais++;
      }
    }
  }

  const frases: Frase[] = [];
  const rotuloProd = produtivo === "secondary_motor_on" ? "motor 2º (bomba)" : "parado ligado";

  if (produtivo && temMotor) {
    // 1) produzindo na folha, motor não
    for (const p of produzindo) {
      if (p.b - p.a < MIN_TRECHO) continue;
      const parte = sobreposto(motorProd, p.a, p.b) / (p.b - p.a);
      if (parte >= 0.25) continue;
      const quem = t.pessoas
        .filter((x) => x.blocos.some((b) => b.classe === "produzindo" && b.a < p.b && b.b > p.a))
        .map((x) => {
          const b = x.blocos.find((y) => y.classe === "produzindo" && y.a < p.b && y.b > p.a)!;
          return `${nomeCurto(x.nome)} (${x.papel}: ${b.descricao})`;
        });
      const dom = statusDominante(motor, p.a, p.b);
      frases.push({
        tom: "bad",
        a: p.a,
        b: p.b,
        texto: `A folha diz produzindo — ${quem.join(", ")} — mas o ${rotuloProd} ficou ligado só ${Math.round(parte * 100)}% do tempo; o GAUSS mostra mais "${dom?.rotulo ?? "sem dados"}".`,
      });
    }
    // 2) motor produtivo, ninguém produzindo na folha
    for (const m of motorProd) {
      if (m.b - m.a < MIN_TRECHO) continue;
      if (sobreposto(folha, m.a, m.b) / (m.b - m.a) < 0.5) continue; // sem folha nesse horário: nada a comparar
      if (sobreposto(produzindo, m.a, m.b) / (m.b - m.a) >= 0.25) continue;
      const marcaram = [...new Set(t.pessoas.flatMap((x) => x.blocos.filter((b) => b.a < m.b && b.b > m.a).map((b) => b.descricao)))].slice(0, 3);
      frases.push({
        tom: "warn",
        a: m.a,
        b: m.b,
        texto: `O GAUSS mostra ${rotuloProd} ligado por ${Math.round((m.b - m.a) / 60)} min, mas ninguém marcou produzindo na folha (marcaram: ${marcaram.join(", ") || "nada"}).`,
      });
    }
  }

  // 3) tablet × folha (só apontamentos de família conhecida e com folha preenchida no horário)
  let tabletComparado = 0;
  let tabletIgual = 0;
  for (const ap of tablet) {
    const dur = ap.b - ap.a;
    const fam = familiaDe(ap.categoria);
    if (dur < 5 * 60 || !fam) continue;
    const naFolha = t.pessoas.flatMap((x) => x.blocos.filter((b) => b.a < ap.b && b.b > ap.a).map((b) => ({ x, b, s: Math.min(ap.b, b.b) - Math.max(ap.a, b.a) })));
    if (!naFolha.length) continue;
    tabletComparado += dur;
    const mesma = unir(naFolha.filter(({ b }) => familiaDe(b.descricao) === fam).map(({ b }) => b));
    if (sobreposto(mesma, ap.a, ap.b) / dur >= 0.3) {
      tabletIgual += dur;
      continue;
    }
    const maior = naFolha.reduce((m, y) => (y.s > m.s ? y : m));
    frases.push({
      tom: "reg",
      a: ap.a,
      b: ap.b,
      texto: `Tablet: "${ap.categoria}" (${Math.round((ap.b - ap.a) / 60)} min); na folha, ${nomeCurto(maior.x.nome)} (${maior.x.papel}) marcou "${maior.b.descricao}".`,
    });
  }

  return {
    produtivo,
    motor,
    tablet,
    minFolha: Math.round(total(folha) / 60),
    minEquipeProduzindo: Math.round(total(produzindo) / 60),
    minMotorProdutivo: Math.round(total(motorProd) / 60),
    minTablet: Math.round(total(unir(tablet)) / 60),
    concordancia: vistos ? Math.round((iguais / vistos) * 100) : null,
    tabletConfere: tabletComparado ? Math.round((tabletIgual / tabletComparado) * 100) : null,
    frases: frases.sort((x, y) => x.a - y.a),
  };
}

// ---------- colaboradores ----------

export interface ResumoPessoa {
  nome: string;
  papel: string;
  min: Record<Classe, number>;
  total: number;
  principais: { descricao: string; classe: Classe; min: number }[];
}

export function resumoPessoas(t: TurnoCrono): ResumoPessoa[] {
  return t.pessoas.map((p) => {
    const min: Record<Classe, number> = { produzindo: 0, necessario: 0, improdutivo: 0, sem: 0 };
    const ativ = new Map<string, { descricao: string; classe: Classe; min: number }>();
    for (const b of p.blocos) {
      const m = (b.b - b.a) / 60;
      min[b.classe] += m;
      const r = ativ.get(b.descricao) ?? { descricao: b.descricao, classe: b.classe, min: 0 };
      r.min += m;
      ativ.set(b.descricao, r);
    }
    return {
      nome: p.nome,
      papel: p.papel,
      min,
      total: Object.values(min).reduce((s, x) => s + x, 0),
      principais: [...ativ.values()].sort((x, y) => y.min - x.min).slice(0, 3),
    };
  });
}

export interface AtividadeRanking {
  descricao: string;
  classe: Classe;
  min: number;
  pessoas: number;
  turnos: number;
}

/** Atividades que mais tomam tempo em todos os turnos lançados. */
export function rankingAtividades(turnos: TurnoCrono[]): AtividadeRanking[] {
  const r = new Map<string, AtividadeRanking & { _p: Set<string>; _t: Set<string> }>();
  for (const t of turnos)
    for (const p of t.pessoas)
      for (const b of p.blocos) {
        const x = r.get(b.descricao) ?? { descricao: b.descricao, classe: b.classe, min: 0, pessoas: 0, turnos: 0, _p: new Set<string>(), _t: new Set<string>() };
        x.min += (b.b - b.a) / 60;
        x._p.add(p.nome);
        x._t.add(t.chave);
        r.set(b.descricao, x);
      }
  return [...r.values()]
    .map(({ _p, _t, ...x }) => ({ ...x, min: Math.round(x.min), pessoas: _p.size, turnos: _t.size }))
    .sort((x, y) => y.min - x.min);
}
