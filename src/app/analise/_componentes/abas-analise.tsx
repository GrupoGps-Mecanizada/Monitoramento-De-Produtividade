"use client";

import { Segmentado } from "@/components/ui";
import { useOpcao } from "@/lib/hooks";
import { Analise } from "./analise";
import { Disponibilidade } from "./disponibilidade/disponibilidade";

const ABAS = ["paradas", "disponibilidade"] as const;
type Aba = (typeof ABAS)[number];

/** Duas abas no topo da Análise: Paradas (o painel) e Disponibilidade (medição oficial). A escolha fica neste navegador. */
export function AbasAnalise() {
  const [aba, setAba] = useOpcao<Aba>("mon-analise-aba", ABAS, "paradas");
  return (
    <div className="altura-tela flex flex-col">
      <div className="px-2 pt-2">
        <div className="max-w-xs">
          <Segmentado rotulo="Análise" valor={aba} mudar={setAba} opcoes={[{ id: "paradas", rotulo: "Paradas" }, { id: "disponibilidade", rotulo: "Disponibilidade" }]} />
        </div>
      </div>
      {aba === "paradas" ? <Analise /> : <Disponibilidade />}
    </div>
  );
}
