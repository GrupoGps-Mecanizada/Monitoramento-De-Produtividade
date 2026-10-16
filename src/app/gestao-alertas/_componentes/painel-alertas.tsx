"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Aviso, Vazio, cx } from "@/components/ui";
import { marcarVistoVarios, resolverVarios } from "@/lib/dados/alertas";
import {
  FILTROS_PADRAO,
  PERIODOS,
  ROTULO_DESTINO,
  SEM_SUPERVISOR,
  VISOES,
  contarCartoes,
  contarVisoes,
  etiquetas,
  filtrar,
  opcoes,
  ordenar,
  rotuloRegra,
  visaoAtual,
  type Cartao,
  type Coluna,
  type FiltrosAlertas,
  type Periodo,
  type Visao,
} from "@/lib/dominio/alertas/fila";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import { corDoTom } from "@/lib/cores";
import { AbasTexto, NotaSelo, Pilula, ROTULO_SITUACAO, TOM_SITUACAO, erroTexto } from "./comum";
import { DetalheAlerta } from "./detalhe";

const MAX_LINHAS = 400;

/** "6 na fila · 3 WhatsApp · 2 resumo · 9 resolvidos · 1 silenciado" — cada número leva à visão dele (modelo 17). */
function Numeros({ contas, ir }: { contas: Record<Cartao, number>; ir: (v: Visao | "resumo" | "silenciados") => void }) {
  const itens: [number, string, Visao | "resumo" | "silenciados", boolean?][] = [
    [contas.fila, "na fila", "fila"],
    [contas.whatsapp, "vão para o WhatsApp", "whatsapp", true],
    [contas.resumo, "só no resumo", "resumo"],
    [contas.resolvidos, "resolvidos", "resolvidos"],
    [contas.silenciados, contas.silenciados === 1 ? "silenciado" : "silenciados", "silenciados"],
  ];
  return (
    <p className="text-sm text-suave">
      {itens.map(([n, t, v, forte], i) => (
        <span key={v}>
          {i > 0 && <span className="mx-2">·</span>}
          <button type="button" onClick={() => ir(v)} className="hover:text-texto">
            <b className="tabular-nums text-texto" style={forte && n ? { color: corDoTom("bad") } : undefined}>
              {n}
            </b>{" "}
            {t}
          </button>
        </span>
      ))}
    </p>
  );
}

