"use client";

import type { ReactNode } from "react";
import { Aviso, Vazio } from "@/components/ui";
import type { Carga, DetalheVaga as Detalhe } from "@/lib/dados/medicao";
import { conferencia, dataBr, dfDoDia, fmtDf, fmtH, horaEvento, motor2PorDia, placasDoCiclo, porMotivo, type Boletim, type VagaBoletim } from "@/lib/dominio/medicao";

function Bloco({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="rounded-lg border border-borda p-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-suave">{titulo}</h3>
      <div className="mt-1.5 text-[13px]">{children}</div>
    </section>
  );
}

/** Detalhe da vaga escolhida: DF por dia, por motivo, motor 2º, placas, conferência e os eventos. */
export function DetalheVaga({ vaga, boletim, detalhe }: { vaga: VagaBoletim | null; boletim: Boletim; detalhe: Carga<Detalhe> }) {
  if (!vaga) {
    return (
      <div className="rounded-xl border border-borda bg-superficie">
        <Vazio titulo="Escolha uma vaga">Clique numa vaga para ver os dias, os motivos e cada indisponibilidade.</Vazio>
      </div>
    );
  }
  const d = detalhe.dados;
  const dias = (d?.dias ?? []).map((x) => ({ ...x, df: dfDoDia(x) })).filter((x): x is typeof x & { df: number } => x.df != null);
  const menor = Math.min(100, ...dias.map((x) => x.df));
  // escala de base% a 100%: com DF perto de 100 todo dia, a barra cheia não mostraria diferença
  const base = Math.max(0, Math.min(80, Math.floor(menor / 10) * 10));
  const motor = d?.motor ? motor2PorDia(d.motor, boletim.inicio, boletim.fim) : null;
  const conf = d ? conferencia(d.eventos, vaga.horas_indisp) : null;
  const motivos = porMotivo(vaga);
  const maxMotivo = Math.max(0, ...motivos.map((m) => m.horas));

  return (
    <section aria-label={`Detalhe: ${vaga.vaga}`} className="flex flex-col gap-2 rounded-xl border border-borda bg-superficie p-3 lg:min-h-0 lg:overflow-y-auto">
      <h2 className="text-sm font-semibold">
        {vaga.vaga} <span className="font-normal text-suave">· DF {fmtDf(vaga.df)} · {fmtH(vaga.horas_indisp)} indisponível de {fmtH(vaga.horas_regime)}</span>
      </h2>
      {detalhe.erro && <Aviso tipo="erro">Não foi possível carregar o detalhe: {detalhe.erro}</Aviso>}
      {detalhe.carregando && <p className="text-xs text-suave">Carregando o detalhe…</p>}
      {d && (
        <>
          <Bloco titulo="DF por dia">
            {dias.length === 0 ? (
              <p className="text-suave">Sem dias neste boletim.</p>
            ) : (
              <>
                <ul className="flex h-24 items-end gap-0.5">
                  {dias.map((x) => (
                    <li key={x.dia} aria-label={`${dataBr(x.dia)}: ${fmtDf(x.df)}`} title={`${dataBr(x.dia)}: ${fmtDf(x.df)}`} className="flex h-full min-w-1 flex-1 items-end">
                      <span className="block w-full rounded-t bg-primaria" style={{ height: `${Math.max(3, ((x.df - base) / (100 - base)) * 100)}%` }} />
                    </li>
                  ))}
                </ul>
                <p className="mt-1 text-[11px] text-suave">
                  {dataBr(dias[0].dia)} a {dataBr(dias.at(-1)!.dia)} · escala de {base}% a 100%
                </p>
              </>
            )}
          </Bloco>
          <Bloco titulo="Por motivo">
            {motivos.length === 0 ? (
              <p className="text-suave">Sem indisponibilidade.</p>
            ) : (
              <ul className="grid gap-1">
                {motivos.map((m) => (
                  <li key={m.chave} className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-2">
                    <span className="truncate">{m.nome}</span>
                    <b className="tabular-nums">{fmtH(m.horas)}</b>
                    <span aria-hidden className="col-span-2 h-1.5 rounded-full bg-superficie-2">
                      <span className="block h-full rounded-full bg-primaria" style={{ width: `${maxMotivo > 0 ? Math.max(2, (m.horas / maxMotivo) * 100) : 0}%` }} />
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Bloco>
          <Bloco titulo="Motor secundário ligado">
            {!motor || motor.total === 0 ? (
              <p className="text-suave">Sem dado do motor nestes dias.</p>
            ) : (
              <>
                <p>
                  <b className="tabular-nums">{fmtH(motor.total)}</b> no ciclo
                </p>
                <p className="mt-0.5 text-[11px] text-suave">{motor.dias.map((x) => `${dataBr(x.dia)} ${fmtH(x.horas)}`).join(" · ")}</p>
              </>
            )}
          </Bloco>
          <Bloco titulo="Placas">
            <p>{placasDoCiclo(d.dias).join(", ") || "—"}</p>
          </Bloco>
          {conf && (
            <Bloco titulo="Conferência">
              <p>
                {conf.confere
                  ? `Eventos somam ${fmtH(conf.soma)}, igual ao boletim.`
                  : `Eventos somam ${fmtH(conf.soma)}, boletim diz ${fmtH(conf.total)}: diferença ${fmtH(Math.abs(conf.diferenca))}.`}
              </p>
            </Bloco>
          )}
          <Bloco titulo="Eventos">
            {d.eventos.length === 0 ? (
              <p className="text-suave">Nenhuma indisponibilidade.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-[12px]">
                  <thead className="sticky top-0 bg-superficie text-suave">
                    <tr>
                      <th className="py-1 pr-2 font-medium">Placa</th>
                      <th className="py-1 pr-2 font-medium">Início</th>
                      <th className="py-1 pr-2 font-medium">Fim</th>
                      <th className="py-1 pr-2 font-medium">Motivo</th>
                      <th className="py-1 text-right font-medium">Horas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {d.eventos.map((e) => (
                      <tr key={`${e.placa}|${e.inicio}|${e.tipo}`} className="border-t border-borda">
                        <td className="py-1 pr-2">{e.placa}</td>
                        <td className="py-1 pr-2 tabular-nums">{horaEvento(e.inicio)}</td>
                        <td className="py-1 pr-2 tabular-nums">{horaEvento(e.fim)}</td>
                        <td className="py-1 pr-2">{e.tipo}</td>
                        <td className="py-1 text-right tabular-nums">{fmtH(e.horas)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Bloco>
        </>
      )}
    </section>
  );
}
