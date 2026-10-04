"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { EventoTexto } from "@/components/evento-texto";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Campos, Chip, Contador, Entrada, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { CLASSE_TOM, corDoTom } from "@/lib/cores";
import { lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { GRUPOS, ROTULO_TIPO, TODOS_GRUPOS, agruparPorHora, chaveEvento, contarPorGrupo, ehAlerta, filtrarEventos, grupoDoEvento, veiculoDoEvento, type GrupoEvento } from "@/lib/dominio/eventos";
import { dataHora, diaLocal, fmtMin, hora, horaSeg, rotuloDia } from "@/lib/dominio/formato";
import { useCelular } from "@/lib/hooks";
import type { Evento } from "@/lib/tipos";

/** Alertas: entradas/saídas de área, mudanças de status e perda/volta de sinal, por dia. */
export function Alertas() {
  const params = useSearchParams();
  const celular = useCelular();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [dias, setDias] = useState<string[]>([]);
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);
  const { eventos: doDia, carregando, erro } = useEventos(dia);
  // a abertura do dia (coletor) não é alerta
  const eventos = useMemo(() => doDia.filter(ehAlerta), [doDia]);
  const [grupos, setGrupos] = useState<Set<GrupoEvento>>(() => new Set(TODOS_GRUPOS));
  const [busca, setBusca] = useState(() => (params.get("placa") ?? "").toUpperCase());
  const [lidos, setLidos] = useState<Set<string>>(() => new Set());
  const [aberto, setAberto] = useState<Evento | null>(null);

  const conta = contarPorGrupo(eventos);
  const lista = useMemo(() => filtrarEventos(eventos, grupos, busca), [eventos, grupos, busca]);
  const blocos = useMemo(() => agruparPorHora(lista), [lista]);
  const todos = grupos.size === TODOS_GRUPOS.length;
  const opcoesDias = dias.includes(dia) ? dias : [dia, ...dias];

  // indicador: só aquele grupo; clicar de novo (ou em Total) volta a mostrar todos
  const indicador = (id: GrupoEvento | "todos") => {
    if (id === "todos") setGrupos(new Set(TODOS_GRUPOS));
    else setGrupos(todos || !grupos.has(id) ? new Set([id]) : new Set(TODOS_GRUPOS));
  };
  const alternarGrupo = (g: GrupoEvento) => {
    const n = new Set(grupos);
    if (n.has(g)) n.delete(g);
    else n.add(g);
    setGrupos(n.size ? n : new Set(TODOS_GRUPOS));
  };
  const abrir = (e: Evento) => {
    setLidos((l) => new Set(l).add(chaveEvento(e)));
    setAberto(e);
  };

  const cartoes: { id: GrupoEvento | "todos"; rotulo: string; n: number; cor: string; ativo: boolean }[] = [
    { id: "todos", rotulo: "Total", n: eventos.length, cor: "var(--primaria)", ativo: todos },
    ...TODOS_GRUPOS.map((g) => ({ id: g, rotulo: GRUPOS[g].rotulo, n: conta[g], cor: corDoTom(GRUPOS[g].tom), ativo: !todos && grupos.size === 1 && grupos.has(g) })),
  ];

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 sm:gap-3">
        {cartoes.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.ativo}
            onClick={() => indicador(c.id)}
            className={cx("rounded-xl border bg-superficie px-4 py-3 text-left shadow-sm transition hover:shadow-md", c.ativo ? "border-primaria ring-2 ring-[var(--anel)]" : "border-borda")}
          >
            <span className="block text-2xl font-semibold tabular-nums" style={{ color: c.cor }}>
              {c.n}
            </span>
            <span className="text-xs text-suave">{c.rotulo}</span>
          </button>
        ))}
      </div>

      <section className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
        <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
          <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36">
            {opcoesDias.map((d) => (
              <option key={d} value={d}>
                {rotuloDia(d, hoje)}
              </option>
            ))}
          </Selecao>
          <Entrada type="search" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Placa ou área…" aria-label="Buscar alerta" autoComplete="off" className="min-w-40 flex-1" />
          <div className="flex flex-wrap gap-1.5">
            {TODOS_GRUPOS.map((g) => (
              <Chip key={g} ativo={grupos.has(g)} tom={GRUPOS[g].tom} onClick={() => alternarGrupo(g)}>
                {GRUPOS[g].rotulo} <Contador n={conta[g]} />
              </Chip>
            ))}
          </div>
          <span className="ml-auto text-xs text-suave">
            {eventos.length} eventos · {rotuloDia(dia, hoje).toLowerCase()}
          </span>
        </div>
        {erro && (
          <div className="p-3">
            <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
          </div>
        )}
        {carregando ? (
          <Vazio titulo="Carregando alertas…" />
        ) : !lista.length ? (
          <Vazio titulo="Nenhum evento encontrado">Ajuste os filtros ou escolha outro dia.</Vazio>
        ) : (
          blocos.map((b) => (
            <div key={b.rotulo}>
              <h3 className="sticky top-[56px] z-10 flex items-center justify-between border-b border-borda bg-superficie-2 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-suave md:top-[62px]">
                <span>{b.rotulo}</span>
                <Contador n={b.eventos.length} />
              </h3>
              {b.eventos.map((e) => {
                const k = chaveEvento(e);
                const g = GRUPOS[grupoDoEvento(e)];
                return (
                  <button
                    key={k}
                    type="button"
                    onClick={() => abrir(e)}
                    className={cx(
                      "grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-3 border-b border-l-[3px] border-b-borda px-4 py-2.5 text-left text-[13px] hover:bg-superficie-2",
                      aberto && chaveEvento(aberto) === k ? "bg-primaria-suave" : !lidos.has(k) && "font-medium",
                    )}
                    style={{ borderLeftColor: corDoTom(g.tom) }}
                  >
                    <span className={cx("grid h-7 w-7 place-items-center rounded-md text-xs font-bold", CLASSE_TOM[g.tom])}>{g.icone}</span>
                    <span className="min-w-0 leading-snug">
                      <EventoTexto e={e} />
                    </span>
                    <span className="text-xs tabular-nums text-suave">{hora(e.t)}</span>
                  </button>
                );
              })}
            </div>
          ))
        )}
      </section>

      {aberto && <DetalheAlerta e={aberto} eventos={eventos} modal={celular} fechar={() => setAberto(null)} />}
    </div>
  );
}

