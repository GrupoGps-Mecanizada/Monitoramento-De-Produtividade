"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Chip, Entrada, Segmentado, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { marcarVistoVarios, resolverVarios } from "@/lib/dados/alertas";
import {
  ATALHOS,
  CARTOES,
  FILTROS_PADRAO,
  PERIODOS,
  ROTULO_DESTINO,
  SEM_SUPERVISOR,
  agrupar,
  contarCartoes,
  etiquetas,
  filtrar,
  opcoes,
  rotuloRegra,
  type Agrupar,
  type Cartao,
  type FiltrosAlertas,
  type Ordem,
  type Periodo,
} from "@/lib/dominio/alertas/fila";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import { useOpcao } from "@/lib/hooks";
import { NotaSelo, ROTULO_SITUACAO, TOM_SITUACAO, erroTexto } from "./comum";
import { DetalheAlerta } from "./detalhe";

const AGRUPAR = ["supervisor", "equipamento", "regra", "nenhum"] as const;
const ORDEM = ["nota", "hora"] as const;
const MAX_LINHAS = 400;

function Cartoes({ contas, ativo, mudar }: { contas: Record<Cartao, number>; ativo: Cartao | null; mudar: (c: Cartao | null) => void }) {
  return (
    <div role="group" aria-label="Resumo" className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
      {CARTOES.map((c) => (
        <button
          key={c.id}
          type="button"
          aria-pressed={ativo === c.id}
          onClick={() => mudar(ativo === c.id ? null : c.id)}
          className={cx(
            "rounded-xl border p-3 text-left shadow-sm transition",
            ativo === c.id ? "border-primaria bg-primaria-suave" : "border-borda bg-superficie hover:bg-superficie-2",
          )}
        >
          <span className="block text-2xl font-bold tabular-nums">{contas[c.id]}</span>
          <span className="text-[13px] text-suave">{c.rotulo}</span>
        </button>
      ))}
    </div>
  );
}

