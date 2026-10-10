import type { Placar } from "@/lib/dominio/analise";
import { fmtHoras } from "@/lib/dominio/formato";

function Numero({ rotulo, valor, nota }: { rotulo: string; valor: string; nota?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie px-3 py-2">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-suave">{rotulo}</dt>
      <dd className="text-2xl font-bold tabular-nums text-texto">{valor}</dd>
      {nota && <p className="text-[11px] text-suave">{nota}</p>}
    </div>
  );
}

/** Os 4 números do recorte (filtros do topo + tudo o que foi clicado), sempre exatos. */
export function PlacarAnalise({ p }: { p: Placar }) {
  return (
    <section aria-label="Placar">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        <Numero rotulo="Produtivo" valor={p.produtivo == null ? "—" : fmtHoras(p.produtivo)} nota={p.produtivo == null ? "sem regra de produtividade" : undefined} />
        <Numero rotulo="% produtivo" valor={p.pct == null ? "—" : `${Math.round(p.pct * 100)}%`} />
        <Numero rotulo="Parado" valor={fmtHoras(p.parado)} />
        <Numero rotulo="Serviços" valor={p.servicos.toLocaleString("pt-BR")} nota="paradas com apontamento" />
      </dl>
    </section>
  );
}
