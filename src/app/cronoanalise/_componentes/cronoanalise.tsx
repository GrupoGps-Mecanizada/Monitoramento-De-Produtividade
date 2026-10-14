"use client";

import { useMemo, useRef, useState } from "react";
import { useZoomRoda } from "@/components/historico/zoom-roda";
import { Aviso, SecaoTitulo, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { useFolhas, useTelemetriaDoTurno } from "@/lib/dados/cronoanalise";
import { CLASSES, conferir, montarTurnos, padraoVagaGauss, rankingAtividades, relogio, resumoPessoas, type Classe, type Conferencia, type TurnoCrono } from "@/lib/dominio/cronoanalise";
import { diaBR, fmtHoras } from "@/lib/dominio/formato";
import { FILTRO_CRONO_VAZIO, completarTurno, filtrarTurnos, opcoesDoFiltro, type FiltroCrono } from "@/lib/dominio/filtros-crono";
import { STATUS_GAUSS } from "@/lib/dominio/gauss-dia";
import { deslocarJanela, type Janela } from "@/lib/dominio/trilhas";
import type { Tom } from "@/lib/tipos";

const ORDEM_CLASSES: Classe[] = ["produzindo", "necessario", "improdutivo", "sem"];
const LEGENDA_MOTOR = ["secondary_motor_on", "on", "stopped", "off", "categorized_stop", "maintenance", "no_data"].map((c) => STATUS_GAUSS[c]);

const rotuloTurno = (t: TurnoCrono) =>
  `${diaBR(t.data)} · ${t.periodo === "noite" ? "Noite" : "Dia"} · Letra ${t.letra}${t.supervisor ? ` (${t.supervisor})` : ""} · ${t.vaga ?? t.placa} ${t.placa}`;

/**
 * Cronoanálise × telemetria: o que a folha da cronoanálise diz ao lado do motor do GAUSS e do tablet, minuto a minuto,
 * com frases onde não bate e as horas de cada colaborador. Só lê o Supabase.
 */
export function Cronoanalise() {
  const { linhas, erro } = useFolhas();
  // letra e supervisor que a folha não trouxe vêm da escala (segundo cérebro: "Regimes, turnos e supervisores")
  const turnos = useMemo(() => montarTurnos(linhas ?? []).map(completarTurno), [linhas]);
  const [filtro, setFiltro] = useState<FiltroCrono>(FILTRO_CRONO_VAZIO);
  const filtrados = useMemo(() => filtrarTurnos(turnos, filtro), [turnos, filtro]);
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const turno = filtrados.find((t) => t.chave === escolhido) ?? filtrados[0] ?? null;

  const tele = useTelemetriaDoTurno(turno);
  const conf = useMemo(() => (turno ? conferir(turno, tele.motor, tele.tablet) : null), [turno, tele.motor, tele.tablet]);
  const ranking = useMemo(() => rankingAtividades(turnos).slice(0, 12), [turnos]);

  if (erro) return <Moldura><Aviso tipo="erro">Não foi possível ler a cronoanálise: {erro}</Aviso></Moldura>;
  if (!linhas) return <Moldura><Vazio titulo="Carregando as folhas da cronoanálise…" /></Moldura>;
  if (!turnos.length) return <Moldura><Vazio titulo="Nenhuma folha lançada" /></Moldura>;

  const mudar = (p: Partial<FiltroCrono>) => setFiltro((f) => ({ ...f, ...p }));
  const filtroSelect = (campo: keyof FiltroCrono, rotulo: string, todas: string, nome: (v: string) => string = (v) => v) => (
    <Selecao aria-label={rotulo} value={filtro[campo] ?? ""} onChange={(e) => mudar({ [campo]: e.target.value || null })} className="w-auto min-w-[120px]">
      <option value="">{todas}</option>
      {opcoesDoFiltro(turnos, filtro, campo).map((v) => (
        <option key={v} value={v}>
          {nome(v)}
        </option>
      ))}
    </Selecao>
  );

  return (
    <Moldura>
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie p-3 shadow-sm">
        {filtroSelect("data", "Data", "Todas as datas", diaBR)}
        {filtroSelect("letra", "Letra", "Todas as letras", (v) => `Letra ${v}`)}
        {filtroSelect("periodo", "Turno", "Dia e noite", (v) => (v === "noite" ? "Noite" : "Dia"))}
        {filtroSelect("vaga", "Vaga", "Todas as vagas")}
        {filtroSelect("tipo", "Tipo", "Todos os tipos")}
        {filtroSelect("supervisor", "Supervisor", "Todos os supervisores")}
        {filtrados.length > 1 && turno && (
          <Selecao value={turno.chave} onChange={(e) => setEscolhido(e.target.value)} aria-label="Turno da cronoanálise" className="min-w-0 flex-1 md:max-w-md">
            {filtrados.map((t) => (
              <option key={t.chave} value={t.chave}>
                {rotuloTurno(t)}
              </option>
            ))}
          </Selecao>
        )}
        {turno && (
          <span className="text-xs text-suave md:ml-auto">
            {relogio(turno, 0)}–{relogio(turno, turno.duracao)}
            {turno.area ? ` · ${turno.area}` : ""}
            {turno.kit ? ` · kit ${turno.kit}` : ""}
          </span>
        )}
      </div>
      {!turno ? <Vazio titulo="Nada neste filtro." /> : <Turno turno={turno} conf={conf} tele={tele} />}
      <Ranking itens={ranking} turnos={turnos.length} />
    </Moldura>
  );
}

/** O turno escolhido: avisos, raio-x, conferência e colaboradores. */
function Turno({ turno, conf, tele }: { turno: TurnoCrono; conf: Conferencia | null; tele: ReturnType<typeof useTelemetriaDoTurno> }) {
  return (
    <>
      {tele.erro && <Aviso tipo="erro">Não foi possível ler o motor e o tablet: {tele.erro}</Aviso>}
      {!padraoVagaGauss(turno.vaga, turno.equip) && <Aviso tipo="alerta">A folha não tem a vaga com número (ex.: AP-01): sem ela, o motor do GAUSS não aparece.</Aviso>}

      <RaioX key={turno.chave} turno={turno} conf={conf} carregando={tele.carregando} />
      {conf && <Conferir turno={turno} conf={conf} carregando={tele.carregando} />}
      <Colaboradores turno={turno} />
    </>
  );
}

function Moldura({ children }: { children: React.ReactNode }) {
  return <div className="w-full space-y-3 px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">{children}</div>;
}

function Cartao({ titulo, acao, children }: { titulo: string; acao?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
      <SecaoTitulo acao={acao}>{titulo}</SecaoTitulo>
      <div className="px-4 pb-4">{children}</div>
    </section>
  );
}

// ---------- raio-x ----------

type Pedaco = { a: number; b: number; tom: Tom; texto: string; titulo: string };

function RaioX({ turno, conf, carregando }: { turno: TurnoCrono; conf: Conferencia | null; carregando: boolean }) {
  // zoom: janela visível dentro do turno (rodinha do mouse; arrastar ou Shift + rodinha anda no tempo)
  const inteiro: Janela = [0, turno.duracao];
  const [janela, setJanela] = useState<Janela>(inteiro);
  const areaRef = useRef<HTMLDivElement>(null);
  const reguaRef = useRef<HTMLDivElement>(null);
  useZoomRoda(areaRef, janela, setJanela, turno.duracao, reguaRef);
  const [ja, jb] = janela;
  const visivel = jb - ja;
  const zoom = turno.duracao / visivel;
  const pct = (s: number) => `${((s - ja) / visivel) * 100}%`;
  const larg = (s: number) => `${(s / visivel) * 100}%`;
  const marcas = useMemo(() => {
    // marcas em horas cheias; aproximando, a cada 30, 15 ou 5 min
    const passo = visivel <= 1800 ? 300 : visivel <= 2 * 3600 ? 900 : visivel <= 5 * 3600 ? 1800 : 3600;
    const zero = Number(relogio(turno, 0).slice(0, 2)) * 3600 + Number(relogio(turno, 0).slice(3, 5)) * 60;
    const r: number[] = [];
    for (let s = Math.ceil((ja + zero) / passo) * passo - zero; s <= jb; s += passo) r.push(s);
    return r;
  }, [turno, ja, jb, visivel]);
  // arrastar com o mouse anda no tempo (no celular o dedo continua rolando a página)
  const arrasto = useRef<{ x: number; janela: Janela } | null>(null);
  const aoApertar = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || zoom <= 1) return;
    arrasto.current = { x: e.clientX, janela };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const aoMover = (e: React.PointerEvent) => {
    const d = arrasto.current;
    const largura = reguaRef.current?.getBoundingClientRect().width;
    if (!d || !largura) return;
    setJanela(deslocarJanela(d.janela, (-(e.clientX - d.x) / largura) * (d.janela[1] - d.janela[0]), turno.duracao));
  };
  const aoSoltar = () => {
    arrasto.current = null;
  };
  const intervalo = (p: { a: number; b: number }) => `${relogio(turno, p.a)}–${relogio(turno, p.b)}`;

  const faixas: { rotulo: string; sub?: string; pedacos: Pedaco[]; vazio?: string }[] = [
    {
      rotulo: "Motor (GAUSS)",
      pedacos: (conf?.motor ?? []).map((x) => ({ a: x.a, b: x.b, tom: x.tom, texto: x.rotulo, titulo: `${x.rotulo} · ${intervalo(x)}` })),
      vazio: carregando ? "carregando…" : "sem dados do GAUSS neste turno",
    },
    {
      rotulo: "Tablet",
      pedacos: (conf?.tablet ?? []).map((x) => ({ a: x.a, b: x.b, tom: "reg", texto: x.categoria, titulo: `${x.categoria} · ${intervalo(x)}` })),
      vazio: carregando ? "carregando…" : "nenhum apontamento",
    },
    ...turno.pessoas.map((p) => ({
      rotulo: p.nome,
      sub: p.papel,
      pedacos: p.blocos.map((b) => ({
        a: b.a,
        b: b.b,
        tom: CLASSES[b.classe].tom,
        texto: b.descricao,
        titulo: `${b.cod != null ? `${b.cod} · ` : ""}${b.descricao} (${CLASSES[b.classe].rotulo}) · ${intervalo(b)}${b.obs ? ` · ${b.obs}` : ""}`,
      })),
    })),
  ];

  return (
    <Cartao titulo="Raio-x do turno">
      <ul aria-label="Cores" className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
        {ORDEM_CLASSES.map((c) => (
          <li key={c} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: corDoTom(CLASSES[c].tom) }} />
            {CLASSES[c].rotulo}
          </li>
        ))}
        <li className="text-borda">|</li>
        {LEGENDA_MOTOR.map((e) => (
          <li key={e.rotulo} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: corDoTom(e.tom) }} />
            {e.rotulo}
          </li>
        ))}
      </ul>
      {zoom > 1 && (
        <p aria-label="Janela visível" className="mb-2 text-xs tabular-nums text-suave">
          {relogio(turno, ja)}–{relogio(turno, jb)}
        </p>
      )}
      <div className={cx("overflow-x-auto", zoom > 1 && "cursor-grab active:cursor-grabbing")} ref={areaRef} aria-label="Faixas do raio-x" onPointerDown={aoApertar} onPointerMove={aoMover} onPointerUp={aoSoltar} onPointerCancel={aoSoltar}>
        <div className="min-w-[720px]">
          <div className="grid grid-cols-[170px_1fr] gap-3">
            <span />
            <div ref={reguaRef} className="relative h-4 overflow-hidden text-[10px] tabular-nums text-suave">
              {marcas.map((s) => (
                <span key={s} className="absolute -translate-x-1/2" style={{ left: pct(s) }}>
                  {relogio(turno, s)}
                </span>
              ))}
            </div>
          </div>
          {faixas.map((f, i) => (
            <div key={`${f.rotulo}-${i}`} className={`grid grid-cols-[170px_1fr] items-center gap-3 py-1.5 ${i === 2 ? "mt-1 border-t border-borda pt-2.5" : ""}`}>
              <div className="min-w-0">
                <p className="truncate text-[13px] font-semibold" title={f.rotulo}>
                  {f.rotulo}
                </p>
                {f.sub && <p className="truncate text-[11px] text-suave">{f.sub}</p>}
              </div>
              <div className="relative h-7 overflow-hidden rounded-md bg-superficie-2 ring-1 ring-borda">
                {marcas.map((s) => (
                  <i key={s} aria-hidden className="absolute inset-y-0 w-px bg-borda" style={{ left: pct(s) }} />
                ))}
                {f.pedacos.map((p, j) => {
                  // só a parte visível: o nome fica no começo do que aparece, mesmo que a caixa comece antes
                  const a = Math.max(p.a, ja);
                  const b = Math.min(p.b, jb);
                  if (b <= a) return null;
                  return (
                    <span
                      key={j}
                      title={p.titulo}
                      className="absolute inset-y-0.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-sm px-1 text-[10px] font-semibold leading-6 text-white/95"
                      style={{ left: pct(a), width: `calc(${larg(b - a)} - 1px)`, background: corDoTom(p.tom) }}
                    >
                      {(b - a) / visivel >= 0.06 ? p.texto : ""}
                    </span>
                  );
                })}
                {!f.pedacos.length && f.vazio && <span className="absolute inset-0 grid place-items-center text-[11px] text-suave">{f.vazio}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Cartao>
  );
}

// ---------- conferência ----------

function Numero({ titulo, valor, sub }: { titulo: string; valor: string; sub: string }) {
  return (
    <div className="rounded-lg border border-borda bg-superficie-2 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">{titulo}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums">{valor}</p>
      <p className="text-[11px] text-suave">{sub}</p>
    </div>
  );
}

function Conferir({ turno, conf, carregando }: { turno: TurnoCrono; conf: Conferencia; carregando: boolean }) {
  const regra = conf.produtivo ? (STATUS_GAUSS[conf.produtivo]?.rotulo ?? conf.produtivo).toLowerCase() : null;
  return (
    <Cartao titulo="Conferência: folha × motor × tablet">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <Numero titulo="Folha e motor batem" valor={conf.concordancia == null ? "—" : `${conf.concordancia}%`} sub={regra ? `× ${regra}` : "sem regra"} />
        <Numero titulo="Produzindo na folha" valor={fmtHoras(conf.minEquipeProduzindo)} sub={`de ${fmtHoras(conf.minFolha)}`} />
        <Numero titulo="Motor produtivo" valor={regra ? fmtHoras(conf.minMotorProdutivo) : "—"} sub={regra ?? "sem regra"} />
        <Numero titulo="Tablet confere" valor={conf.tabletConfere == null ? "—" : `${conf.tabletConfere}%`} sub={`${fmtHoras(conf.minTablet)} no tablet`} />
      </div>
      <p className="mb-2 mt-4 text-[13px] font-semibold">O que não bate</p>
      {carregando ? (
        <p className="text-sm text-suave">Carregando…</p>
      ) : !conf.frases.length ? (
        <p className="text-sm text-suave">Tudo bate.</p>
      ) : (
        <ul className="space-y-1.5">
          {conf.frases.map((f, i) => (
            <li key={i} className="flex flex-wrap items-start gap-2 text-[13px]">
              <Selo tom={f.tom} className="tabular-nums">
                {relogio(turno, f.a)}–{relogio(turno, f.b)}
              </Selo>
              <span className="min-w-0 flex-1">{f.texto}</span>
            </li>
          ))}
        </ul>
      )}
    </Cartao>
  );
}

// ---------- colaboradores ----------

function Colaboradores({ turno }: { turno: TurnoCrono }) {
  const pessoas = useMemo(() => resumoPessoas(turno), [turno]);
  return (
    <Cartao titulo="Apontamentos dos colaboradores">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead>
            <tr className="border-b border-borda text-left text-[11px] uppercase tracking-wider text-suave">
              <th className="py-1.5 pr-3 font-semibold">Colaborador</th>
              <th className="py-1.5 pr-3 font-semibold">Divisão do tempo</th>
              {ORDEM_CLASSES.map((c) => (
                <th key={c} className="py-1.5 pr-3 text-right font-semibold">
                  {CLASSES[c].rotulo}
                </th>
              ))}
              <th className="py-1.5 font-semibold">Principais atividades</th>
            </tr>
          </thead>
          <tbody>
            {pessoas.map((p) => (
              <tr key={`${p.papel}-${p.nome}`} className="border-b border-borda/60 align-top">
                <td className="py-2 pr-3">
                  <p className="font-semibold">{p.nome}</p>
                  <p className="text-[11px] text-suave">{p.papel}</p>
                </td>
                <td className="w-40 py-2 pr-3">
                  <div className="flex h-3 overflow-hidden rounded-sm bg-superficie-2" aria-hidden>
                    {ORDEM_CLASSES.map((c) => (p.min[c] ? <i key={c} style={{ width: `${(p.min[c] / p.total) * 100}%`, background: corDoTom(CLASSES[c].tom) }} /> : null))}
                  </div>
                  <p className="mt-1 text-[11px] text-suave">{p.total ? `${Math.round((p.min.produzindo / p.total) * 100)}% produzindo` : "—"}</p>
                </td>
                {ORDEM_CLASSES.map((c) => (
                  <td key={c} className="py-2 pr-3 text-right tabular-nums">
                    {p.min[c] ? fmtHoras(p.min[c]) : "—"}
                  </td>
                ))}
                <td className="py-2">
                  {p.principais.map((a) => (
                    <p key={a.descricao} className="text-[12px]">
                      <span className="tabular-nums text-suave">{fmtHoras(a.min)}</span> {a.descricao}
                    </p>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Cartao>
  );
}

function Ranking({ itens, turnos }: { itens: ReturnType<typeof rankingAtividades>; turnos: number }) {
  const maior = itens[0]?.min ?? 1;
  return (
    <Cartao titulo={`Atividades que mais tomam tempo · ${turnos} turno${turnos === 1 ? "" : "s"} lançado${turnos === 1 ? "" : "s"}`}>
      <ul className="space-y-1.5">
        {itens.map((a) => (
          <li key={a.descricao} className="grid grid-cols-[minmax(0,220px)_1fr_auto] items-center gap-3 text-[13px] md:grid-cols-[minmax(0,320px)_1fr_auto]">
            <span className="truncate" title={a.descricao}>
              {a.descricao}
            </span>
            <span className="h-3 overflow-hidden rounded-sm bg-superficie-2">
              <i className="block h-full" style={{ width: `${(a.min / maior) * 100}%`, background: corDoTom(CLASSES[a.classe].tom) }} title={CLASSES[a.classe].rotulo} />
            </span>
            <span className="whitespace-nowrap tabular-nums text-suave">
              {fmtHoras(a.min)} · {a.pessoas} pessoa{a.pessoas === 1 ? "" : "s"}
            </span>
          </li>
        ))}
      </ul>
    </Cartao>
  );
}