function BarraFiltros({ alertas, f, mudar, hoje }: { alertas: AlertaGravado[]; f: FiltrosAlertas; mudar: (p: Partial<FiltrosAlertas>) => void; hoje: string }) {
  const ops = (dim: "regra" | "supervisor" | "destino") => opcoes(alertas, f, hoje, dim);
  const tags = etiquetas(f);
  return (
    <section aria-label="Filtros" className="space-y-2 rounded-xl border border-borda bg-superficie p-3 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Entrada type="search" placeholder="Buscar placa, vaga, local ou supervisor" aria-label="Buscar" value={f.busca} onChange={(e) => mudar({ busca: e.target.value })} className="w-full sm:w-72" />
        <Segmentado<Periodo> rotulo="Período" valor={f.periodo} mudar={(periodo) => mudar({ periodo })} opcoes={PERIODOS} />
        <Selecao aria-label="Regra" value={f.regra ?? "*"} onChange={(e) => mudar({ regra: e.target.value === "*" ? null : e.target.value })} className="w-auto min-w-[180px]">
          <option value="*">Todas as regras</option>
          {ops("regra").map((o) => (
            <option key={o.valor} value={o.valor}>
              {rotuloRegra(o.valor)} ({o.n})
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Supervisor" value={f.supervisor ?? "*"} onChange={(e) => mudar({ supervisor: e.target.value === "*" ? null : e.target.value })} className="w-auto min-w-[180px]">
          <option value="*">Todos os supervisores</option>
          {ops("supervisor").map((o) => (
            <option key={o.valor} value={o.valor}>
              {o.valor || SEM_SUPERVISOR} ({o.n})
            </option>
          ))}
        </Selecao>
        <Selecao aria-label="Destino" value={f.destino ?? "*"} onChange={(e) => mudar({ destino: e.target.value === "*" ? null : (e.target.value as Destino) })} className="w-auto min-w-[160px]">
          <option value="*">Todos os destinos</option>
          {ops("destino").map((o) => (
            <option key={o.valor} value={o.valor}>
              {ROTULO_DESTINO[o.valor as Destino]} ({o.n})
            </option>
          ))}
        </Selecao>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-suave">Atalhos:</span>
        {ATALHOS.map((x) => (
          <Chip key={x.id} ativo={f.atalho === x.id} onClick={() => mudar({ atalho: f.atalho === x.id ? null : x.id })}>
            {x.rotulo}
          </Chip>
        ))}
        {tags.length > 0 && (
          <span role="group" aria-label="Filtrando" className="flex flex-wrap items-center gap-1.5 sm:ml-3">
            <span className="text-suave">Filtrando:</span>
            {tags.map((t) => (
              <button
                key={t.dim}
                type="button"
                onClick={() => mudar({ [t.dim]: t.dim === "busca" ? "" : null })}
                aria-label={`Tirar filtro: ${t.texto}`}
                className="inline-flex h-7 items-center gap-1 rounded-full border border-primaria/40 bg-primaria-suave px-2.5 font-medium text-texto"
              >
                {t.texto} <span aria-hidden>×</span>
              </button>
            ))}
            <Botao tamanho="mini" variante="discreta" onClick={() => mudar({ regra: null, supervisor: null, destino: null, busca: "", atalho: null })}>
              Limpar
            </Botao>
          </span>
        )}
      </div>
    </section>
  );
}

function Linha({ a, hoje, marcado, marcar, abrir, aberto }: { a: AlertaGravado; hoje: string; marcado: boolean; marcar: (v: boolean) => void; abrir: () => void; aberto: boolean }) {
  return (
    <li className={cx("flex items-center gap-3 border-b border-borda px-3 py-2 text-[13px] last:border-b-0", aberto && "bg-primaria-suave")}>
      <input type="checkbox" checked={marcado} onChange={(e) => marcar(e.target.checked)} aria-label={`Marcar ${a.placa} ${rotuloRegra(a.regra)}`} />
      <button type="button" onClick={abrir} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <NotaSelo a={a} />
        <span className="min-w-0 flex-1">
          <span className="block truncate">
            <b>{a.placa}</b> · {rotuloRegra(a.regra)} · <span className="text-suave">{a.detalhe}</span>
          </span>
          <span className="block truncate text-xs text-suave">
            {rotuloDia(a.dia, hoje)} {fmtHora(a.ini).slice(0, 5)}
            {a.local && ` · ${a.local}`}
            {a.supervisor && ` · ${a.supervisor}`}
          </span>
        </span>
        <Selo tom={TOM_SITUACAO[a.situacao]} className="hidden sm:inline-flex">
          {ROTULO_SITUACAO[a.situacao]}
        </Selo>
      </button>
    </li>
  );
}

/** Aba Alertas: cartões que filtram, filtros em cascata, lista agrupada, ações em lote e a gaveta do alerta. */
export function PainelAlertas({ alertas, hoje, email, aoMudar }: { alertas: AlertaGravado[]; hoje: string; email: string | null; aoMudar: () => void }) {
  const [f, setF] = useState<FiltrosAlertas>(FILTROS_PADRAO);
  const [por, setPor] = useOpcao<Agrupar>("mon-gestao-agrupar", AGRUPAR, "supervisor");
  const [ordem, setOrdem] = useOpcao<Ordem>("mon-gestao-ordem", ORDEM, "nota");
  const [fechados, setFechados] = useState<Set<string>>(new Set());
  const [marcados, setMarcados] = useState<Set<number>>(new Set());
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const [lote, setLote] = useState<{ ocupado: boolean; erro: string | null }>({ ocupado: false, erro: null });
  const mudar = (p: Partial<FiltrosAlertas>) => setF((x) => ({ ...x, ...p }));
  const contas = useMemo(() => contarCartoes(alertas, f, hoje), [alertas, f, hoje]);
  const lista = useMemo(() => filtrar(alertas, f, hoje), [alertas, f, hoje]);
  const grupos = useMemo(() => agrupar(lista.slice(0, MAX_LINHAS), por, ordem), [lista, por, ordem]);
  const aberto = abertoId == null ? null : (alertas.find((a) => a.id === abertoId) ?? null);
  const selecionados = lista.filter((a) => marcados.has(a.id));
  const marcar = (id: number, v: boolean) =>
    setMarcados((s) => {
      const n = new Set(s);
      if (v) n.add(id);
      else n.delete(id);
      return n;
    });
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
  const alternarGrupo = (k: string) =>
    setFechados((s) => {
      const n = new Set(s);
      if (n.has(k)) n.delete(k);
      else n.add(k);
      return n;
    });

  return (
    <div className="space-y-3">
      <Cartoes contas={contas} ativo={f.cartao} mudar={(cartao) => mudar({ cartao })} />
      <BarraFiltros alertas={alertas} f={f} mudar={mudar} hoje={hoje} />
      <section aria-label="Lista de alertas" className="rounded-xl border border-borda bg-superficie shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
          <span className="text-sm">
            <b className="tabular-nums">{lista.length}</b> {lista.length === 1 ? "alerta" : "alertas"}
            {lista.length > MAX_LINHAS && <span className="text-suave"> (mostrando {MAX_LINHAS}; use os filtros)</span>}
          </span>
          <span className="flex flex-wrap items-center gap-2 sm:ml-auto">
            <Segmentado<Agrupar>
              rotulo="Agrupar"
              valor={por}
              mudar={setPor}
              opcoes={[
                { id: "supervisor", rotulo: "Supervisor" },
                { id: "equipamento", rotulo: "Equipamento" },
                { id: "regra", rotulo: "Regra" },
                { id: "nenhum", rotulo: "Sem grupo" },
              ]}
            />
            <Segmentado<Ordem>
              rotulo="Ordenar"
              valor={ordem}
              mudar={setOrdem}
              opcoes={[
                { id: "nota", rotulo: "Nota" },
                { id: "hora", rotulo: "Hora" },
              ]}
            />
          </span>
        </div>
        {selecionados.length > 0 && (
          <div role="group" aria-label="Ações em lote" className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie-2 px-3 py-2 text-sm">
            <b className="tabular-nums">{selecionados.length}</b> marcados
            <Botao
              tamanho="mini"
              variante="secundaria"
              disabled={!email || lote.ocupado}
              title={email ? undefined : "Entre para usar as ações"}
              onClick={() => email && void emLote(() => marcarVistoVarios(selecionados.map((a) => a.id), email))}
            >
              Marcar como visto
            </Botao>
            <Botao
              tamanho="mini"
              variante="secundaria"
              disabled={!email || lote.ocupado}
              title={email ? undefined : "Entre para usar as ações"}
              onClick={() => void emLote(() => resolverVarios(selecionados.map((a) => a.id)))}
            >
              Resolver
            </Botao>
            <Botao tamanho="mini" variante="discreta" onClick={() => setMarcados(new Set())}>
              Desmarcar
            </Botao>
            {lote.erro && <Aviso tipo="erro">{lote.erro}</Aviso>}
          </div>
        )}
        {grupos.length ? (
          grupos.map((g) => {
            const fechado = fechados.has(g.chave);
            const todosMarcados = g.itens.every((a) => marcados.has(a.id));
            return (
              <div key={g.chave}>
                {por !== "nenhum" && (
                  <div className="flex items-center gap-2 border-b border-borda bg-superficie-2/60 px-3 py-1.5 text-[13px]">
                    <input
                      type="checkbox"
                      checked={todosMarcados}
                      onChange={(e) => g.itens.forEach((a) => marcar(a.id, e.target.checked))}
                      aria-label={`Marcar todos de ${g.titulo}`}
                    />
                    <button type="button" onClick={() => alternarGrupo(g.chave)} aria-expanded={!fechado} className="flex flex-1 items-center gap-2 text-left font-semibold">
                      <span aria-hidden className={cx("inline-block transition", !fechado && "rotate-90")}>
                        ›
                      </span>
                      {g.titulo}
                      <span className="font-normal text-suave">
                        · {g.itens.length} · nota máx. {g.notaMax}
                      </span>
                    </button>
                  </div>
                )}
                {!fechado && (
                  <ul>
                    {g.itens.map((a) => (
                      <Linha key={a.id} a={a} hoje={hoje} marcado={marcados.has(a.id)} marcar={(v) => marcar(a.id, v)} abrir={() => setAbertoId(a.id)} aberto={a.id === abertoId} />
                    ))}
                  </ul>
                )}
              </div>
            );
          })
        ) : (
          <Vazio titulo="Nenhum alerta com esses filtros">Troque o período, clique noutro cartão ou limpe os filtros.</Vazio>
        )}
      </section>
      {aberto && <DetalheAlerta a={aberto} todos={alertas} hoje={hoje} email={email} fechar={() => setAbertoId(null)} abrir={(x) => setAbertoId(x.id)} aoMudar={aoMudar} />}
    </div>
  );
}
