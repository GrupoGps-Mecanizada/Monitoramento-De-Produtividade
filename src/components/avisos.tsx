"use client";

import { useSyncExternalStore } from "react";

/** Avisos rápidos no canto da tela (confirmação de ação, com botão opcional como "Abrir" ou "Desfazer"). */
export type TipoAviso = "ok" | "info" | "erro";
interface Aviso {
  id: number;
  texto: string;
  tipo: TipoAviso;
  acao?: { rotulo: string; executar: () => void };
}

let lista: Aviso[] = [];
let seq = 0;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};
const remover = (id: number) => {
  lista = lista.filter((a) => a.id !== id);
  emitir();
};

export function avisar(texto: string, opcoes: { tipo?: TipoAviso; acao?: Aviso["acao"]; ms?: number } = {}) {
  const id = ++seq;
  lista = [...lista.slice(-2), { id, texto, tipo: opcoes.tipo ?? "ok", acao: opcoes.acao }];
  emitir();
  setTimeout(() => remover(id), opcoes.ms ?? (opcoes.acao ? 6500 : 3800));
}

const PONTO: Record<TipoAviso, string> = { ok: "var(--ok-dot)", info: "var(--reg-dot)", erro: "var(--bad-dot)" };

/** Montado uma vez no layout. */
export function Avisos() {
  const itens = useSyncExternalStore(assinar, () => lista, () => lista);
  if (!itens.length) return null;
  return (
    <div className="pointer-events-none fixed bottom-20 right-4 z-[70] flex flex-col items-end gap-2 md:bottom-5 md:right-5" role="status" aria-live="polite">
      {itens.map((a) => (
        <div key={a.id} className="pointer-events-auto flex min-w-72 max-w-[420px] items-center gap-3 rounded-lg bg-texto py-3 pl-3.5 pr-3 text-[13px] text-fundo shadow-2xl">
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: PONTO[a.tipo] }} aria-hidden />
          <span className="flex-1">{a.texto}</span>
          {a.acao && (
            <button
              type="button"
              onClick={() => {
                remover(a.id);
                a.acao!.executar();
              }}
              className="h-7 rounded bg-white/20 px-2.5 text-xs font-bold hover:bg-white/30"
            >
              {a.acao.rotulo}
            </button>
          )}
          <button type="button" onClick={() => remover(a.id)} aria-label="Fechar aviso" className="px-1 text-base opacity-60 hover:opacity-100">
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
