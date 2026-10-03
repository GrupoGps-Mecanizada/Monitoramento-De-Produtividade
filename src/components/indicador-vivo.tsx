"use client";

import { corDoTom } from "@/lib/cores";
import { useRetrato } from "@/lib/dados/use-retrato";
import { avisoLeitura, situacaoLeitura } from "@/lib/dominio/conexao";
import { useAgora } from "@/lib/hooks";
import { cx } from "./ui";

/** "atualizado 12:05:39 · a cada 5 min" na barra; no celular, só "12:05". */
export function IndicadorVivo({ curto = false }: { curto?: boolean }) {
  const { retrato, conectado } = useRetrato();
  const agora = useAgora();
  const s = situacaoLeitura(retrato, conectado, agora || undefined);
  return (
    <span
      title={[s.texto, s.detalhe].filter(Boolean).join("\n")}
      className="flex h-9 shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border border-white/[0.08] bg-white/[0.05] px-2.5 text-[12.5px] text-nav-suave"
    >
      <span aria-hidden className={cx("h-2 w-2 rounded-full", s.tom === "ok" && "animate-pulse")} style={{ background: corDoTom(s.tom) }} />
      <span className="tabular-nums">{curto ? s.curto : s.texto}</span>
      {!curto && retrato?.gauss && <span className="hidden border-l border-white/10 pl-2 text-[11px] font-semibold xl:inline">GAUSS: {retrato.gauss.requisicoes} req</span>}
    </span>
  );
}

/** Faixa amarela sob a barra quando o coletor falhou ou o acesso ao GAUSS está pausado. */
export function FaixaLeitura() {
  const { retrato } = useRetrato();
  const agora = useAgora();
  const texto = avisoLeitura(retrato, agora || undefined);
  return texto ? (
    <div role="alert" className="st-amarelo border-b border-borda px-4 py-2 text-[13px]">
      {texto}
    </div>
  ) : null;
}
