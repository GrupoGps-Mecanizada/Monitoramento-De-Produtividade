"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Vazio, cx } from "@/components/ui";
import {
  FILTROS_PADRAO,
  PERIODOS,
  SEM_SUPERVISOR,
  VISOES,
  contarVisoes,
  etiquetas,
  filtrar,
  opcoes,
  ordenar,
  rotuloRegra,
  visaoAtual,
  type Coluna,
  type FiltrosAlertas,
  type Periodo,
  type Visao,
} from "@/lib/dominio/alertas/fila";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import { corDoTom } from "@/lib/cores";
import { AbasTexto, Pilula } from "./comum";
import { DetalheAlerta } from "./detalhe";

const MAX_LINHAS = 400;

/** "+ Filtro": menu com regra e supervisor, cada opção com a contagem (só o que existe com os outros filtros). */
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
  const grupos: { dim: "regra" | "supervisor"; titulo: string; texto: (v: string) => string }[] = [
    { dim: "regra", titulo: "Regra", texto: rotuloRegra },
    { dim: "supervisor", titulo: "Supervisor", texto: (v) => v || SEM_SUPERVISOR },
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

/**
 * Aba Alertas: só olhar o que vai e o que não vai para o WhatsApp (pedido do dono, 19/10/2026: sem marcar, sem
 * supervisor/coordenador). Visões em abas, filtros em pílulas, tabela sem grade e o detalhe ao lado.
 */
export function PainelAlertas({ alertas, hoje }: { alertas: AlertaGravado[]; hoje: string }) {
  const [f, setF] = useState<FiltrosAlertas>(FILTROS_PADRAO);
  const [ord, setOrd] = useState<{ col: Coluna; dir: "asc" | "desc" }>({ col: "hora", dir: "desc" });
  const [abertoId, setAbertoId] = useState<number | null>(null);
  const mudar = (p: Partial<FiltrosAlertas>) => setF((x) => ({ ...x, ...p }));
  const visoes = useMemo(() => contarVisoes(alertas, f, hoje), [alertas, f, hoje]);
  const lista = useMemo(() => ordenar(filtrar(alertas, f, hoje), ord.col, ord.dir), [alertas, f, hoje, ord]);
  const aberto = abertoId == null ? null : (alertas.find((a) => a.id === abertoId) ?? null);
  const tags = etiquetas(f).filter((t) => t.dim === "regra" || t.dim === "supervisor" || t.dim === "busca");
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && !e.defaultPrevented && setAbertoId(null);
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, []);
  const irVisao = (v: Visao) => mudar(VISOES.find((x) => x.id === v)!.filtro);
  const mudarOrdem = (col: Coluna) => setOrd((o) => (o.col === col ? { col, dir: o.dir === "asc" ? "desc" : "asc" } : { col, dir: col === "nota" || col === "hora" ? "desc" : "asc" }));
  const visao = visaoAtual(f);
  const visiveis = lista.slice(0, MAX_LINHAS);

  return (
    <div className="space-y-5">
      <AbasTexto<Visao> rotulo="Visões" valor={visao} mudar={irVisao} abas={VISOES.map((v) => ({ id: v.id, rotulo: v.rotulo, n: visoes[v.id] }))} />
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
            <span className="text-suave">{t.dim === "regra" ? "Regra" : t.dim === "supervisor" ? "Supervisor" : "Busca"}</span>
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
          {visiveis.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
                  <tr className="border-b border-borda">
                    <Cabecalho col="hora" rotulo="Hora" ord={ord} mudar={mudarOrdem} className="w-24 pl-1" />
                    <Cabecalho col="placa" rotulo="Placa" ord={ord} mudar={mudarOrdem} />
                    <Cabecalho col="regra" rotulo="Regra" ord={ord} mudar={mudarOrdem} />
                    <Cabecalho col="supervisor" rotulo="Supervisor" ord={ord} mudar={mudarOrdem} className={cx("hidden md:table-cell", aberto && "lg:hidden xl:table-cell")} />
                    <th className="px-3 py-2 font-medium">WhatsApp</th>
                  </tr>
                </thead>
                <tbody>
                  {visiveis.map((a) => {
                    const vai = a.destino === "whatsapp";
                    return (
                      <tr key={a.id} onClick={() => setAbertoId(a.id)} className={cx("cursor-pointer border-b border-borda/60 hover:bg-superficie-2", a.id === abertoId && "bg-primaria-suave hover:bg-primaria-suave")}>
                        <td className="whitespace-nowrap py-2 pl-1 pr-3 tabular-nums text-suave">
                          {f.periodo === "hoje" ? "" : `${rotuloDia(a.dia, hoje)} `}
                          {fmtHora(a.ini).slice(0, 5)}
                        </td>
                        <td className="px-3 py-2">
                          <button type="button" onClick={() => setAbertoId(a.id)} className="font-semibold">
                            {a.placa}
                          </button>
                        </td>
                        <td className="max-w-[360px] px-3 py-2">
                          <span className="block truncate">{rotuloRegra(a.regra)}</span>
                          <span className="block truncate text-xs text-suave">{a.detalhe}</span>
                        </td>
                        <td className={cx("hidden px-3 py-2 text-suave md:table-cell", aberto && "lg:hidden xl:table-cell")}>{a.supervisor ?? "—"}</td>
                        <td className="whitespace-nowrap px-3 py-2">
                          <span className={cx("inline-flex items-center gap-1.5", !vai && "text-suave")}>
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: vai ? corDoTom("ok") : "var(--borda)" }} />
                            {vai ? "Envia" : "Não envia"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {lista.length > MAX_LINHAS && <p className="py-3 text-[13px] text-suave">Mostrando {MAX_LINHAS} de {lista.length}. Use os filtros para achar o resto.</p>}
            </div>
          ) : (
            <Vazio titulo="Nenhum alerta aqui">Troque o período, escolha outra visão ou tire algum filtro.</Vazio>
          )}
        </section>
        {aberto && <DetalheAlerta a={aberto} todos={alertas} hoje={hoje} fechar={() => setAbertoId(null)} abrir={(x) => setAbertoId(x.id)} />}
      </div>
    </div>
  );
}
