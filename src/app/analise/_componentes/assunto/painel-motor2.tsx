"use client";

import { MOTOR2, frasesAssunto, lugaresPorPeso, numerosMotor2, paradasMotor2, pesoStatus, placasPorPeso, porHoraPeso } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { GraficoBarras } from "../grafico-barras";
import { GraficoHoras } from "../grafico-horas";
import { Frases } from "./frases";
import { Numeros, pct } from "./numeros";
import { itemLinha, type PropsAssunto } from "./painel-status";

const BOMBA = pesoStatus(MOTOR2);

/** Motor secundário (bomba do Alta Pressão): horas de bomba, % do tempo e a placa campeã; lugares, placas e hora pela bomba. */
export function PainelMotor2({ recorte, locais, sel, alternar, vazio }: PropsAssunto) {
  const todas = recorte();
  const n = numerosMotor2(todas);
  return (
    <div className="flex flex-col gap-2">
      <Numeros
        itens={[
          { rotulo: "Bomba ligada", valor: n.bomba > 0 ? fmtHoras(n.bomba) : "—" },
          { rotulo: "Do tempo parado", valor: pct(n.pct), sub: "com dado de motor" },
          { rotulo: "Placa campeã", valor: n.campea?.nome ?? "—", sub: n.campea ? fmtHoras(n.campea.min) : undefined },
        ]}
      />
      <Frases textos={frasesAssunto({ rotulo: "Bomba (motor 2º) ligada", paradas: paradasMotor2(todas), peso: BOMBA, locais })} vazio={vazio} />
      <GraficoBarras titulo="Lugares" sub="bomba ligada" itens={lugaresPorPeso(paradasMotor2(recorte("local")), locais, BOMBA).map(itemLinha)} selecionada={sel.local} escolher={(c) => alternar("local", c)} vazio={vazio} />
      <GraficoBarras titulo="Placas" sub="bomba ligada" itens={placasPorPeso(paradasMotor2(recorte("placa")), BOMBA).map(itemLinha)} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
      <GraficoHoras minutos={porHoraPeso(paradasMotor2(recorte("hora")), BOMBA)} selecionada={sel.hora} escolher={(h) => alternar("hora", h)} vazio={vazio} />
    </div>
  );
}
