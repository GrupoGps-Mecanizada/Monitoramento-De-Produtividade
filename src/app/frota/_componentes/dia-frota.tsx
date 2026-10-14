"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Aviso, Segmentado, Selecao, Selo, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { useMotorFrota } from "@/lib/dados/gauss-dia";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { agruparFrota, montarDiaFrota, type GrupoFrota, type LinhaFrota, type OrdemFrota } from "@/lib/dominio/dia-frota";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { diaLocal, fmtHora, fmtHoras, idadeCurta, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { STATUS_GAUSS, statusGauss } from "@/lib/dominio/gauss-dia";
import { vagaCurta } from "@/lib/dominio/veiculo";
import { useAgora } from "@/lib/hooks";

const DIA = 86400;
const pct = (s: number) => `${(Math.min(DIA, Math.max(0, s)) / DIA) * 100}%`;
const COLUNAS = "md:grid-cols-[180px_1fr_150px]";
// cores da legenda: os status mais comuns da timeline de motor do GAUSS
const LEGENDA = ["secondary_motor_on", "on", "stopped", "off", "categorized_stop", "maintenance", "out_of_plant", "no_data"].map((c) => STATUS_GAUSS[c]);

/**
 * Dia da frota: uma faixa por equipamento com o status de motor da timeline do GAUSS (sem RPM) e, à direita, o tempo
 * produtivo do dia pela regra do tipo (Alta Pressão: motor 2º; Alto Vácuo: parado ligado). O produtivo dentro da base
 * (Pátio do Transporte, Garagem) não conta: aparece à parte como "motor ligado na base".
 */
export function DiaFrota() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [ordem, setOrdem] = useState<OrdemFrota>("tipo");
  const ehHoje = dia === hoje;
  const { linhas, gravadoEm, carregando, erro } = useMotorFrota(dia, ehHoje);
  // entradas e saídas de área (só o Supabase): separam o produtivo na base
  const { eventos } = useEventos(dia);
  const agoraSeg = ehHoje && agora ? (agora - new Date(`${dia}T00:00:00`).getTime()) / 1000 : null;
  const grupos = useMemo(() => agruparFrota(montarDiaFrota(linhas, retrato?.veiculos ?? [], dia, agoraSeg, eventos), ordem), [linhas, retrato, dia, agoraSeg, eventos, ordem]);
  const dias = useMemo(() => ultimosDias(30), []);

  return (
    <div className="w-full space-y-3 px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie p-3 shadow-sm">
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-40">
          {dias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
        <Segmentado
          rotulo="Ordenar"
          valor={ordem}
          mudar={setOrdem}
          opcoes={[
            { id: "tipo", rotulo: "Por tipo" },
            { id: "mais", rotulo: "Mais produtivo" },
            { id: "menos", rotulo: "Menos produtivo" },
          ]}
        />
        <span className="text-xs text-suave md:ml-auto">{gravadoEm ? `timeline de motor do GAUSS · atualizada ${idadeCurta(gravadoEm, agora ?? undefined)}` : "timeline de motor do GAUSS"}</span>
        <ul aria-label="Cores do motor" className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
          {LEGENDA.map((e) => (
            <li key={e.rotulo} className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: corDoTom(e.tom) }} />
              {e.rotulo}
            </li>
          ))}
        </ul>
      </div>
      {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
      {carregando && !linhas.length ? (
        <Vazio titulo="Carregando o dia da frota…" />
      ) : !grupos.length ? (
        <Vazio titulo="Nenhum equipamento">Aguardando a primeira leitura do coletor.</Vazio>
      ) : (
        <div className="overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
          <div className={`hidden gap-3 border-b border-borda px-3 py-1.5 text-[10px] tabular-nums text-suave md:grid ${COLUNAS}`}>
            <span />
            <span className="flex justify-between">
              {["0h", "3h", "6h", "9h", "12h", "15h", "18h", "21h", "24h"].map((h) => (
                <span key={h}>{h}</span>
              ))}
            </span>
            <span className="text-right">produtivo no dia</span>
          </div>
          {grupos.map((g) => (
            <Grupo key={g.tipo} g={g} dia={dia} agoraSeg={agoraSeg} />
          ))}
        </div>
      )}
    </div>
  );
}

