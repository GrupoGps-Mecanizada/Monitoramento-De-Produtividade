"use client";

import Link from "next/link";
import { Campos } from "@/components/ui";
import type { ResumoLocal } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";

const Titulo = ({ children }: { children: string }) => <h3 className="mb-1 text-xs font-semibold uppercase tracking-wider text-suave">{children}</h3>;

/**
 * Detalhe da área na coluna da direita (no lugar da lista, sem cobrir o mapa): totais, quem atende (cada um abre a
 * Timeline do último dia lá), horário e apontamentos. Na linha "Fora da Usiminas", também os lugares de fora.
 */
export function DetalheLocal({ r, voltar }: { r: ResumoLocal; voltar: () => void }) {
  const pct = r.paradoComRegra ? Math.round((r.produtivo / r.paradoComRegra) * 100) : null;
  const maxHora = Math.max(1, ...r.porHora);
  return (
    <section aria-label={`Detalhe: ${r.local.nome}`} className="space-y-4">
      <div>
        <button type="button" onClick={voltar} className="text-xs font-semibold text-primaria hover:underline">
          ‹ Voltar para a lista
        </button>
        <h2 className="mt-1 text-lg font-semibold leading-tight">{r.local.nome}</h2>
        {!r.partes && <p className="text-xs text-suave">{`${r.local.categoria}${r.local.cerca ? "" : " · ponto sem cerca"}`}</p>}
      </div>
      <Campos
        itens={[
          ["Produtivo", fmtHoras(r.produtivo)],
          ["Parado ligado sem produzir", fmtHoras(r.semProduzir)],
          ...(r.base >= 1 ? ([["Motor ligado na base", fmtHoras(r.base)]] as [string, string][]) : []),
          ["Tempo parado", fmtHoras(r.parado)],
          ["Visitas", String(r.visitas)],
          ["% produtivo", pct == null ? "—" : `${pct}%`],
        ]}
      />
      <p className="text-[11px] text-suave">Hiper Vácuo, Ultravac, Brook e Aspiradores não têm regra de produtividade: entram só no tempo parado e nas visitas.</p>
      {r.partes && (
        <section>
          <Titulo>Lugares de fora</Titulo>
          <ul className="space-y-0.5 text-[13px]">
            {r.partes.map((x) => (
              <li key={x.nome} className="flex justify-between gap-2">
                <span className="truncate">{x.nome}</span>
                <span className="shrink-0 text-suave">{fmtHoras(x.parado)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <Titulo>Quem atende</Titulo>
        <ul aria-label="Quem atende" className="divide-y divide-borda rounded-lg border border-borda">
          {r.porEquip.map((e) => (
            <li key={e.id}>
              <Link href={`/timeline/?v=${encodeURIComponent(e.id)}&dia=${e.ultimoDia}`} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px] hover:bg-superficie-2 hover:no-underline">
                <b className="text-texto">{e.nome}</b>
                <span className="text-xs text-suave">
                  {e.visitas} {e.visitas === 1 ? "visita" : "visitas"} · {fmtHoras(e.min)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
      <section>
        <Titulo>Horário (início das paradas)</Titulo>
        <div role="img" aria-label="Tempo parado por hora do dia" className="flex h-16 items-end gap-px">
          {r.porHora.map((m, h) => (
            <span key={h} title={`${h}h: ${fmtHoras(m)}`} className="flex-1 rounded-t bg-primaria/70" style={{ height: `${(m / maxHora) * 100}%` }} />
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-suave">
          <span>0h</span>
          <span>6h</span>
          <span>12h</span>
          <span>18h</span>
          <span>24h</span>
        </div>
      </section>
      {r.apont.length > 0 && (
        <section>
          <Titulo>Apontamentos do tablet</Titulo>
          <ul className="space-y-0.5 text-[13px]">
            {r.apont.slice(0, 6).map((a) => (
              <li key={a.nome} className="flex justify-between gap-2">
                <span>{a.nome}</span>
                <span className="text-suave">{a.n}×</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
