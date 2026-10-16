"use client";

import Link from "next/link";
import { useMemo } from "react";
import { Aviso, Vazio } from "@/components/ui";
import { duplicados, legendaDoDia, montarDiaVagas, rotuloTrecho, textoSobre, type ConferenciaVaga, type LinhaMotorVaga, type LinhaVaga, type TrechoVaga } from "@/lib/dominio/dia-vaga";
import { fmtHoras } from "@/lib/dominio/formato";
import { vagaCurta } from "@/lib/dominio/veiculo";

const DIA = 86400;
const pct = (s: number) => `${(Math.min(DIA, Math.max(0, s)) / DIA) * 100}%`;
const HORAS = Array.from({ length: 24 }, (_, h) => h);
// colunas: vaga | timeline | totais (a timeline rola de lado no celular, a página não)
const COLUNAS = "grid-cols-[110px_minmax(720px,1fr)_120px] md:grid-cols-[230px_minmax(720px,1fr)_135px]";
// trecho com menos que isto (em % do dia) não leva o rótulo de horário dentro
const MIN_ROTULO = 4.5;

/**
 * Dia da frota por vaga: o espelho da "Timeline Tempo de Motor (Vaga)" do GAUSS. Uma linha por vaga, na mesma ordem,
 * com as mesmas cores e rótulos, e cada trecho com o caminhão que estava nele. Clicar no trecho abre a Timeline daquele
 * caminhão no dia.
 */
export function DiaVagas({ linhas, conferencias, dia, agoraSeg }: { linhas: LinhaMotorVaga[]; conferencias: ConferenciaVaga[]; dia: string; agoraSeg: number | null }) {
  const vagas = useMemo(() => montarDiaVagas(linhas, dia, agoraSeg, conferencias), [linhas, dia, agoraSeg, conferencias]);
  const dup = useMemo(() => duplicados(vagas), [vagas]);
  const divergentes = vagas.filter((v) => v.conferencia && !v.conferencia.ok);
  const semConferencia = vagas.filter((v) => !v.conferencia).length;

  if (!vagas.length) return <Vazio titulo="Sem timeline de motor neste dia">O coletor ainda não gravou nenhuma vaga.</Vazio>;
  return (
    <div className="space-y-3">
      <ul aria-label="Cores do GAUSS" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-suave">
        {legendaDoDia(vagas).map((e) => (
          <li key={e.cod} className="flex items-center gap-1">
            <i className="inline-block h-2.5 w-2.5 rounded-sm border border-borda" style={{ background: e.cor }} />
            {e.rotulo}
          </li>
        ))}
      </ul>
      {divergentes.length > 0 && (
        <Aviso tipo="erro">
          {divergentes.length} vaga(s) não batem com o que o GAUSS mandou na última busca: {divergentes.map((v) => vagaCurtaNome(v.nome)).join(", ")}. O coletor refaz o dia na próxima busca.
        </Aviso>
      )}
      {dup.length > 0 && (
        <Aviso tipo="alerta">
          No próprio GAUSS, caminhão apropriado em duas vagas ao mesmo tempo: {dup.map((d) => `${d.placa} (${d.vagas.map(vagaCurtaNome).join(" e ")}, ${fmtHoras(d.min)})`).join("; ")}. Corrija a
          apropriação no GAUSS.
        </Aviso>
      )}
      {semConferencia > 0 && <p className="text-xs text-suave">{semConferencia} vaga(s) ainda sem conferência com o GAUSS (o coletor novo ainda não buscou este dia).</p>}
      <div className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
        <div className="min-w-max">
          {vagas.map((v) => (
            <LinhaDaVaga key={v.vaga_id} v={v} dia={dia} agoraSeg={agoraSeg} />
          ))}
          <div className={`grid ${COLUNAS} border-t border-borda bg-superficie-2 text-[10px] tabular-nums text-suave`}>
            <span />
            <span className="relative h-5">
              {HORAS.map((h) => (
                <span key={h} className="absolute top-1 -translate-x-1/2" style={{ left: pct(h * 3600 + 1800) }}>
                  {String(h).padStart(2, "0")}
                </span>
              ))}
            </span>
            <span />
          </div>
        </div>
      </div>
    </div>
  );
}

