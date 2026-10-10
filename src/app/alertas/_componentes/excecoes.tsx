"use client";

import Link from "next/link";
import { useMemo, useState, type ReactNode } from "react";
import { Aviso, Chip, Contador, Segmentado, Selecao, Selo, Vazio } from "@/components/ui";
import { useExcecoesDados } from "@/lib/dados/excecoes";
import { useRetrato } from "@/lib/dados/use-retrato";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { REGRAS, ROTULO_REGRA, excecoesDoDia, type Excecao, type RegraExcecao } from "@/lib/dominio/excecoes";
import { diaLocal, fmtHora, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { ROTULO_REGIME, regimeDoEquip } from "@/lib/dominio/regras-frota";
import { useAgora, useOpcao } from "@/lib/hooks";
import type { Veiculo } from "@/lib/tipos";

const hm = (s: number) => fmtHora(s).slice(0, 5);
const AGRUPAR = ["equipamento", "regra"] as const;

function Linha({ x, dia, nome }: { x: Excecao; dia: string; nome?: string }) {
  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-3 border-b border-borda px-4 py-2.5 text-[13px] last:border-b-0">
      <Selo tom={x.gravidade === "alerta" ? "bad" : "warn"}>{x.gravidade === "alerta" ? "Alerta" : "Atenção"}</Selo>
      <span className="min-w-0 leading-snug">
        <b>{nome ?? ROTULO_REGRA[x.regra]}</b>
        <span className="block text-xs text-suave">
          {hm(x.ini)}
          {x.fim != null && `–${hm(x.fim)}`} · {x.detalhe}
          {x.local && ` · ${x.local}`}
        </span>
      </span>
      <Link href={`/timeline/?v=${encodeURIComponent(x.veiculo)}&dia=${dia}`} className="whitespace-nowrap text-xs font-semibold text-primaria">
        Timeline ›
      </Link>
    </li>
  );
}

/** Exceções do dia: só o que fugiu das regras da frota (regras em src/lib/dominio/regras-frota.ts). */
export function Excecoes({ topo }: { topo?: ReactNode }) {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [agrupar, setAgrupar] = useOpcao("mon-excecoes-agrupar", AGRUPAR, "equipamento");
  const [regra, setRegra] = useState<RegraExcecao | null>(null);
  const ehHoje = dia === hoje;
  const { dados, erro } = useExcecoesDados(dia, ehHoje);
  const veiculos = useMemo(() => (retrato?.veiculos ?? []).filter((v) => !v.motor2_de && v.equip), [retrato]);
  const agoraSeg = ehHoje && agora ? Math.floor((agora - Date.parse(`${dia}T00:00:00-03:00`)) / 1000) : null;
  // minuto a minuto basta: o coletor vê a frota a cada ~5 min
  const minuto = agoraSeg == null ? null : agoraSeg - (agoraSeg % 60);
  const todas = useMemo(() => (dados ? excecoesDoDia({ dia, agoraSeg: minuto, veiculos, ...dados }) : []), [dados, dia, minuto, veiculos]);
  const lista = regra ? todas.filter((x) => x.regra === regra) : todas;
  const porVeiculo = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);
  const conta = (r: RegraExcecao) => todas.filter((x) => x.regra === r).length;
  const nEquip = new Set(todas.map((x) => x.veiculo)).size;
  const dias = useMemo(() => ultimosDias(30), []);

  const grupos: { chave: string; titulo: ReactNode; itens: Excecao[] }[] =
    agrupar === "regra"
      ? REGRAS.filter((r) => lista.some((x) => x.regra === r)).map((r) => ({ chave: r, titulo: ROTULO_REGRA[r], itens: lista.filter((x) => x.regra === r) }))
      : [...new Set(lista.map((x) => x.veiculo))].map((id) => ({ chave: id, titulo: <TituloEquip v={porVeiculo.get(id)} />, itens: lista.filter((x) => x.veiculo === id) }));

  return (
    <div className="mx-auto w-full max-w-[1100px] space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      {topo}
      <section aria-label="Resumo das exceções" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-36">
            {dias.map((d) => (
              <option key={d} value={d}>
                {rotuloDia(d, hoje)}
              </option>
            ))}
          </Selecao>
          <p className="text-sm">
            <b className="text-lg tabular-nums">{todas.length}</b> {todas.length === 1 ? "exceção" : "exceções"} em <b className="tabular-nums">{nEquip}</b> {nEquip === 1 ? "equipamento" : "equipamentos"}
            {ehHoje && <span className="text-suave"> · atualiza sozinho</span>}
          </p>
          <span className="md:ml-auto">
            <Segmentado rotulo="Agrupar" valor={agrupar} mudar={setAgrupar} opcoes={[{ id: "equipamento", rotulo: "Por equipamento" }, { id: "regra", rotulo: "Por regra" }]} />
          </span>
        </div>
        <div className="flex flex-wrap gap-1.5" aria-label="Filtrar por regra">
          {REGRAS.map((r) => (
            <Chip key={r} ativo={regra === r} onClick={() => setRegra(regra === r ? null : r)}>
              {ROTULO_REGRA[r]} <Contador n={conta(r)} />
            </Chip>
          ))}
        </div>
      </section>
      {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
      <section aria-label="Exceções" className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
        {!dados && !erro ? (
          <Vazio titulo="Carregando as exceções…" />
        ) : !lista.length ? (
          <Vazio titulo="Nenhuma exceção neste dia">{regra ? "Tire o filtro da regra para ver as outras." : "Tudo dentro das regras."}</Vazio>
        ) : (
          grupos.map((g) => (
            <div key={g.chave}>
              <h3 className="flex items-center justify-between border-b border-borda bg-superficie-2 px-4 py-1.5 text-[12px] font-semibold">
                <span>{g.titulo}</span>
                <Contador n={g.itens.length} />
              </h3>
              <ul>
                {g.itens.map((x, i) => (
                  <Linha key={`${x.veiculo}-${x.regra}-${x.ini}-${i}`} x={x} dia={dia} nome={agrupar === "regra" ? (porVeiculo.get(x.veiculo)?.equip?.nome ?? x.veiculo) : undefined} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
      <p className="text-xs text-suave">Regras da frota: horários do Pátio por regime, oficinas, bica, restaurante, ociosidade (30 min) e motor desligado (1 h). Fins de semana e feriados seguem o regime.</p>
    </div>
  );
}

function TituloEquip({ v }: { v: Veiculo | undefined }) {
  if (!v?.equip) return <>Equipamento</>;
  const r = regimeDoEquip(v.equip.regime, v.vaga);
  return (
    <span className="flex flex-wrap items-center gap-2">
      {v.equip.nome}
      <span className="font-normal text-suave">
        {TIPOS_EQUIP[v.equip.tipo].rotulo} · {ROTULO_REGIME[r.regime]}
      </span>
      {r.presumido && <Selo tom="neu">regime presumido</Selo>}
    </span>
  );
}
