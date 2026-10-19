"use client";

import Link from "next/link";
import { cx } from "@/components/ui";
import { legendaDoDia, rotuloTrecho, textoSobre, type LinhaVaga, type TrechoVaga } from "@/lib/dominio/dia-vaga";
import { fmtHoras } from "@/lib/dominio/formato";
import { vagaCurta } from "@/lib/dominio/veiculo";

const DIA = 86400;
const pct = (s: number) => `${(Math.min(DIA, Math.max(0, s)) / DIA) * 100}%`;
const HORAS = Array.from({ length: 24 }, (_, h) => h);
// colunas: vaga | timeline | totais (a timeline rola de lado no celular, a página não)
const COLUNAS = "grid-cols-[110px_minmax(720px,1fr)_120px] md:grid-cols-[230px_minmax(720px,1fr)_135px]";
// trecho com menos que isto (em % do dia) não leva o rótulo de horário dentro
const MIN_ROTULO = 4.5;

/** "AP-01", "AV-07", "HV-03" a partir do nome do GAUSS. */
export const vagaCurtaNome = (nome: string) => {
  const curta = vagaCurta(nome);
  const tipo = /ALTA/i.test(nome) ? "AP" : /AUTO|ALTO/i.test(nome) ? "AV" : /HIPER/i.test(nome) ? "HV" : "";
  return tipo && curta ? `${tipo}-${curta.replace(/^vaga /, "").replace(" · 24h", "")}` : nome;
};

/** Cores do GAUSS (e qualquer status novo que ele mandou), em linha. */
export function LegendaGauss({ vagas }: { vagas: LinhaVaga[] }) {
  return (
    <ul aria-label="Cores do GAUSS" className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-suave">
      {legendaDoDia(vagas).map((e) => (
        <li key={e.cod} className="flex items-center gap-1.5">
          <i className="inline-block h-2.5 w-2.5 rounded-sm border border-borda" style={{ background: e.cor }} />
          {e.rotulo}
        </li>
      ))}
    </ul>
  );
}

/**
 * Timeline por vaga: o espelho da "Timeline Tempo de Motor (Vaga)" do GAUSS. Uma linha por vaga, na mesma ordem, com as
 * mesmas cores e rótulos, e cada trecho com o caminhão que estava nele. Clicar no nome da vaga abre os trechos dela;
 * clicar no trecho abre a Timeline do caminhão no dia.
 */
export function DiaVagas({ vagas, dia, agoraSeg, escolhida, escolher }: { vagas: LinhaVaga[]; dia: string; agoraSeg: number | null; escolhida: string | null; escolher: (id: string) => void }) {
  return (
    <div className="overflow-x-auto border-y border-borda">
      <div className="min-w-max">
        {vagas.map((v) => (
          <LinhaDaVaga key={v.vaga_id} v={v} dia={dia} agoraSeg={agoraSeg} ativa={v.vaga_id === escolhida} escolher={escolher} />
        ))}
        <div className={`grid ${COLUNAS} text-[10px] tabular-nums text-suave`}>
          <span />
          <span className="relative h-6">
            {HORAS.map((h) => (
              <span key={h} className="absolute top-1.5 -translate-x-1/2" style={{ left: pct(h * 3600 + 1800) }}>
                {String(h).padStart(2, "0")}
              </span>
            ))}
          </span>
          <span />
        </div>
      </div>
    </div>
  );
}

function LinhaDaVaga({ v, dia, agoraSeg, ativa, escolher }: { v: LinhaVaga; dia: string; agoraSeg: number | null; ativa: boolean; escolher: (id: string) => void }) {
  const conf = v.conferencia;
  return (
    <div className={cx("grid items-center border-b border-borda/60 text-[12px]", COLUNAS, ativa && "bg-primaria-suave")}>
      <button type="button" onClick={() => escolher(v.vaga_id)} className={cx("sticky left-0 z-10 truncate px-2 py-1.5 text-left hover:text-texto", ativa ? "bg-primaria-suave" : "bg-superficie")} title={v.nome}>
        <span className="font-semibold text-texto md:hidden">{vagaCurtaNome(v.nome)}</span>
        <span className="hidden font-semibold text-texto md:inline">{v.nome}</span>
        <span className="block truncate text-[10px] text-suave">{v.caminhoes.length ? v.caminhoes.map((c) => c.placa).join(" → ") : "sem caminhão apropriado"}</span>
      </button>
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
  const estilo = { left: pct(t.a), width: `max(${largura}%, 2px)`, background: t.cor, color: textoSobre(t.cor) };
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

/** Os trechos da vaga escolhida numa tabela sem grade (como a lista da Gestão de alertas). */
export function TrechosDaVaga({ v, dia }: { v: LinhaVaga; dia: string }) {
  const hm = (s: number) => rotuloTrecho(dia, s, s).slice(6, 11);
  return (
    <section aria-label={`Trechos da ${v.nome}`} className="space-y-3">
      <h2 className="text-[15px] font-semibold">
        {v.nome} <span className="font-normal text-suave">· {v.trechos.length} trechos</span>
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
            <tr className="border-b border-borda">
              <th className="px-3 py-2 font-medium">Início</th>
              <th className="px-3 py-2 font-medium">Fim</th>
              <th className="px-3 py-2 font-medium">Duração</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 font-medium">Caminhão</th>
            </tr>
          </thead>
          <tbody>
            {v.trechos.map((t, i) => (
              <tr key={i} className="border-b border-borda/60">
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{hm(t.a)}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums">{hm(t.b)}</td>
                <td className="whitespace-nowrap px-3 py-2 tabular-nums text-suave">{fmtHoras((t.b - t.a) / 60)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <span aria-hidden className="h-2 w-2 rounded-sm border border-borda" style={{ background: t.cor }} />
                    {t.rotulo}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {t.veiculo ? (
                    <Link href={`/timeline/?v=${encodeURIComponent(t.veiculo)}&dia=${dia}`} className="font-medium">
                      {t.placa ?? t.veiculo}
                    </Link>
                  ) : (
                    <span className="text-suave">—</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