function DetalheAlerta({ e, eventos, modal, fechar }: { e: Evento; eventos: Evento[]; modal: boolean; fechar: () => void }) {
  const g = GRUPOS[grupoDoEvento(e)];
  const veiculo = veiculoDoEvento(e);
  const diaEv = diaLocal(new Date(e.t));
  const campos: [string, ReactNode][] = [];
  if (e.area) campos.push(["Área", e.area]);
  if (e.tipo === "status") campos.push(["De", e.de], ["Para", <b key="para">{e.para}</b>]);
  if (e.tipo === "status" && e.duracao_min != null) campos.push(["Duração anterior", fmtMin(e.duracao_min)]);
  if (e.tipo === "saida" && e.permanencia_min != null) campos.push(["Permanência", fmtMin(e.permanencia_min)]);
  if (e.tipo === "sinal_perdido" && e.ultima_posicao) campos.push(["Última posição", horaSeg(e.ultima_posicao)]);
  if (e.tipo === "sinal_retomado" && e.sem_sinal_min != null) campos.push(["Sem sinal por", fmtMin(e.sem_sinal_min)]);
  const mesmo = eventos.filter((x) => veiculoDoEvento(x) === veiculo).sort((a, b) => b.t.localeCompare(a.t));
  return (
    <Gaveta
      titulo={e.motor2 ? `${e.principal ?? e.placa} · motor 2º` : e.placa}
      sub={
        <span className="flex flex-wrap items-center gap-2">
          <Selo tom={g.tom}>{ROTULO_TIPO[e.tipo]}</Selo>
          {dataHora(e.t)}
        </span>
      }
      modal={modal}
      fechar={fechar}
      largura="min(480px, 100vw)"
      rodape={
        <div className="flex flex-wrap gap-2">
          <Link href={`/timeline/?v=${encodeURIComponent(veiculo)}&dia=${diaEv}`} className="btn-pri h-9 text-sm hover:no-underline">
            Ver timeline
          </Link>
          <Link href={`/#v=${encodeURIComponent(veiculo)}`} className="btn-sec h-9 text-sm hover:no-underline">
            Ver no mapa
          </Link>
        </div>
      }
    >
      <p className="mb-4 text-sm leading-snug">
        <EventoTexto e={e} />
      </p>
      {campos.length > 0 && <Campos itens={campos} />}
      {mesmo.length > 1 && (
        <div className="mt-6">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-suave">Outros eventos de {e.motor2 ? (e.principal ?? e.placa) : e.placa} neste dia</p>
          <ol className="space-y-1.5 border-l-2 border-borda pl-3">
            {mesmo.map((x) => (
              <li key={chaveEvento(x)} className={cx("text-[13px] leading-snug", chaveEvento(x) === chaveEvento(e) && "font-semibold")}>
                <span className="mr-2 tabular-nums text-suave">{hora(x.t)}</span>
                <EventoTexto e={x} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </Gaveta>
  );
}
