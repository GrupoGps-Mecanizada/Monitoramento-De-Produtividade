"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { cx } from "@/components/ui";
import { Alertas } from "./alertas";
import { Excecoes } from "./excecoes";

type Aba = "excecoes" | "eventos";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "excecoes", rotulo: "Exceções do dia" },
  { id: "eventos", rotulo: "Eventos" },
];

/** Alertas em duas abas: as exceções às regras da frota (padrão) e os eventos do dia (entradas, saídas, status). */
export function AbasAlertas() {
  const params = useSearchParams();
  // link do sino com ?placa= abre direto nos eventos daquele equipamento
  const [aba, setAba] = useState<Aba>(() => (params.get("placa") ? "eventos" : "excecoes"));
  const topo = (
    <div role="tablist" aria-label="Alertas" className="flex w-fit gap-1 rounded-xl border border-borda bg-superficie p-1 shadow-sm">
      {ABAS.map((a) => (
        <button
          key={a.id}
          type="button"
          role="tab"
          aria-selected={a.id === aba}
          onClick={() => setAba(a.id)}
          className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", a.id === aba ? "bg-primaria text-white" : "text-suave hover:bg-superficie-2 hover:text-texto")}
        >
          {a.rotulo}
        </button>
      ))}
    </div>
  );
  return aba === "excecoes" ? <Excecoes topo={topo} /> : <Alertas topo={topo} />;
}
