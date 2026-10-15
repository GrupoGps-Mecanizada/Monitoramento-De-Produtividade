"use client";

import { useState, type InputHTMLAttributes } from "react";
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