function Grupo({ g, dia, agoraSeg }: { g: GrupoFrota; dia: string; agoraSeg: number | null }) {
  return (
    <section>
      <h2 className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie-2 px-3 py-2 text-[13px]">
        <b>{TIPOS_EQUIP[g.tipo].rotulo}</b>
        <span className="text-suave">{g.linhas.length}</span>
        {agoraSeg != null && (
          <>
            {g.produtivo && <Selo tom="motor2">{g.agoraProdutivos} produzindo agora</Selo>}
            <Selo tom="ok">{g.agoraLigados} ligados</Selo>
            <Selo tom="bad">{g.agoraDesligados} desligados</Selo>
          </>
        )}
        <span className="ml-auto text-suave">
          {g.produtivo ? (
            <>
              produtivo ({statusGauss(g.produtivo).rotulo.toLowerCase()}): <b className="text-texto">{fmtHoras(g.produtivo_min)}</b>
              {g.base_min >= 1 && <> · motor ligado na base: {fmtHoras(g.base_min)}</>}
            </>
          ) : (
            <>
              motor ligado: <b className="text-texto">{fmtHoras(g.ligado_min)}</b>
            </>
          )}
        </span>
      </h2>
      {g.linhas.map((l) => (
        <Linha key={l.id} l={l} dia={dia} agoraSeg={agoraSeg} />
      ))}
    </section>
  );
}

function Linha({ l, dia, agoraSeg }: { l: LinhaFrota; dia: string; agoraSeg: number | null }) {
  const vaga = l.tipo === "as" ? "" : vagaCurta(l.vaga);
  const base = (agoraSeg ?? DIA) / 60;
  const valor = l.produtivo_min ?? l.ligado_min;
  return (
    <Link href={`/timeline/?v=${encodeURIComponent(l.id)}&dia=${dia}`} className={`grid grid-cols-1 gap-1 border-b border-borda px-3 py-2 hover:bg-superficie-2 hover:no-underline md:items-center md:gap-3 ${COLUNAS}`}>
      <span className="truncate text-[13px] font-semibold text-texto">
        {l.nome}
        {vaga && <span className="ml-1.5 text-xs font-normal text-suave">{vaga}</span>}
      </span>
      <span className="relative block h-4 overflow-hidden rounded bg-superficie-2">
        {!l.blocos.length && <span className="absolute inset-0 grid place-items-center text-[10px] text-suave">sem timeline de motor neste dia</span>}
        {l.blocos.map((x, i) => (
          <span
            key={i}
            title={`${fmtHora(x.a).slice(0, 5)}–${fmtHora(x.b).slice(0, 5)} · ${x.rotulo}${x.cod === l.produtivo ? " (produtivo)" : ""}`}
            className="absolute inset-y-0"
            style={{ left: pct(x.a), width: pct(Math.max(x.b - x.a, 60)), background: corDoTom(x.tom) }}
          />
        ))}
        {agoraSeg != null && <span aria-hidden className="absolute inset-y-0 w-0.5" style={{ left: pct(agoraSeg), background: "var(--texto)" }} />}
      </span>
      <span className="text-right text-xs tabular-nums text-suave">
        <b className="text-texto">{fmtHoras(valor)}</b> {l.produtivo ? "produtivo" : "motor ligado"}
        <span className="mt-0.5 block h-1 overflow-hidden rounded bg-superficie-2">
          <span className="block h-full" style={{ width: `${Math.min(100, (valor / Math.max(base, 1)) * 100)}%`, background: corDoTom(l.produtivo ? statusGauss(l.produtivo).tom : "ok") }} />
        </span>
        {l.base_min >= 1 && <span className="mt-0.5 block text-[10px]">+ {fmtHoras(l.base_min)} motor ligado na base</span>}
      </span>
    </Link>
  );
}
