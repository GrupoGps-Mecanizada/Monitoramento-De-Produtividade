import { Fragment, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import { CLASSE_TOM, corDoTom } from "@/lib/cores";
import type { Tom } from "@/lib/tipos";

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(" ");

export function Botao({
  variante = "primaria",
  tamanho = "normal",
  className,
  ...p
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: "primaria" | "secundaria" | "discreta"; tamanho?: "normal" | "mini" }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg font-medium transition disabled:cursor-not-allowed disabled:opacity-50",
        tamanho === "mini" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-sm",
        variante === "primaria" && "bg-primaria text-primaria-texto shadow-sm hover:brightness-110",
        variante === "secundaria" && "border border-borda bg-superficie text-texto shadow-sm hover:bg-superficie-2",
        variante === "discreta" && "text-link hover:bg-superficie-2",
        className,
      )}
    />
  );
}

const campo = "h-9 min-w-0 rounded-lg border border-borda bg-superficie px-3 text-sm text-texto focus:border-primaria";
export const Entrada = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cx(campo, className)} />;
export const Selecao = ({ className, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => <select {...p} className={cx(campo, "pr-8", className)} />;

export function Aviso({ tipo = "info", children }: { tipo?: "info" | "alerta" | "erro" | "ok"; children: ReactNode }) {
  return (
    <div
      role={tipo === "erro" ? "alert" : "status"}
      className={cx("rounded-lg px-3.5 py-2.5 text-sm", tipo === "info" && "st-cinza-azulado", tipo === "alerta" && "st-amarelo", tipo === "erro" && "st-vermelho", tipo === "ok" && "st-verde")}
    >
      {children}
    </div>
  );
}

/** Ponto de cor de um tom (sempre acompanhado de rótulo: cor sozinha não informa). */
export function Ponto({ tom, className }: { tom: Tom; className?: string }) {
  return <span aria-hidden className={cx("inline-block h-2 w-2 shrink-0 rounded-full", className)} style={{ background: corDoTom(tom) }} />;
}

export function Selo({ tom, children, className }: { tom: Tom; children: ReactNode; className?: string }) {
  return (
    <span className={cx("inline-flex items-center gap-1.5 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold", CLASSE_TOM[tom], className)}>
      <Ponto tom={tom} />
      {children}
    </span>
  );
}

export function Contador({ n }: { n: number }) {
  return <span className="rounded-full bg-superficie-2 px-1.5 text-[11px] font-semibold tabular-nums text-suave ring-1 ring-borda">{n}</span>;
}

export function Chip({ ativo, onClick, children, tom }: { ativo: boolean; onClick: () => void; children: ReactNode; tom?: Tom }) {
  return (
    <button
      type="button"
      aria-pressed={ativo}
      onClick={onClick}
      className={cx(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium transition",
        ativo ? "border-primaria/40 bg-primaria-suave text-texto" : "border-borda bg-superficie text-suave hover:text-texto",
      )}
    >
      {tom && <Ponto tom={tom} />}
      {children}
    </button>
  );
}

/** Abas em trilho (Veículos · Áreas · Eventos). */
export function Segmentado<T extends string>({ opcoes, valor, mudar, rotulo }: { opcoes: { id: T; rotulo: ReactNode }[]; valor: T; mudar: (v: T) => void; rotulo: string }) {
  return (
    <div role="tablist" aria-label={rotulo} className="flex rounded-lg bg-superficie-2 p-1 ring-1 ring-borda">
      {opcoes.map((o) => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={o.id === valor}
          onClick={() => mudar(o.id)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition",
            o.id === valor ? "bg-superficie text-texto shadow-sm" : "text-suave hover:text-texto",
          )}
        >
          {o.rotulo}
        </button>
      ))}
    </div>
  );
}

/** Estado vazio com explicação (textos que se explicam sozinhos). */
export function Vazio({ titulo, children }: { titulo: string; children?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      <p className="font-semibold">{titulo}</p>
      {children && <div className="mx-auto mt-1 max-w-sm text-sm text-suave">{children}</div>}
    </div>
  );
}

/** Lista "rótulo: valor" (detalhe do veículo, resumo do dia, detalhe do alerta). */
export function Campos({ itens }: { itens: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-2 text-[13px]">
      {itens.map(([k, v]) => (
        <Fragment key={k}>
          <dt className="text-suave">{k}</dt>
          <dd className="min-w-0 break-words">{v}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export function SecaoTitulo({ children, acao }: { children: ReactNode; acao?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">{children}</p>
      {acao}
    </div>
  );
}
