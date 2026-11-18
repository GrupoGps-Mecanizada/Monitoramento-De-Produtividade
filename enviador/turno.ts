// Relatório de fim de turno no WhatsApp (P-088, pedido do dono em 20/10/2026): no fim de cada turno do 4x4, um
// cartão por vaga de 24 h (AP/AV 01 e 08) com o caminhão, as áreas atendidas, os apontamentos e as barras.
// Tudo puro (o enviar.ts só lê, manda e guarda que já mandou).
//   Produtivo: a regra do tipo (Alta Pressão: bomba ligada; Auto Vácuo: parado ligado), fora da base, mas a Baia de Resíduos conta (igual ao site).
//   Ocioso: motor desligado (para o dono, 20/10/2026, ocioso é motor desligado; andando ligado é só deslocamento).
//   Justificado: tempo coberto pelos apontamentos do tablet.
import { letraDaEscala, SUPERVISOR_DA_LETRA } from "../src/lib/dominio/filtros-crono";
import { ehBase, statusProdutivo } from "../src/lib/dominio/produtividade";
import { tipoDaVaga } from "../src/lib/dominio/dia-vaga";
import { lerVaga } from "../src/lib/dominio/supervisor-vaga";
import { vagaOficial } from "../src/lib/dominio/vagas-oficiais";
import { nomeLocal, vagaCurta } from "./mensagem";

/** O GAUSS chega aos poucos (o coletor busca a cada ~10 min): o relatório espera isso depois do fim do turno. */
export const ESPERA_MIN = 20;
/** PC ligado muito depois do fim: relatório velho não sai. */
export const VALIDADE_MIN = 3 * 60;
/** Menos que isso numa área é passagem, não atendimento. */
export const AREA_MIN = 10;
export const MAX_AREAS = 4;
/** Parada de apoio, não é área atendida: restaurante, abastecimento de água e estacionamento. */
const NAO_ATENDE = /RESTAURANTE|ABAST|ESTACIONAMENTO/i;
const TURNO_MIN = 12 * 60;

export interface Turno {
  /** "2026-10-20|dia": o que garante mandar uma vez só */
  chave: string;
  /** dia em que o turno começou (a noite pertence ao dia em que começou) */
  dia: string;
  periodo: "dia" | "noite";
  letra: string;
  supervisor: string | null;
  /** horário local "AAAA-MM-DD HH:MM:SS" */
  ini: string;
  fim: string;
}

/** Linha de timeline_motor_vaga (horário local, sem fuso). */
export interface LinhaTurno {
  vaga_nome: string;
  placa: string | null;
  placa_ou_codigo: string | null;
  inicio: string;
  fim: string;
  status: string;
}
/** O que importa de loc_eventos.dados (t com fuso). */
export interface EventoTurno {
  t: string;
  placa: string;
  tipo: string;
  area?: string;
}
/** Linha de demoras_categorizadas (apontamento do tablet). */
export interface ApontTurno {
  placa: string;
  inicio: string;
  fim: string | null;
  categoria_demora: string;
  motorista?: string | null;
}
export interface ResumoVaga {
  /** "AP 01" */
  vaga: string;
  placas: string[];
  /** quem o tablet identificou (o que mais apontou no turno); null = não identificado */
  motorista: string | null;
  produtivo_min: number;
  /** motor desligado no turno */
  ocioso_min: number;
  /** tempo coberto pelos apontamentos do tablet no turno */
  justificado_min: number;
  areas: string[];
  /** quantos apontamentos o tablet fez no turno (o dono quer só o número, 20/10/2026) */
  apontamentos: number;
}

const DESLIGADO = new Set(["off", "main_switch_off"]);

