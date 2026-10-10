"use client";

import dynamic from "next/dynamic";

/**
 * A planilha (Univer) só é baixada quando alguém abre o modo planilha: não pesa na abertura das telas.
 * Use esta em vez de importar "./planilha-excel" direto.
 */
export const PlanilhaExcel = dynamic(() => import("./planilha-excel").then((m) => m.PlanilhaExcel), {
  ssr: false,
  loading: () => <div className="grid flex-1 place-items-center rounded-xl border border-borda bg-superficie p-10 text-sm text-suave shadow-sm">Abrindo planilha…</div>,
}) as unknown as typeof import("./planilha-excel").PlanilhaExcel;
export type { ColunaPlanilha, ControlePlanilha, ValorCelula } from "./planilha-excel";

let precarregada = false;
/**
 * Baixa a planilha (componente + Univer) em segundo plano, antes de ela aparecer. Chamar ao abrir uma tela
 * que vai mostrar a planilha (junto com os dados) ou quando o navegador estiver ocioso.
 */
export function precarregarPlanilha() {
  if (precarregada || typeof window === "undefined") return;
  precarregada = true;
  void import("./planilha-excel")
    .then((m) => m.carregarUniver())
    .catch(() => (precarregada = false));
}
