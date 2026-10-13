"use client";

import { Segmentado } from "@/components/ui";
import { PERIODOS, type Periodo } from "@/lib/dominio/analise";
import { useOpcao } from "@/lib/hooks";
import { Analise } from "./analise";
import { Disponibilidade } from "./disponibilidade/disponibilidade";

const ABAS = ["paradas", "disponibilidade"] as const;
type Aba = (typeof ABAS)[number];

/**
 * Abas da Análise: Paradas (o painel) e Disponibilidade (medição oficial) e, ao lado, o período (7, 15 ou 30 dias; só em Paradas,
 * a Disponibilidade segue o período do boletim oficial). Abas e período entram na linha de filtros da aba aberta: uma linha só.
 * As escolhas ficam neste navegador.
 */
export function AbasAnalise() {
  const [aba, setAba] = useOpcao<Aba>("mon-analise-aba", ABAS, "paradas");
  const [periodo, setPeriodo] = useOpcao<Periodo>("mon-analise-periodo", PERIODOS, "30");
  const topo = (
    <>
      <div className="w-[260px]">
        <Segmentado rotulo="Análise" valor={aba} mudar={setAba} opcoes={[{ id: "paradas", rotulo: "Paradas" }, { id: "disponibilidade", rotulo: "Disponibilidade" }]} />
      </div>
      {aba === "paradas" && (
        <div className="w-[240px]">
          <Segmentado<Periodo> rotulo="Período" valor={periodo} mudar={setPeriodo} opcoes={PERIODOS.map((p) => ({ id: p, rotulo: <span className="whitespace-nowrap">{p} dias</span> }))} />
        </div>
      )}
    </>
  );
  return <div className="altura-tela flex flex-col">{aba === "paradas" ? <Analise periodo={periodo} topo={topo} /> : <Disponibilidade topo={topo} />}</div>;
}
