"use client";

import { useState } from "react";
import type { DimensaoSelecao, Local, ParadaNoLocal, SelecaoCruzada } from "@/lib/dominio/analise";
import { frasesAssunto, gradeHoraDia, lugaresPorPeso, numerosStatus, pesoParado, pesoStatus, placasPorStatus, rotuloStatus, somarStatus, type Linha } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { GraficoBarras, type ItemBarra } from "../grafico-barras";
import { BarrasStatus } from "../barras-status";
import { GradeQuando } from "../grade-quando";
import { Frases } from "./frases";
import { Numeros, pct } from "./numeros";

export interface PropsAssunto {
  /** paradas com as escolhas feitas; `ignorar` pula uma dimensão (o gráfico dela mostra todas e marca a escolhida) */
  recorte: (ignorar?: DimensaoSelecao | DimensaoSelecao[]) => ParadaNoLocal[];
  locais: Map<string, Local>;
  sel: SelecaoCruzada;
  alternar: (d: "local" | "placa" | "hora", v: string | number) => void;
  /** clique na grade: escolhe (ou desfaz) hora e dia da semana juntos */
  escolherQuando: (dia: number, hora: number) => void;
  vazio: string;
}
export const itemLinha = (l: Linha): ItemBarra => ({ chave: l.chave, rotulo: l.nome, valor: l.min, texto: fmtHoras(l.min), dica: `${l.nome}, ${fmtHoras(l.min)} em ${l.n} ${l.n === 1 ? "parada" : "paradas"}` });

/** Status do motor: horas paradas, % ligado e o status que mais pesa; clicar num status faz placas, lugares e hora pesarem só ele. */
export function PainelStatus({ recorte, locais, sel, alternar, escolherQuando, vazio }: PropsAssunto) {
  const [escolhido, setStatus] = useState<string | null>(null);
  const todas = recorte();
  const n = numerosStatus(todas);
  const somas = somarStatus(todas);
  // o status escolhido que some com um filtro deixa de valer (senão ficaria preso, sem barra para desmarcar)
  const status = escolhido && somas.some((s) => s.cod === escolhido) ? escolhido : null;
  const peso = status ? pesoStatus(status) : pesoParado;
  const rotulo = status ? rotuloStatus(status) : "Tempo parado";
  const porStatus: ItemBarra[] = somas.map((s) => ({ chave: s.cod, rotulo: s.rotulo, valor: s.min, texto: fmtHoras(s.min), dica: `${s.rotulo}, ${fmtHoras(s.min)}` }));
  return (
    <div className="flex flex-col gap-2">
      <Numeros
        itens={[
          { rotulo: "Horas paradas", valor: fmtHoras(n.parado) },
          { rotulo: "Motor ligado", valor: pct(n.ligadoPct), sub: "do tempo com dado de motor" },
          { rotulo: "Mais pesa", valor: n.maior?.rotulo ?? "—", sub: n.maior ? fmtHoras(n.maior.min) : undefined },
        ]}
      />
      <Frases textos={frasesAssunto({ rotulo, paradas: todas, peso, locais })} vazio={vazio} />
      <GraficoBarras titulo="Por status" sub="horas de cada status do GAUSS nas paradas" itens={porStatus} selecionada={status} escolher={(c) => setStatus((s) => (s === c ? null : c))} vazio={vazio} />
      <BarrasStatus linhas={placasPorStatus(recorte("placa"), status ?? "stopped")} destaque={status ?? "stopped"} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
      <GraficoBarras titulo="Lugares" sub={rotulo.toLowerCase()} itens={lugaresPorPeso(recorte("local"), locais, peso).map(itemLinha)} selecionada={sel.local} escolher={(c) => alternar("local", c)} vazio={vazio} />
      <GradeQuando grade={gradeHoraDia(recorte(["hora", "dia"]), peso)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} />
    </div>
  );
}
