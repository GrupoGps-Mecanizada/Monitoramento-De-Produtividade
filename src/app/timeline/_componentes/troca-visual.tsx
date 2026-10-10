"use client";

import { Segmentado } from "@/components/ui";
import { useOpcao } from "@/lib/hooks";

export const VISUAIS = ["nova", "classica"] as const;
export type Visual = (typeof VISUAIS)[number];

/** Qual Timeline a pessoa prefere (fica neste navegador): a nova (linha fina embaixo) ou a clássica (painel de trilhas embaixo). */
export const useVisualTimeline = () => useOpcao<Visual>("mon-timeline-visual", VISUAIS, "nova");

/** Troca entre a Timeline nova e a clássica. O filtro (cartão e funil) é o mesmo; muda só a parte de baixo. */
export function TrocaVisual() {
  const [visual, setVisual] = useVisualTimeline();
  return (
    <Segmentado
      rotulo="Visual da Timeline"
      valor={visual}
      mudar={setVisual}
      opcoes={[
        { id: "nova", rotulo: "Linha do dia (nova)" },
        { id: "classica", rotulo: "Trilhas (clássica)" },
      ]}
    />
  );
}
