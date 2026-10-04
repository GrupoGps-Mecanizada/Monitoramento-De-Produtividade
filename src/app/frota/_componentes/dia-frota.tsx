"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Aviso, Segmentado, Selecao, Selo, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { lerDias } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { agruparFrota, minutoDoDia, montarDiaFrota, type EstadoFaixa, type GrupoFrota, type LinhaFrota, type OrdemFrota } from "@/lib/dominio/dia-frota";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { diaLocal, fmtHoras, hmDoMinuto, rotuloDia } from "@/lib/dominio/formato";
import { vagaCurta } from "@/lib/dominio/veiculo";
import { useAgora } from "@/lib/hooks";

const ESTADOS: Record<EstadoFaixa, { rotulo: string; estilo: CSSProperties }> = {
  ligado: { rotulo: "Ligado", estilo: { background: corDoTom("ok") } },
  desligado: { rotulo: "Desligado", estilo: { background: corDoTom("bad") } },
  manut: { rotulo: "Manutenção", estilo: { background: corDoTom("na") } },
  sem_sinal: { rotulo: "Sem sinal", estilo: { background: "repeating-linear-gradient(135deg, var(--neu-dot) 0 3px, transparent 3px 6px)" } },
  sem_registro: { rotulo: "Sem registro", estilo: {} },
};
const pct = (m: number) => `${(m / 1440) * 100}%`;
const COLUNAS = "md:grid-cols-[180px_1fr_120px]";

/** Dia da frota: uma faixa por equipamento (ligado/desligado/sem sinal ao longo do dia), por tipo. Só eventos já gravados. */
export function DiaFrota() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [dias, setDias] = useState<string[]>([]);
  const [ordem, setOrdem] = useState<OrdemFrota>("tipo");
  useEffect(() => {
    lerDias().then(setDias, () => undefined);
  }, []);
  const { eventos, carregando, erro } = useEventos(dia);
  const ehHoje = dia === hoje;
  const grupos = useMemo(() => agruparFrota(montarDiaFrota(eventos, retrato?.veiculos ?? [], dia, agora, ehHoje), ordem), [eventos, retrato, dia, agora, ehHoje, ordem]);
  const agoraMin = ehHoje && agora ? minutoDoDia(new Date(agora).toISOString(), dia) : null;
  const opcoesDias = dias.includes(dia) ? dias : [dia, ...dias];

  return (
    <div className="mx-auto w-full max-w-[1300px] space-y-3 px-3 pb-24 pt-4 md:px-6 md:pb-10 md:pt-6">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-borda bg-superficie p-3 shadow-sm">
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-40">
          {opcoesDias.map((d) => (
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
            { id: "mais", rotulo: "Mais tempo ligado" },
            { id: "menos", rotulo: "Menos tempo ligado" },
          ]}
        />
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave md:ml-auto">
          {(Object.keys(ESTADOS) as EstadoFaixa[]).map((e) => (
            <span key={e} className="flex items-center gap-1">
              <i className="inline-block h-2.5 w-2.5 rounded-sm border border-borda" style={ESTADOS[e].estilo} />
              {ESTADOS[e].rotulo}
            </span>
          ))}
          <span>· precisão de ~5 min · ligado = status do GAUSS (inclui andando)</span>
        </div>
      </div>
      {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
      {carregando ? (
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
            <span className="text-right">ligado no dia</span>
          </div>
          {grupos.map((g) => (
            <Grupo key={g.tipo} g={g} dia={dia} agoraMin={agoraMin} />
          ))}
        </div>
      )}
    </div>
  );
}

function Grupo({ g, dia, agoraMin }: { g: GrupoFrota; dia: string; agoraMin: number | null }) {
  return (
    <section>
      <h2 className="flex flex-wrap items-center gap-2 border-b border-borda bg-superficie-2 px-3 py-2 text-[13px]">
        <b>{TIPOS_EQUIP[g.tipo].rotulo}</b>
        <span className="text-suave">{g.linhas.length}</span>
        {agoraMin != null && (
          <>
            <Selo tom="ok">{g.agoraLigados} ligados agora</Selo>
            <Selo tom="bad">{g.agoraDesligados} desligados</Selo>
            {g.agoraSemSinal > 0 && <Selo tom="neu">{g.agoraSemSinal} sem sinal</Selo>}
          </>
        )}
        <span className="ml-auto text-suave">
          ligado no dia: <b className="text-texto">{fmtHoras(g.ligado_min)}</b>
        </span>
      </h2>
      {g.linhas.map((l) => (
        <Linha key={l.id} l={l} dia={dia} agoraMin={agoraMin} />
      ))}
    </section>
  );
}

function Linha({ l, dia, agoraMin }: { l: LinhaFrota; dia: string; agoraMin: number | null }) {
  const vaga = l.tipo === "as" ? "" : vagaCurta(l.vaga);
  const base = agoraMin ?? 1440;
  return (
    <Link href={`/timeline/?v=${encodeURIComponent(l.id)}&dia=${dia}`} className={`grid grid-cols-1 gap-1 border-b border-borda px-3 py-2 hover:bg-superficie-2 hover:no-underline md:items-center md:gap-3 ${COLUNAS}`}>
      <span className="truncate text-[13px] font-semibold text-texto">
        {l.nome}
        {vaga && <span className="ml-1.5 text-xs font-normal text-suave">{vaga}</span>}
      </span>
      <span className="relative block h-4 overflow-hidden rounded bg-superficie-2">
        {l.faixas.map((f, i) => (
          <span
            key={i}
            title={`${hmDoMinuto(f.de)}–${hmDoMinuto(f.ate)} · ${f.status || ESTADOS[f.estado].rotulo}${f.area ? ` · ${f.area}` : ""}`}
            className="absolute inset-y-0"
            style={{ left: pct(f.de), width: pct(f.ate - f.de), ...ESTADOS[f.estado].estilo }}
          />
        ))}
        {agoraMin != null && <span aria-hidden className="absolute inset-y-0 w-0.5" style={{ left: pct(agoraMin), background: "var(--texto)" }} />}
      </span>
      <span className="text-right text-xs tabular-nums text-suave">
        <b className="text-texto">{fmtHoras(l.ligado_min)}</b> ligado
        <span className="mt-0.5 block h-1 overflow-hidden rounded bg-superficie-2">
          <span className="block h-full" style={{ width: `${Math.min(100, (l.ligado_min / Math.max(base, 1)) * 100)}%`, background: corDoTom("ok") }} />
        </span>
      </span>
    </Link>
  );
}
