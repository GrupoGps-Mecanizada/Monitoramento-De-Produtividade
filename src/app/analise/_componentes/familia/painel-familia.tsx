"use client";

import { Aviso } from "@/components/ui";
import type { DimensaoSelecao, Local, ParadaNoLocal, SelecaoCruzada } from "@/lib/dominio/analise";
import { ROTULO_FAMILIA, SEM_SUPERVISOR, frases, porApontamento, porDia, rankingPlacas, rankingSupervisores, type Familia, type LinhaRanking } from "@/lib/dominio/familias";
import { fmtHoras } from "@/lib/dominio/formato";
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

/** Coluna da direita com uma família escolhida: frases, por apontamento, quem mais para (placas e supervisores) e tendência por dia. */
export function PainelFamilia({
  familia, recorte, anterior, dias, hoje, locais, novos, sel, alternar, supervisor, escolherSupervisor, vazio,
}: {
  familia: Familia;
  /** paradas da família com as escolhas feitas; `ignorar` pula uma dimensão (o gráfico dela mostra todas e marca a escolhida) */
  recorte: (ignorar?: DimensaoSelecao) => ParadaNoLocal[];
  /** mesmo recorte no período anterior; null = não existe (30 dias) */
  anterior: ParadaNoLocal[] | null;
  dias: number;
  hoje: string;
  locais: Map<string, Local>;
  novos: string[];
  sel: SelecaoCruzada;
  alternar: (d: "servico" | "placa", v: string) => void;
  supervisor: string | null;
  escolherSupervisor: (s: string) => void;
  vazio: string;
}) {
  const todas = recorte();
  const textos = frases({ rotulo: ROTULO_FAMILIA[familia], atual: todas, anterior, dias, locais });
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
      <section aria-label="O que os dados dizem" className="rounded-xl border border-borda bg-superficie p-3">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">O que os dados dizem</h2>
        {textos.length === 0 ? (
          <p className="mt-2 text-xs text-suave">{vazio}</p>
        ) : (
          <ul aria-label="Frases automáticas" className="mt-2 grid gap-1 text-[13px] text-texto">
            {textos.map((t) => (
              <li key={t} className="flex gap-1.5">
                <span aria-hidden className="text-primaria">•</span>
                {t}
              </li>
            ))}
          </ul>
        )}
      </section>
      {familia !== "sem" && <GraficoBarras titulo="Por apontamento" sub="horas paradas" itens={apont} selecionada={sel.servico} escolher={(n) => alternar("servico", n)} vazio={vazio} />}
      <div className="grid gap-2 2xl:grid-cols-2">
        <GraficoBarras titulo="Placas" sub="quem mais para" itens={rankingPlacas(recorte("placa")).map((r) => itemRanking(r))} selecionada={sel.placa} escolher={(c) => alternar("placa", c)} vazio={vazio} />
        <GraficoBarras titulo="Supervisores" sub="quem mais para" itens={rankingSupervisores(todas).map((r) => itemRanking(r, r.chave !== SEM_SUPERVISOR))} selecionada={supervisor} escolher={escolherSupervisor} vazio={vazio} />
      </div>
      <GraficoDias dias={porDia(todas, hoje, dias)} vazio={vazio} />
    </div>
  );
}
