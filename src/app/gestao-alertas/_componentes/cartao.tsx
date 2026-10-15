"use client";

import type { ReactNode } from "react";
import { Selo } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import type { Tom } from "@/lib/tipos";

export const TOM_DESTINO: Record<Destino, Tom> = { whatsapp: "bad", resumo: "warn", tela: "na" };
export const ROTULO_DESTINO: Record<Destino, string> = { whatsapp: "WhatsApp", resumo: "Resumo diário", tela: "Só na tela" };
const ROTULO_SITUACAO = { aberto: "Aberto", visto: "Visto", resolvido: "Resolvido", silenciado: "Silenciado" } as const;
const TOM_SITUACAO: Record<keyof typeof ROTULO_SITUACAO, Tom> = { aberto: "bad", visto: "warn", resolvido: "ok", silenciado: "na" };

export function CartaoAlerta({ a, hoje, acoes }: { a: AlertaGravado; hoje: string; acoes?: ReactNode }) {
  return (
    <li className="grid gap-x-4 gap-y-2 border-b border-borda px-4 py-3 text-[13px] last:border-b-0 md:grid-cols-[56px_1fr_auto]">
      <span className="text-2xl font-bold tabular-nums leading-none" style={{ color: corDoTom(TOM_DESTINO[a.destino]) }} title={`Nota ${a.nota}: ${ROTULO_DESTINO[a.destino]}`}>
        {a.nota}
      </span>
      <div className="min-w-0 space-y-1">
        <p>
          <b>{a.placa}</b> · {ROTULO_REGRA[a.regra as RegraExcecao] ?? a.regra} · {a.detalhe}
        </p>
        <p className="text-xs text-suave">
          {rotuloDia(a.dia, hoje)} {fmtHora(a.ini).slice(0, 5)}
          {a.local && ` · ${a.local}`} · supervisor: {a.supervisor ?? "—"}
          {a.visto_por && ` · visto por ${a.visto_por}`}
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <Selo tom={TOM_SITUACAO[a.situacao]}>{ROTULO_SITUACAO[a.situacao]}</Selo>
          <Selo tom={TOM_DESTINO[a.destino]}>{ROTULO_DESTINO[a.destino]}</Selo>
          {a.avaliacao && <Selo tom="neu">{a.avaliacao === "problema" ? "Era problema" : "Não era problema"}</Selo>}
        </div>
        <details className="text-xs">
          <summary className="cursor-pointer text-link">Por que essa nota?</summary>
          <ul className="mt-1 space-y-0.5">
            {a.motivos.map((m) => (
              <li key={m.texto} className="tabular-nums">
                <b>
                  {m.pontos > 0 ? "+" : ""}
                  {m.pontos}
                </b>{" "}
                {m.texto}
              </li>
            ))}
          </ul>
        </details>
      </div>
      {acoes && <div className="flex flex-wrap items-start gap-1.5 md:justify-end">{acoes}</div>}
    </li>
  );
}
