"use client";

import Link from "next/link";
import { Campos, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { rotuloRegra } from "@/lib/dominio/alertas/fila";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { diaMenos } from "@/lib/dominio/analise";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import { quando } from "./comum";

const hm = (s: number | null) => (s == null ? "" : fmtHora(s).slice(0, 5));

/** Por que não foi para o WhatsApp, em uma frase (sem pontos: pedido do dono, 19/10/2026). */
function porQueNao(a: AlertaGravado): string {
  const tablet = a.motivos.find((m) => m.texto.startsWith("Apontado no tablet"));
  if (tablet) return `Tinha apontamento no tablet${tablet.texto.match(/\(([^)]+)\)/)?.[1] ? ` (${tablet.texto.match(/\(([^)]+)\)/)![1]})` : ""}.`;
  if (a.motivos.some((m) => m.texto.startsWith("Rastreador sem sinal"))) return "O rastreador ficou sem sinal: pode não ser verdade.";
  if (a.motivos.length > 1 || a.nota > 0) return "Ainda não passou do tempo configurado para mandar.";
  return "Esta regra não manda no WhatsApp.";
}

/** Bolinha verde = envia; cinza = não envia. */
const Ponto = ({ vai }: { vai: boolean }) => <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: vai ? corDoTom("ok") : "var(--borda)" }} />;

/** Detalhe do alerta ao lado da lista: envia ou não (e por quê), dados, Timeline e os outros alertas da semana. Sem ações. */
export function DetalheAlerta({ a, todos, hoje, fechar, abrir }: { a: AlertaGravado; todos: AlertaGravado[]; hoje: string; fechar: () => void; abrir: (a: AlertaGravado) => void }) {
  const semana = todos.filter((x) => x.veiculo_id === a.veiculo_id && x.id !== a.id && x.dia >= diaMenos(hoje, 6)).sort((p, q) => q.dia.localeCompare(p.dia) || q.ini - p.ini);
  const vai = a.destino === "whatsapp";
  return (
    <aside aria-label={`${a.placa} · ${rotuloRegra(a.regra)}`} className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:border-l lg:border-borda lg:pl-6">
      <header className="flex items-start gap-3 pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">
            {a.placa} · {rotuloRegra(a.regra)}
          </h2>
          <p className="text-sm text-suave">
            {rotuloDia(a.dia, hoje)} {hm(a.ini)}
            {a.fim != null && `–${hm(a.fim)}`} · {a.detalhe}
          </p>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)" className="grid h-8 w-8 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto">
          ×
        </button>
      </header>
      <div className="space-y-6">
        <section aria-label="WhatsApp" className="flex items-start gap-3">
          <span className="mt-1.5">
            <Ponto vai={vai} />
          </span>
          <div>
            <p className={cx("font-semibold", !vai && "text-suave")}>{vai ? "Vai para o WhatsApp" : "Não vai para o WhatsApp"}</p>
            {!vai && <p className="text-sm text-suave">{porQueNao(a)}</p>}
          </div>
        </section>
        <section aria-label="Dados do alerta">
          <Campos
            itens={[
              ["Vaga", a.vaga || "—"],
              ["Supervisor", a.supervisor ?? "—"],
              ["Local", a.local ?? "—"],
              ["Visto pelo robô", `desde ${quando(a.detectado_em)}`],
            ]}
          />
          <Link href={`/timeline/?v=${encodeURIComponent(a.veiculo_id)}&dia=${a.dia}`} className="mt-3 inline-block text-sm font-semibold text-primaria">
            Ver na Timeline ›
          </Link>
        </section>
        <section aria-label="Outros alertas do equipamento" className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">Outros alertas de {a.placa} nos últimos 7 dias</p>
          {semana.length ? (
            <ul className="divide-y divide-borda/60 border-y border-borda/60">
              {semana.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => abrir(x)} className="flex w-full items-center gap-3 py-2 text-left text-[13px] hover:bg-superficie-2">
                    <Ponto vai={x.destino === "whatsapp"} />
                    <span className="min-w-0 flex-1 truncate">
                      {rotuloRegra(x.regra)} · {x.detalhe}
                    </span>
                    <span className="text-xs text-suave">
                      {rotuloDia(x.dia, hoje)} {hm(x.ini)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-suave">Nenhum outro alerta.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
