"use client";

import { useState, type InputHTMLAttributes } from "react";
import type React from "react";
import { Entrada, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import type { Tom } from "@/lib/tipos";

export const TOM_DESTINO: Record<Destino, Tom> = { whatsapp: "bad", resumo: "warn", tela: "na" };
export const ROTULO_SITUACAO: Record<AlertaGravado["situacao"], string> = { aberto: "Aberto", visto: "Visto", resolvido: "Resolvido", silenciado: "Silenciado" };
export const TOM_SITUACAO: Record<AlertaGravado["situacao"], Tom> = { aberto: "bad", visto: "warn", resolvido: "ok", silenciado: "na" };

export const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");
export const erroTexto = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** A nota num quadrado com a cor do destino (o número sempre aparece: cor sozinha não informa). */
export function NotaSelo({ a, grande }: { a: Pick<AlertaGravado, "nota" | "destino">; grande?: boolean }) {
  const cor = corDoTom(TOM_DESTINO[a.destino]);
  return (
    <span
      className={cx("inline-grid shrink-0 place-items-center rounded-lg font-bold tabular-nums", grande ? "h-14 w-14 text-2xl" : "h-8 w-10 text-sm")}
      style={{ color: cor, background: `color-mix(in srgb, ${cor} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${cor} 35%, transparent)` }}
    >
      {a.nota}
    </span>
  );
}

/**
 * Campo de número que deixa digitar à vontade e só confere os limites ao sair do campo (ou Enter):
 * assim "20" num campo com mínimo 15 não vira "150" no meio da digitação.
 */
export function CampoNumero({
  valor,
  mudar,
  min = 0,
  max = 100,
  className,
  ...p
}: { valor: number; mudar: (n: number) => void; min?: number; max?: number } & Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "min" | "max">) {
  const [texto, setTexto] = useState<string | null>(null);
  const confirmar = () => {
    if (texto == null) return;
    const n = Math.round(Number(texto.replace(",", ".")));
    mudar(Number.isFinite(n) && texto.trim() !== "" ? Math.min(max, Math.max(min, n)) : valor);
    setTexto(null);
  };
  return (
    <Entrada
      {...p}
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      value={texto ?? String(valor)}
      onChange={(e) => setTexto(e.target.value)}
      onBlur={confirmar}
      onKeyDown={(e) => e.key === "Enter" && confirmar()}
      className={cx("w-20 tabular-nums", className)}
    />
  );
}

/** Abas de texto com sublinhado e contagem opcional (modelos 3 e 9 da galeria). */
export function AbasTexto<T extends string>({ abas, valor, mudar, rotulo, grande }: { abas: { id: T; rotulo: string; n?: number }[]; valor: T | null; mudar: (v: T) => void; rotulo: string; grande?: boolean }) {
  return (
    <div role="tablist" aria-label={rotulo} className={cx("flex flex-wrap gap-x-6 gap-y-1 border-b border-borda", grande ? "text-[15px]" : "text-sm")}>
      {abas.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === valor}
          onClick={() => mudar(a.id)}
          className={cx("-mb-px border-b-2 pb-2 pt-1 font-medium transition", a.id === valor ? "border-texto text-texto" : "border-transparent text-suave hover:text-texto")}
        >
          {a.rotulo}
          {a.n != null && <span className="ml-1.5 font-normal tabular-nums text-suave">{a.n}</span>}
        </button>
      ))}
    </div>
  );
}

/** Pílula de filtro ativo ("Supervisor: Junior ×") ou de ação ("+ Filtro"). */
export function Pilula({ children, tirar, onClick, tracejada, ativa, rotulo }: { children: React.ReactNode; tirar?: () => void; onClick?: () => void; tracejada?: boolean; ativa?: boolean; rotulo?: string }) {
  const cls = cx(
    "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-[13px] transition",
    ativa ? "border-transparent bg-primaria-suave text-texto" : "border-borda text-suave hover:text-texto",
    tracejada && "border-dashed",
  );
  if (tirar)
    return (
      <span className={cls}>
        {children}
        <button type="button" onClick={tirar} aria-label={rotulo ?? "Tirar filtro"} className="-mr-1 grid h-5 w-5 place-items-center rounded-full text-suave hover:bg-superficie-2 hover:text-texto">
          ×
        </button>
      </span>
    );
  return (
    <button type="button" onClick={onClick} className={cls} aria-label={rotulo}>
      {children}
    </button>
  );
}