const vagaCurtaNome = (nome: string) => {
  const curta = vagaCurta(nome);
  const tipo = /ALTA/i.test(nome) ? "AP" : /AUTO|ALTO/i.test(nome) ? "AV" : /HIPER/i.test(nome) ? "HV" : "";
  return tipo && curta ? `${tipo}-${curta.replace(/^vaga /, "").replace(" · 24h", "")}` : nome;
};

function LinhaDaVaga({ v, dia, agoraSeg }: { v: LinhaVaga; dia: string; agoraSeg: number | null }) {
  const conf = v.conferencia;
  return (
    <div className={`grid ${COLUNAS} items-center border-b border-borda text-[12px] last:border-b-0`}>
      <div className="sticky left-0 z-10 truncate bg-superficie px-2 py-1" title={v.nome}>
        <span className="font-semibold text-texto md:hidden">{vagaCurtaNome(v.nome)}</span>
        <span className="hidden font-semibold text-texto md:inline">{v.nome}</span>
        <span className="block truncate text-[10px] text-suave">{v.caminhoes.length ? v.caminhoes.map((c) => c.placa).join(" → ") : "sem caminhão apropriado"}</span>
      </div>
      <div className="relative h-7 bg-superficie-2">
        {HORAS.map((h) => (
          <span key={h} aria-hidden className="absolute inset-y-0 w-px bg-borda" style={{ left: pct(h * 3600) }} />
        ))}
        {v.trechos.map((t, i) => (
          <Trecho key={i} t={t} dia={dia} trocou={i > 0 && !!t.veiculo && !!v.trechos[i - 1].veiculo && v.trechos[i - 1].veiculo !== t.veiculo} />
        ))}
        {agoraSeg != null && <span aria-hidden className="absolute inset-y-0 w-0.5" style={{ left: pct(agoraSeg), background: "#2563eb" }} />}
      </div>
      <div className="px-2 text-right text-[11px] tabular-nums text-suave">
        <b className="text-texto">{fmtHoras(v.ligado_min)}</b> ligado
        {v.produtivo_min > 0 && <span className="block">{fmtHoras(v.produtivo_min)} produtivo</span>}
        <span
          className="block text-[10px]"
          title={
            conf
              ? conf.ok
                ? `Igual ao GAUSS na busca de ${new Date(conf.buscado_em).toLocaleString("pt-BR")}`
                : conf.diferencas.map((d) => `${d.cod}: banco ${d.banco} min, GAUSS ${d.gauss} min`).join("\n")
              : "Ainda sem conferência"
          }
        >
          {conf ? (conf.ok ? "✓ igual ao GAUSS" : "⚠ diferente do GAUSS") : "— sem conferência"}
        </span>
      </div>
    </div>
  );
}

function Trecho({ t, dia, trocou }: { t: TrechoVaga; dia: string; trocou: boolean }) {
  const largura = ((t.b - t.a) / DIA) * 100;
  const rotulo = rotuloTrecho(dia, t.a, t.b);
  const dica = `${rotulo}\n${t.rotulo}\n${t.placa ? `Caminhão: ${t.placa}` : "Sem caminhão apropriado"}\nDuração: ${fmtHoras((t.b - t.a) / 60)}`;
  const estilo = {
    left: pct(t.a),
    width: `max(${largura}%, 2px)`,
    background: t.cor,
    color: textoSobre(t.cor),
  };
  const conteudo = (
    <>
      {trocou && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-white" />}
      {largura >= MIN_ROTULO && <span className="block truncate px-1 text-[10px] font-semibold leading-7">{rotulo}</span>}
    </>
  );
  const classe = "absolute inset-y-0.5 overflow-hidden rounded-[2px] hover:z-10 hover:outline hover:outline-2 hover:outline-[var(--texto)]";
  return t.veiculo ? (
    <Link href={`/timeline/?v=${encodeURIComponent(t.veiculo)}&dia=${dia}`} title={dica} className={`${classe} hover:no-underline`} style={estilo}>
      {conteudo}
    </Link>
  ) : (
    <span title={dica} className={classe} style={estilo}>
      {conteudo}
    </span>
  );
}