/** "+ Filtro": menu com regra, supervisor e destino, cada opção com a contagem (só o que existe com os outros filtros). */
function MaisFiltro({ alertas, f, mudar, hoje }: { alertas: AlertaGravado[]; f: FiltrosAlertas; mudar: (p: Partial<FiltrosAlertas>) => void; hoje: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [aberto]);
  const grupos: { dim: "regra" | "supervisor" | "destino"; titulo: string; texto: (v: string) => string }[] = [
    { dim: "regra", titulo: "Regra", texto: rotuloRegra },
    { dim: "supervisor", titulo: "Supervisor", texto: (v) => v || SEM_SUPERVISOR },
    { dim: "destino", titulo: "Destino", texto: (v) => ROTULO_DESTINO[v as Destino] },
  ];
  return (
    <div ref={ref} className="relative">
      <Pilula tracejada onClick={() => setAberto((a) => !a)} rotulo="Adicionar filtro">
        + Filtro
      </Pilula>
      {aberto && (
        <div role="menu" className="absolute left-0 top-9 z-30 max-h-[60vh] w-72 overflow-y-auto rounded-xl border border-borda bg-superficie p-2 shadow-xl">
          {grupos.map((g) => {
            const ops = opcoes(alertas, f, hoje, g.dim);
            return (
              <div key={g.dim} className="py-1">
                <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-suave">{g.titulo}</p>
                {ops.length ? (
                  ops.map((o) => (
                    <button
                      key={o.valor}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        mudar({ [g.dim]: o.valor });
                        setAberto(false);
                      }}
                      className={cx("flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-superficie-2", (f[g.dim] ?? null) === o.valor && "font-semibold")}
                    >
                      <span className="truncate">{g.texto(o.valor)}</span>
                      <span className="tabular-nums text-suave">{o.n}</span>
                    </button>
                  ))
                ) : (
                  <p className="px-2 py-1 text-[13px] text-suave">Nada com os filtros atuais</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Cabecalho({ col, rotulo, ord, mudar, className }: { col: Coluna; rotulo: string; ord: { col: Coluna; dir: "asc" | "desc" }; mudar: (c: Coluna) => void; className?: string }) {
  const ativo = ord.col === col;
  return (
    <th className={cx("px-3 py-2 font-medium", className)} aria-sort={ativo ? (ord.dir === "asc" ? "ascending" : "descending") : undefined}>
      <button type="button" onClick={() => mudar(col)} className={cx("inline-flex items-center gap-1 uppercase tracking-wider hover:text-texto", ativo && "text-texto")}>
        {rotulo}
        <span aria-hidden className="w-2">
          {ativo ? (ord.dir === "asc" ? "↑" : "↓") : ""}
        </span>
      </button>
    </th>
  );
}

/** Aba Alertas: visões em abas, números em linha, filtros em pílulas, tabela sem grade e o detalhe ao lado (modelos 9, 17, 26, 32 e 40). */
export function PainelAlertas({ alertas, hoje, email, aoMudar }: { alertas: AlertaGravado[]; hoje: string; email: string | null; aoMudar: () => void }) {
  const [f, setF] = useState<FiltrosAlertas>(FILTROS_PADRAO);
  const [ord, setOrd] = useState<{ col: Coluna; dir: "asc" | "desc" }>({ col: "nota", dir: "desc" });
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [lote, setLote] = useState<{ ocupado: boolean; erro: string | null }>({ ocupado: false, erro: null });
  const mudar = (p: Partial<FiltrosAlertas>) => setF((x) => ({ ...x, ...p }));
  const visoes = useMemo(() => contarVisoes(alertas, f, hoje), [alertas, f, hoje]);
  const contas = useMemo(() => contarCartoes(alertas, { ...f, atalho: null }, hoje), [alertas, f, hoje]);
  const lista = useMemo(() => ordenar(filtrar(alertas, f, hoje), ord.col, ord.dir), [alertas, f, hoje, ord]);
  const aberto = abertoId == null ? null : (alertas.find((a) => a.id === abertoId) ?? null);
  const selecionados = lista.filter((a) => marcados.has(a.id));
  const tags = etiquetas(f).filter((t) => t.dim !== "atalho");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setAbertoId(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const irVisao = (v: Visao) => mudar(VISOES.find((x) => x.id === v)!.filtro);
  const marcar = (id: number, v: boolean) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
  const mudarOrdem = (col: Coluna) => setOrd((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "nota" || col === "hora" ? "desc" : "asc" }));
  const emLote = async (fazer: () => Promise<unknown>) => {
    setLote({ ocupado: true, erro: null });
    try {
      await fazer();
      setMarcados(new Set());
      setLote({ ocupado: false, erro: null });
      aoMudar();
    } catch (e) {
      setLote({ ocupado: false, erro: erroTexto(e) });
    }
  };
  const visao = visaoAtual(f);
  const visiveis = lista.slice(0, MAX_LINHAS);
  const todosMarcados = visiveis.length > 0 && visiveis.every((a) => marcados.has(a.id));
  const acao = "text-[13px] font-medium text-link hover:underline disabled:cursor-not-allowed disabled:opacity-40 disabled:no-underline";

  return (
    <div className="space-y-5">
      <AbasTexto<Visao> rotulo="Visões" valor={visao} mudar={irVisao} abas={VISOES.map((v) => ({ id: v.id, rotulo: v.rotulo, n: visoes[v.id] }))} />
      <Numeros contas={contas} ir={(v) => (v === "resumo" ? mudar({ cartao: "resumo", atalho: null }) : v === "silenciados" ? mudar({ cartao: "silenciados", atalho: null }) : irVisao(v))} />
      <div role="group" aria-label="Filtros" className="flex flex-wrap items-center gap-2">
        <label className="inline-flex h-7 items-center gap-1 rounded-full border border-transparent bg-primaria-suave pl-3 pr-1 text-[13px]">
          <span className="text-suave">Período</span>
          <select aria-label="Período" value={f.periodo} onChange={(e) => mudar({ periodo: e.target.value as Periodo })} className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-texto outline-none">
            {PERIODOS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.rotulo}
              </option>
            ))}
          </select>
          <span aria-hidden className="text-suave">
            ▾
          </span>
        </label>
        {tags.map((t) => (
          <Pilula key={t.dim} ativa tirar={() => mudar({ [t.dim]: t.dim === "busca" ? "" : null })} rotulo={`Tirar filtro: ${t.texto}`}>
            <span className="text-suave">{t.dim === "regra" ? "Regra" : t.dim === "supervisor" ? "Supervisor" : t.dim === "destino" ? "Destino" : "Busca"}</span>
            {t.texto}
          </Pilula>
        ))}
        <MaisFiltro alertas={alertas} f={f} mudar={mudar} hoje={hoje} />
        <input
          type="search"
          aria-label="Buscar"
          placeholder="Buscar placa, vaga, local…"
          value={f.busca}
          onChange={(e) => mudar({ busca: e.target.value })}
          className="ml-auto h-8 w-full min-w-0 border-b border-transparent bg-transparent px-1 text-sm outline-none placeholder:text-suave focus:border-borda sm:w-64"
        />
      </div>

      <div className={cx("grid gap-6", aberto && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
        <section aria-label="Lista de alertas" className="min-w-0">
          {selecionados.length > 0 && (
            <div role="group" aria-label="Ações em lote" className="mb-2 flex flex-wrap items-center gap-4 text-[13px]">
              <span>
                <b className="tabular-nums">{selecionados.length}</b> marcados
              </span>
              <button type="button" className={acao} disabled={!email || lote.ocupado} title={email ? undefined : "Entre para usar as ações"} onClick={() => email && void emLote(() => marcarVistoVarios(selecionados.map((a) => a.id), email))}>
                Marcar como visto
              </button>
              <button type="button" className={acao} disabled={!email || lote.ocupado} title={email ? undefined : "Entre para usar as ações"} onClick={() => void emLote(() => resolverVarios(selecionados.map((a) => a.id)))}>
                Resolver
              </button>
              <button type="button" className="text-[13px] text-suave hover:text-texto" onClick={() => setMarcados(new Set())}>
                Desmarcar
              </button>
              {lote.erro && <Aviso tipo="erro">{lote.erro}</Aviso>}
            </div>
          )}
          {visiveis.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
                  <tr className="border-b border-borda">
                    <th className="w-8 py-2 pl-1">
                      <input type="checkbox" checked={todosMarcados} onChange={(e) => visiveis.forEach((a) => marcar(a.id, e.target.checked))} aria-label="Marcar todos" />
                    </th>
                    <Cabecalho col="nota" rotulo="Nota" ord={ord} mudar={mudarOrdem} className="w-16" />
                    <Cabecalho col="placa" rotulo="Placa" ord={ord} mudar={mudarOrdem} />
                    <Cabecalho col="regra" rotulo="Regra" ord={ord} mudar={mudarOrdem} />
                    <Cabecalho col="supervisor" rotulo="Supervisor" ord={ord} mudar={mudarOrdem} className={cx("hidden md:table-cell", aberto && "lg:hidden xl:table-cell")} />
                    <Cabecalho col="hora" rotulo="Hora" ord={ord} mudar={mudarOrdem} />
                    <th className={cx("hidden px-3 py-2 font-medium sm:table-cell", aberto && "lg:hidden")}>Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => (
                    <tr key={a.id} onClick={() => setAbertoId(a.id)} className={cx("cursor-pointer border-b border-borda/60 hover:bg-superficie-2", a.id === abertoId && "bg-primaria-suave hover:bg-primaria-suave")}>
                      <td className="py-2 pl-1" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={marcados.has(a.id)} onChange={(e) => marcar(a.id, e.target.checked)} aria-label={`Marcar ${a.placa} ${rotuloRegra(a.regra)}`} />
                      </td>
                      <td className="px-3 py-2">
                        <NotaSelo a={a} />
                      </td>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setAbertoId(a.id)} className="font-semibold">
                          {a.placa}
                        </button>
                      </td>
                      <td className="max-w-[320px] px-3 py-2">
                        <span className="block truncate">{rotuloRegra(a.regra)}</span>
                        <span className="block truncate text-xs text-suave">{a.detalhe}</span>
                      </td>
                      <td className={cx("hidden px-3 py-2 text-suave md:table-cell", aberto && "lg:hidden xl:table-cell")}>{a.supervisor ?? "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 tabular-nums text-suave">
                        {f.periodo === "hoje" ? "" : `${rotuloDia(a.dia, hoje)} `}
                        {fmtHora(a.ini).slice(0, 5)}
                      </td>
                      <td className={cx("hidden px-3 py-2 sm:table-cell", aberto && "lg:hidden")}>
                        <span className="inline-flex items-center gap-1.5 text-suave">
                          <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: corDoTom(TOM_SITUACAO[a.situacao]) }} />
                          {ROTULO_SITUACAO[a.situacao]}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {lista.length > MAX_LINHAS && <p className="py-3 text-[13px] text-suave">Mostrando {MAX_LINHAS} de {lista.length}. Use os filtros para achar o resto.</p>}
            </div>
          ) : (
            <Vazio titulo="Nenhum alerta aqui">Troque o período, escolha outra visão ou tire algum filtro.</Vazio>
          )}
        </section>
        {aberto && <DetalheAlerta a={aberto} todos={alertas} hoje={hoje} email={email} fechar={() => setAbertoId(null)} abrir={(x) => setAbertoId(x.id)} aoMudar={aoMudar} />}
      </div>
    </div>
  );
}
