"use client";

import { cx } from "@/components/ui";

/** Uma barra: `dica` é o nome falado e o texto ao passar o mouse; `marca` é a bolinha com a cor do serviço no mapa. */
export interface ItemBarra {
  chave: string;
  rotulo: string;
  valor: number;
  texto: string;
  dica: string;
  marca?: string;
  clicavel?: boolean;
}

/** Barras horizontais com o número escrito ao lado. Clicar escolhe (ou desfaz); com uma escolhida, as outras ficam apagadas. */
export function GraficoBarras({ titulo, sub, itens, selecionada, escolher, vazio }: { titulo: string; sub: string; itens: ItemBarra[]; selecionada: string | null; escolher: (chave: string) => void; vazio: string }) {
  const max = Math.max(0, ...itens.map((i) => i.valor));
  return (
    <section aria-label={titulo} className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        {titulo} <span className="font-normal normal-case tracking-normal">· {sub}</span>
      </h2>
      {itens.length === 0 ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <ul className="mt-2 grid gap-1">
          {itens.map((i) => (
            <li key={i.chave}>
              <button
                type="button"
                disabled={i.clicavel === false}
                aria-pressed={selecionada === i.chave}
                aria-label={i.dica}
                title={i.dica}
                onClick={() => escolher(i.chave)}
                className={cx(
                  "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2 rounded-md px-1.5 py-1 text-left text-[13px] transition hover:bg-superficie-2 disabled:cursor-default disabled:hover:bg-transparent",
                  selecionada != null && selecionada !== i.chave && "opacity-40",
                  selecionada === i.chave && "bg-primaria-suave",
                )}
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  {i.marca && <i aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: i.marca }} />}
                  <span className="truncate">{i.rotulo}</span>
                </span>
                <b className="tabular-nums text-texto">{i.texto}</b>
                <span aria-hidden className="col-span-2 mt-0.5 h-1.5 rounded-full bg-superficie-2">
                  <span className="block h-full rounded-full bg-primaria" style={{ width: `${max > 0 ? Math.max(2, (i.valor / max) * 100) : 0}%` }} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