/** Horário sem fuso é o da usina (Brasília, sem horário de verão desde 2019). */
const ms = (ts: string) => (/[zZ]|[+-]\d\d:?\d\d$/.test(ts) ? Date.parse(ts) : Date.parse(`${ts.slice(0, 19).replace(" ", "T")}-03:00`));
const local = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day} ${p.hour === "24" ? "00" : p.hour}:${p.minute}:${p.second}`;
};
const somarDia = (dia: string, n: number) => {
  const d = new Date(`${dia}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const placaLimpa = (p: string | null | undefined) => (p ?? "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();

function turno(dia: string, periodo: "dia" | "noite"): Turno {
  const letra = letraDaEscala(dia, periodo);
  const [ini, fim] = periodo === "dia" ? [`${dia} 06:40:00`, `${dia} 18:40:00`] : [`${dia} 18:40:00`, `${somarDia(dia, 1)} 06:40:00`];
  return { chave: `${dia}|${periodo}`, dia, periodo, letra, supervisor: SUPERVISOR_DA_LETRA[letra] ?? null, ini, fim };
}

/** O último turno do 4x4 que já acabou (para o teste na mão). */
export function ultimoTurno(agora: Date): Turno {
  const hoje = local(agora).slice(0, 10);
  const candidatos = [turno(hoje, "dia"), turno(somarDia(hoje, -1), "noite"), turno(somarDia(hoje, -1), "dia")];
  return candidatos.find((t) => ms(t.fim) <= agora.getTime())!;
}

/** O turno do 4x4 que acabou há pelo menos ESPERA_MIN e no máximo VALIDADE_MIN; senão null. */
export function turnoEncerrado(agora: Date): Turno | null {
  const t = ultimoTurno(agora);
  const passou = (agora.getTime() - ms(t.fim)) / 60000;
  return passou >= ESPERA_MIN && passou < VALIDADE_MIN ? t : null;
}

/** As vagas de 24 h do 4x4: Alta Pressão e Auto Vácuo 01 e 08. */
export const VAGAS_24H = ["AP 01", "AP 08", "AV 01", "AV 08"];
const vaga24h = (nome: string) => {
  const v = lerVaga(nome);
  return vagaOficial(nome) && (v?.tipo === "ap" || v?.tipo === "av") && (v.num === 1 || v.num === 8);
};

/** Minutos de [a, b) dentro do turno. */
const dentro = (a: number, b: number, ini: number, fim: number) => Math.max(0, Math.min(b, fim) - Math.max(a, ini)) / 60000;

/** Onde o caminhão esteve no turno, pelas entradas e saídas de área: [área, início, fim] já cortados no turno. */
function estadias(eventos: EventoTurno[], placas: Set<string>, ini: number, fim: number): [string, number, number][] {
  const doCaminhao = eventos.filter((e) => placas.has(placaLimpa(e.placa)) && e.area !== undefined).sort((p, q) => ms(p.t) - ms(q.t));
  const out: [string, number, number][] = [];
  let area = "";
  let desde = ini;
  const mudar = (nova: string, t: number) => {
    if (area && dentro(desde, t, ini, fim)) out.push([area, Math.max(desde, ini), Math.min(t, fim)]);
    area = nova;
    desde = t;
  };
  for (const e of doCaminhao) {
    const t = ms(e.t);
    if (e.tipo === "saida") {
      if (e.area === area) mudar("", t);
    } else mudar(e.area ?? "", t);
  }
  mudar("", fim);
  return out;
}

/** Áreas atendidas: tempo em cada área no turno, fora da base e das paradas de apoio, do maior para o menor. */
function areasDe(eventos: EventoTurno[], placas: Set<string>, ini: number, fim: number): string[] {
  const tempo = new Map<string, number>();
  for (const [area, a, b] of estadias(eventos, placas, ini, fim))
    if (!ehBase(area) && !NAO_ATENDE.test(area)) tempo.set(area, (tempo.get(area) ?? 0) + (b - a) / 60000);
  return [...tempo]
    .filter(([, m]) => m >= AREA_MIN)
    .sort((p, q) => q[1] - p[1])
    .map(([a]) => nomeLocal(a));
}

/**
 * Apontamentos do tablet no turno: quantos foram, o tempo que cobrem (sobrepostos contam
 * uma vez; aberto conta até o fim do turno) e o motorista que mais apontou.
 */
function apontamentosDe(apont: ApontTurno[], placas: Set<string>, ini: number, fim: number) {
  let n = 0;
  const porMotorista = new Map<string, number>();
  const trechos: [number, number][] = [];
  for (const a of apont) {
    if (!placas.has(placaLimpa(a.placa))) continue;
    const a0 = ms(a.inicio);
    const a1 = a.fim ? ms(a.fim) : Math.max(a0, fim);
    if (a0 >= fim || a1 <= ini) continue;
    n++;
    trechos.push([Math.max(a0, ini), Math.min(a1, fim)]);
    // o tablet manda "--" quando o motorista não se identificou
    const m = a.motorista?.trim();
    if (m && /\p{L}{2}/u.test(m)) porMotorista.set(m, (porMotorista.get(m) ?? 0) + 1);
  }
  let min = 0;
  let ate = -Infinity;
  for (const [a, b] of trechos.sort((p, q) => p[0] - q[0])) {
    const de = Math.max(a, ate);
    if (b > de) min += (b - de) / 60000;
    ate = Math.max(ate, b);
  }
  const motorista = [...porMotorista].sort((p, q) => q[1] - p[1])[0]?.[0];
  return {
    n,
    min: Math.round(min),
    motorista: motorista ? nomeLocal(motorista) : null,
  };
}

/** Um resumo por vaga de 24 h, na ordem AP 01, AP 08, AV 01, AV 08. */
export function resumirVagas(linhas: LinhaTurno[], eventos: EventoTurno[], apont: ApontTurno[], t: Pick<Turno, "ini" | "fim">): ResumoVaga[] {
  const ini = ms(t.ini);
  const fim = ms(t.fim);
  const porVaga = new Map<string, LinhaTurno[]>();
  for (const l of linhas) if (vaga24h(l.vaga_nome)) porVaga.set(l.vaga_nome, [...(porVaga.get(l.vaga_nome) ?? []), l]);
  const resumos = [...porVaga]
    .map(([nome, ls]): ResumoVaga => {
      const tipo = tipoDaVaga(nome) ?? undefined;
      let produtivo = 0;
      let ocioso = 0;
      const minPorPlaca = new Map<string, number>();
      // na base (Pátio do Transporte, Garagem) a bomba ligada não conta como produtivo, igual ao site (regra de 08/10/2026)
      const naBase = new Map<string, [number, number][]>();
      const base = (placa: string) => {
        if (!naBase.has(placa)) naBase.set(placa, estadias(eventos, new Set([placa]), ini, fim).filter(([area]) => ehBase(area)).map(([, a, b]) => [a, b]));
        return naBase.get(placa)!;
      };
      // trecho repetido ou sobreposto: cada minuto conta uma vez só
      let ate = -Infinity;
      for (const l of [...ls].sort((p, q) => ms(p.inicio) - ms(q.inicio))) {
        const a = Math.max(ms(l.inicio), ate);
        const b = ms(l.fim);
        if (b <= a) continue;
        ate = b;
        const min = dentro(a, b, ini, fim);
        if (!min) continue;
        const placa = placaLimpa(l.placa ?? l.placa_ou_codigo);
        if (placa) minPorPlaca.set(placa, (minPorPlaca.get(placa) ?? 0) + min);
        if (l.status === statusProdutivo(tipo, placa)) produtivo += min - base(placa).reduce((s, [x, y]) => s + dentro(a, b, Math.max(x, ini), Math.min(y, fim)), 0);
        else if (DESLIGADO.has(l.status)) ocioso += min;
      }
      // caminhão que só passou pela vaga (menos de 30 min) não aparece, a não ser que seja o único
      const placas = [...minPorPlaca].sort((p, q) => q[1] - p[1]).filter(([, m], i) => i === 0 || m >= 30).map(([p]) => p);
      const set = new Set(placas);
      const ap = apontamentosDe(apont, set, ini, fim);
      return {
        vaga: vagaCurta(nome),
        placas,
        motorista: ap.motorista,
        produtivo_min: Math.round(produtivo),
        ocioso_min: Math.round(ocioso),
        justificado_min: ap.min,
        areas: areasDe(eventos, set, ini, fim),
        apontamentos: ap.n,
      };
    });
  // as 4 vagas sempre aparecem: a que o GAUSS não mandou fica "sem dados"
  return VAGAS_24H.map(
    (v) => resumos.find((r) => r.vaga === v) ?? { vaga: v, placas: [], motorista: null, produtivo_min: 0, ocioso_min: 0, justificado_min: 0, areas: [], apontamentos: 0 },
  );
}

/** Barra de BLOCOS quadrinhos (fração do turno). */
/** Quantos quadrinhos cada barra tem (o dono pediu 3 a menos que os 10 iniciais, 20/10/2026). */
export const BLOCOS = 7;
export const barra = (fracao: number) => {
  const n = Math.max(0, Math.min(BLOCOS, Math.round(fracao * BLOCOS)));
  return "▰".repeat(n) + "▱".repeat(BLOCOS - n);
};
const duracao = (min: number) => `${Math.floor(min / 60)}h${String(Math.round(min % 60)).padStart(2, "0")}`;
const linhaBarra = (rotulo: string, min: number) => `\`${rotulo.padEnd(11)} ${barra(min / TURNO_MIN)} ${`${Math.round((min / TURNO_MIN) * 100)}%`.padStart(4)} ${duracao(min)}\``;

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
/** "Terça, 20/10" */
const dataCurta = (dia: string) => `${DIAS[new Date(`${dia}T12:00:00Z`).getUTCDay()]}, ${dia.slice(8, 10)}/${dia.slice(5, 7)}`;

function cartao(v: ResumoVaga): string[] {
  const cab = `> *${v.vaga}*${v.placas.length ? ` · ${v.placas.join(" / ")}` : ""}`;
  if (!v.placas.length) return [cab, "_Sem dados do GAUSS no turno_"];
  return [
    cab,
    ...(v.motorista ? [`*Motorista:* ${v.motorista}`] : []),
    `*Local:* ${v.areas.length ? [...v.areas.slice(0, MAX_AREAS), ...(v.areas.length > MAX_AREAS ? [`+${v.areas.length - MAX_AREAS}`] : [])].join(" · ") : "Sem registro"}`,
    `*Apontamentos:* ${v.apontamentos || "Nenhum"}`,
    linhaBarra("Produtivo", v.produtivo_min),
    linhaBarra("Ocioso", v.ocioso_min),
    linhaBarra("Justificado", v.justificado_min),
  ];
}

/** Formato do dono (20/10/2026): sem emojis, rótulos em negrito e três barras. *negrito*, _itálico_, `fixo` e "> " são do WhatsApp. */
export function montarRelatorio(t: Turno, vagas: ResumoVaga[]): string {
  return [
    "*RELATÓRIO DE PRODUTIVIDADE DO TURNO*",
    `_${t.periodo === "dia" ? "Dia" : "Noite"} · Letra ${t.letra} · ${dataCurta(t.dia)} · ${t.ini.slice(11, 16)}–${t.fim.slice(11, 16)}_`,
    `Supervisor: *${t.supervisor ?? "—"}*`,
    "",
    vagas.map((v) => cartao(v).join("\n")).join("\n\n"),
    "",
    "",
    "_Relatório de turno · GrupoGPS_",
  ].join("\n");
}
