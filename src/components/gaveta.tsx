"use client";

import { useEffect, useRef, useState, type PointerEvent as EventoPonteiro, type ReactNode } from "react";
import { cx } from "./ui";

/**
 * Painel lateral (direita). `modal` bloqueia a página (editor); sem `modal` a página continua
 * utilizável ao lado. Esc e o × fecham; no modo modal, clicar fora também.
 * Com `ajustavel` (uma chave), a largura pode ser mudada arrastando a borda esquerda ou pelo botão
 * expandir/reduzir, e fica guardada neste navegador.
 */
const MINIMO = 380;
const lerLargura = (chave?: string): number | null => {
  if (!chave || typeof window === "undefined") return null;
  try {
    const v = Number(localStorage.getItem(`mon-gaveta:${chave}`));
    return v >= MINIMO ? Math.min(v, window.innerWidth - 16) : null;
  } catch {
    return null;
  }
};
const gravarLargura = (chave: string, v: number | null) => {
  try {
    if (v == null) localStorage.removeItem(`mon-gaveta:${chave}`);
    else localStorage.setItem(`mon-gaveta:${chave}`, String(Math.round(v)));
  } catch {
    // sem armazenamento: vale só nesta visita
  }
};
export function Gaveta({
  titulo,
  sub,
  fechar,
  children,
  rodape,
  modal = true,
  largura = "min(560px, 100vw)",
  rotulo,
  ajustavel,
}: {
  titulo: ReactNode;
  sub?: ReactNode;
  fechar: () => void;
  children: ReactNode;
  rodape?: ReactNode;
  modal?: boolean;
  largura?: string;
  /** nome acessível quando o título não é texto simples */
  rotulo?: string;
  /** chave para guardar a largura escolhida (ativa arrastar a borda e o botão expandir) */
  ajustavel?: string;
}) {
  const [px, setPx] = useState<number | null>(() => lerLargura(ajustavel));
  const antes = useRef<number | null>(null);
  const maximo = () => window.innerWidth - 16;
  const expandido = px != null && px >= maximo() - 4;
  const mudar = (v: number | null) => {
    setPx(v);
    if (ajustavel) gravarLargura(ajustavel, v);
  };
  const arrastar = (e: EventoPonteiro<HTMLDivElement>) => {
    e.preventDefault();
    const alvo = e.currentTarget;
    alvo.setPointerCapture(e.pointerId);
    const mover = (ev: PointerEvent) => setPx(Math.max(MINIMO, Math.min(maximo(), window.innerWidth - 8 - ev.clientX)));
    const soltar = (ev: PointerEvent) => {
      alvo.removeEventListener("pointermove", mover);
      alvo.removeEventListener("pointerup", soltar);
      mudar(Math.max(MINIMO, Math.min(maximo(), window.innerWidth - 8 - ev.clientX)));
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerup", soltar);
  };
  const ref = useRef<HTMLDialogElement>(null);
  const fecharRef = useRef(fechar);
  // ao desmontar (troca de conteúdo), o fechamento do diálogo antigo não deve fechar o novo
  const desmontando = useRef(false);
  useEffect(() => {
    fecharRef.current = fechar;
  });

  useEffect(() => {
    const d = ref.current!;
    desmontando.current = false;
    if (modal) d.showModal();
    else d.show();
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !modal && !e.defaultPrevented && !document.querySelector("dialog[open]:modal")) fecharRef.current();
    };
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("keydown", esc);
      desmontando.current = true;
      if (d.open) d.close();
    };
  }, [modal]);

  return (
    <dialog
      ref={ref}
      aria-label={rotulo ?? (typeof titulo === "string" ? titulo : undefined)}
      // no modo de desenvolvimento o React monta duas vezes: o "close" da 1ª montagem chega com o diálogo já reaberto
      onClose={() => !desmontando.current && !ref.current?.open && fecharRef.current()}
      onClick={(e) => modal && e.target === e.currentTarget && ref.current?.close()}
      style={{ width: px != null ? px : largura }}
      className={cx(
        // painel flutuante: afastado 8px das bordas, cantos arredondados e fundo desfocado
        "fixed inset-y-2 left-auto right-2 z-[1050] m-0 h-[calc(100dvh-16px)] max-h-none max-w-[calc(100vw-16px)] overflow-hidden rounded-2xl border border-borda bg-superficie p-0 text-texto shadow-2xl backdrop:bg-slate-950/30 backdrop:backdrop-blur-[2px]",
        !modal && "nao-imprimir",
      )}
    >
      {ajustavel && (
        // alça de arraste na borda esquerda (duplo clique volta ao tamanho padrão)
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Arraste para mudar a largura do painel"
          title="Arraste para aumentar ou diminuir · duplo clique volta ao tamanho padrão"
          onPointerDown={arrastar}
          onDoubleClick={() => mudar(null)}
          className="group absolute inset-y-0 left-0 z-20 flex w-3 cursor-ew-resize items-center justify-center"
        >
          <span className="h-14 w-1 rounded-full bg-borda-2 opacity-60 transition group-hover:bg-primaria group-hover:opacity-100" />
        </div>
      )}
      <div className="flex h-full flex-col">
        <header className="flex items-start gap-3 border-b border-borda bg-superficie px-5 py-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug">{titulo}</h2>
            {sub && <div className="mt-0.5 text-sm text-suave">{sub}</div>}
          </div>
          {ajustavel && (
            <button
              type="button"
              onClick={() => {
                if (expandido) mudar(antes.current);
                else {
                  antes.current = px;
                  mudar(maximo());
                }
              }}
              aria-label={expandido ? "Reduzir o painel" : "Expandir o painel"}
              title={expandido ? "Reduzir (volta ao tamanho anterior)" : "Expandir para quase a tela toda"}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-suave transition-colors hover:border-borda hover:bg-superficie-2 hover:text-texto"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d={expandido ? "M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7" : "M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"} />
              </svg>
            </button>
          )}
          <button
            type="button"
            onClick={() => ref.current?.close()}
            aria-label="Fechar"
            title="Fechar (Esc)"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-transparent text-suave transition-colors hover:border-borda hover:bg-superficie-2 hover:text-texto"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {rodape && <footer className="border-t border-borda bg-superficie-2/60 px-5 py-3">{rodape}</footer>}
      </div>
    </dialog>
  );
}
