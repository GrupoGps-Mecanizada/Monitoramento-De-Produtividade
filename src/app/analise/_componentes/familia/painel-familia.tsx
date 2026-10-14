"use client";

import { Aviso } from "@/components/ui";
import type { DimensaoSelecao, Local, ParadaNoLocal, SelecaoCruzada } from "@/lib/dominio/analise";
import { SEM_SUPERVISOR, porApontamento, porDia, rankingPlacas, rankingSupervisores, type Familia, type LinhaRanking } from "@/lib/dominio/familias";
import { gradeHoraDia, lugaresPorPeso, pesoParado } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { Numeros } from "../assunto/numeros";
import { itemLinha } from "../assunto/painel-status";
import { corDaFamilia } from "../cores-analise";
import { GradeQuando } from "../grade-quando";
import { GraficoBarras, type ItemBarra } from "../grafico-barras";
import { GraficoDias } from "./grafico-dias";

const paradasTxt = (n: number) => `${n} ${n === 1 ? "parada" : "paradas"}`;
const itemRanking = (r: LinhaRanking, clicavel = true): ItemBarra => ({
  chave: r.chave,
  rotulo: r.nome,
  valor: r.min,
  texto: `${fmtHoras(r.min)} · ${r.n}× · méd. ${fmtHoras(r.media)}`,
  dica: `${r.nome}, ${fmtHoras(r.min)} em ${paradasTxt(r.n)}, média de ${fmtHoras(r.media)} por parada`,
  clicavel,
});

/** Coluna da direita com uma família escolhida, no molde das outras abas: números, por apontamento, quem mais para, lugares, quando para e tendência por dia. */
export function PainelFamilia({
  familia, recorte, recorteSupervisores, dias, hoje, locais, novos, sel, alternar, escolherQuando, supervisor, escolherSupervisor, vazio,
}: {
  familia: Familia;
  /** paradas da família com as escolhas feitas; `ignorar` pula uma dimensão (o gráfico dela mostra todas e marca a escolhida) */
  recorte: (ignorar?: DimensaoSelecao | DimensaoSelecao[]) => ParadaNoLocal[];
  /** o mesmo recorte sem o filtro de supervisor (o ranking mostra todos e marca o escolhido) */
  recorteSupervisores: () => ParadaNoLocal[];
  /** clique na grade: escolhe (ou desfaz) hora e dia da semana juntos */
  escolherQuando: (dia: number, hora: number) => void;
  dias: number;
  hoje: string;
  locais: Map<string, Local>;
  novos: string[];
  sel: SelecaoCruzada;
  alternar: (d: "servico" | "placa" | "local", v: string) => void;
  supervisor: string | null;
  escolherSupervisor: (s: string) => void;
  vazio: string;
}) {
  const todas = recorte();
  // os gráficos da família na cor dela
  const cor = corDaFamilia(familia);
  // números: horas e paradas da família e o que mais pesa (em "Sem apontamento", o lugar)
  const total = todas.reduce((n, p) => n + pesoParado(p), 0);
  const topo = familia === "sem" ? lugaresPorPeso(todas, locais, pesoParado, 1)[0] : porApontamento(todas, familia)[0];
  const apont: ItemBarra[] = porApontamento(recorte("servico"), familia).map((s) => ({
    chave: s.nome,
    rotulo: s.nome,
    valor: s.min,
    texto: fmtHoras(s.min),
    dica: `${s.nome}, ${fmtHoras(s.min)} em ${paradasTxt(s.n)}`,
  }));
  return (
    <div className="flex flex-col gap-2">
      {novos.length > 0 && <Aviso tipo="alerta">Apontamento novo sem família: {novos.join(", ")}</Aviso>}
      <Numeros
        itens={[
          { rotulo: "Horas paradas", valor: todas.length ? fmtHoras(total) : "—" },
          { rotulo: "Paradas", valor: todas.length ? todas.length.toLocaleString("pt-BR") : "—" },
          { rotulo: "Mais pesa", valor: topo?.nome ?? "—", sub: topo ? fmtHoras(topo.min) : undefined },
        ]}
      />
      {familia !== "sem" && <GraficoBarras titulo="Por apontamento" sub="horas paradas" itens={apont} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} cor={cor} />}
      <div className="grid gap-2 2xl:grid-cols-2">
        <GraficoBarras titulo="Placas" sub="quem mais para" itens={rankingPlacas(recorte("placa")).map((r) => itemRanking(r))} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} cor={cor} />
        <GraficoBarras titulo="Supervisores" sub="quem mais para" itens={rankingSupervisores(recorteSupervisores()).map((r) => itemRanking(r, r.chave !== SEM_SUPERVISOR))} selecionada={supervisor} escolher={escolherSupervisor} vazio={vazio} cor={cor} />
      </div>
      <GraficoBarras titulo="Lugares" sub="mais tempo parado" itens={lugaresPorPeso(recorte("local"), locais, pesoParado).map(itemLinha)} selecionada={sel.local} escolher={(c) => alternar("local", c)} vazio={vazio} cor={cor} />
      <GradeQuando grade={gradeHoraDia(recorte(["hora", "dia"]), pesoParado)} hora={sel.hora} dia={sel.dia} escolher={escolherQuando} vazio={vazio} cor={cor} />
      <GraficoDias dias={porDia(todas, hoje, dias)} vazio={vazio} cor={cor} />
    </div>
  );
}
