"use client";

import { useMemo } from "react";
import { corDoTom } from "@/lib/cores";
import type { HistoriaDia } from "@/lib/dominio/capitulos";
import { fmtHora, fmtMin } from "@/lib/dominio/formato";
import { blocoEm, capitulosComGauss, statusGauss, totaisGauss, type ApontamentoTablet, type GaussDia } from "@/lib/dominio/gauss-dia";
import { itensResumo, type ItemResumo } from "@/lib/dominio/historico";
import { baseDosTrechos, dividirProdutivo } from "@/lib/dominio/produtividade";
import { DIA, posBloco, segDaFracao, type Janela } from "@/lib/dominio/trilhas";
import type { Historico } from "@/lib/tipos";
import { cx } from "../ui";
import type { Player } from "./use-player";

const hm = (s: number) => fmtHora(s).slice(0, 5);
export const COR_TABLET = "var(--reg-dot)";

/** Texto do balão de um bloco: "Motor 2º ligado · 09:26–09:36 · 10 min". */
export const dicaBloco = (rotulo: string, a: number, b: number) => `${rotulo} · ${hm(a)}–${hm(b)} · ${fmtMin((b - a) / 60)}`;

/** A história do dia com os capítulos medidos pelo motor do GAUSS (sem RPM). Sem dados do GAUSS, fica como veio. */
export function useHistoriaComGauss(historia: HistoriaDia, g: GaussDia | null, dia: string): HistoriaDia {
  return useMemo(() => (g?.status.length ? { ...historia, capitulos: capitulosComGauss(historia.capitulos, g.status, dia) } : historia), [historia, g, dia]);
}

/** Status do motor (GAUSS) e apontamento do tablet na hora do player. */
export function agoraGauss(g: GaussDia | null, t: number) {
  return { status: g ? blocoEm(g.status, t) : null, tablet: g ? blocoEm(g.tablet, t) : null };
}

/** Números do dia: os do GPS (período, distância, andando, parado) + motor e produtividade pelo GAUSS (fora da base). */
export function itensDoDia(h: Historico, g: GaussDia | null, produtivo: string | null): ItemResumo[] {
  const itens = itensResumo(h);
  if (!g?.status.length) return itens;
  const t = new Map(totaisGauss(g.status).map((x) => [x.cod, x.min]));
  const min = (...cods: string[]) => cods.reduce((n, c) => n + (t.get(c) ?? 0), 0);
  const prod = dividirProdutivo(g.status, produtivo, baseDosTrechos(h.trechos));
  return [
    ...itens,
    ...(prod ? [{ rotulo: `Produtivo (${statusGauss(produtivo!).rotulo.toLowerCase()})`, valor: fmtMin(prod.min), nota: "fora da base (a Baia de Resíduos conta)" }] : []),
    ...(prod && prod.base_min >= 1 ? [{ rotulo: "Motor ligado na base", valor: fmtMin(prod.base_min), nota: "no Pátio do Transporte ou na Garagem: não conta como produtivo" }] : []),
    { rotulo: "Motor ligado", valor: fmtMin(min("on", "stopped", "secondary_motor_on")), nota: "inclui parado ligado e motor 2º" },
    { rotulo: "Motor 2º ligado", valor: `⚙ ${fmtMin(min("secondary_motor_on"))}`, motor2: true },
    { rotulo: "Desligado", valor: fmtMin(min("off", "main_switch_off")) },
  ];
}

/** Linha fina sobre o mapa (Timeline nova): blocos coloridos na janela; clicar leva o caminhão ao horário. */
function LinhaFina({ nome, blocos, player, janela }: { nome: string; blocos: { a: number; b: number; rotulo: string; cor: string }[]; player: Player; janela: Janela }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 shrink-0 text-right text-[10px] font-semibold uppercase tracking-wider text-white/80">{nome}</span>
      <div
        role="presentation"
        onPointerDown={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          player.irPara(segDaFracao((e.clientX - r.left) / r.width, janela));
        }}
        className="relative h-1.5 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20"
      >
        {blocos.map((x, i) => {
          const p = posBloco(x.a, x.b, janela);
          if (!p) return null;
          return <span key={i} title={dicaBloco(x.rotulo, x.a, x.b)} className="absolute inset-y-0" style={{ left: `${p.esq}%`, width: `${p.larg}%`, background: x.cor }} />;
        })}
      </div>
    </div>
  );
}

/** Timeline nova: linha do tablet acima da linha do motor (a linha do motor é a LinhaDia, com os blocos do GAUSS). */
export function LinhaTabletFina({ g, player, janela = [0, DIA] }: { g: GaussDia; player: Player; janela?: Janela }) {
  return (
    <div className="mb-1">
      <LinhaFina nome="Tablet" blocos={g.tablet.map((x) => ({ a: x.a, b: x.b, rotulo: `Tablet: ${x.categoria}`, cor: COR_TABLET }))} player={player} janela={janela} />
    </div>
  );
}

/** Legenda com o total de cada status do motor no dia (cor + nome + tempo). */
export function LegendaGauss({ g }: { g: GaussDia }) {
  const totais = totaisGauss(g.status);
  if (!totais.length) return <p className="text-xs text-suave">O GAUSS ainda não tem a timeline de motor deste veículo neste dia.</p>;
  return (
    <ul aria-label="Status do GAUSS no dia" className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
      {totais.map((t) => (
        <li key={t.cod} className="flex items-center gap-1.5">
          <i className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: corDoTom(t.tom) }} />
          {t.rotulo} <b className="tabular-nums">{fmtMin(t.min)}</b>
        </li>
      ))}
    </ul>
  );
}

/** Lista dos apontamentos do tablet no dia; tocar leva o caminhão ao início do apontamento. */
export function ListaTablet({ g, irPara, atual }: { g: GaussDia; irPara: (s: number) => void; atual?: ApontamentoTablet | null }) {
  if (!g.tablet.length) return <p className="text-xs text-suave">Nenhum apontamento no tablet neste dia.</p>;
  return (
    <ol aria-label="Apontamentos do tablet" className="divide-y divide-borda overflow-hidden rounded-lg border border-borda">
      {g.tablet.map((x) => (
        <li key={x.cod}>
          <button
            type="button"
            onClick={() => irPara(x.a)}
            className={cx("flex w-full items-baseline gap-2 px-2.5 py-1.5 text-left text-xs hover:bg-superficie-2", atual?.cod === x.cod && "bg-primaria-suave")}
          >
            <span className="w-[86px] shrink-0 tabular-nums text-suave">
              {hm(x.a)}–{x.aberto ? "agora" : hm(x.b)}
            </span>
            <span className="min-w-0 flex-1 truncate font-medium">{x.categoria}</span>
            <span className="shrink-0 tabular-nums text-suave">{fmtMin((x.b - x.a) / 60)}</span>
          </button>
        </li>
      ))}
    </ol>
  );
}
