"use client";

import { useState } from "react";
import type { porDia, porTipo, totais } from "@/lib/dominio/analise";
import { TIPOS_EQUIP } from "@/lib/dominio/equipamentos";
import { fmtHoras } from "@/lib/dominio/formato";
import { COR_PRODUTIVO, COR_SEM_PRODUZIR } from "./cores-analise";

const ddmm = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
const SERIES = [
  { chave: "produtivo", rotulo: "Produtivo", cor: COR_PRODUTIVO },
  { chave: "semProduzir", rotulo: "Sem produzir", cor: COR_SEM_PRODUZIR },
] as const;

/** Produtivo e sem produzir dia a dia: duas linhas, legenda e, ao passar o mouse, o valor do dia. */
function GraficoDias({ dias }: { dias: ReturnType<typeof porDia> }) {
  const [i, setI] = useState<number | null>(null);
  const L = 300;
  const A = 90;
  const max = Math.max(60, ...dias.flatMap((d) => [d.produtivo, d.semProduzir]));
  const x = (k: number) => (dias.length > 1 ? (k / (dias.length - 1)) * L : L / 2);
  const y = (v: number) => A - (v / max) * (A - 6);
  const d = i != null ? dias[i] : null;
  return (
    <div>
      <ul aria-label="Legenda do gráfico" className="mb-1 flex gap-3 text-[11px] text-suave">
        {SERIES.map((s) => (
          <li key={s.chave} className="flex items-center gap-1">
            <i className="inline-block h-0.5 w-3 rounded" style={{ background: s.cor }} />
            {s.rotulo}
          </li>
        ))}
      </ul>
      <p className="h-4 text-[11px] text-texto">{d ? `${ddmm(d.dia)} · produtivo ${fmtHoras(d.produtivo)} · sem produzir ${fmtHoras(d.semProduzir)}` : ""}</p>
      <svg viewBox={`-4 0 ${L + 8} ${A + 4}`} className="w-full" role="img" aria-label="Produtivo e sem produzir por dia" onMouseLeave={() => setI(null)}>
        <line x1={0} x2={L} y1={y(max)} y2={y(max)} stroke="var(--borda)" strokeDasharray="3 3" />
        <line x1={0} x2={L} y1={A} y2={A} stroke="var(--borda-2)" />
        {i != null && <line x1={x(i)} x2={x(i)} y1={0} y2={A} stroke="var(--texto-suave)" strokeWidth={1} />}
        {SERIES.map((s) => (
          <polyline key={s.chave} fill="none" stroke={s.cor} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" points={dias.map((dd, k) => `${x(k)},${y(dd[s.chave])}`).join(" ")} />
        ))}
        {i != null && SERIES.map((s) => <circle key={s.chave} cx={x(i)} cy={y(dias[i][s.chave])} r={4} fill={s.cor} stroke="var(--superficie)" strokeWidth={2} />)}
        {dias.map((_, k) => (
          <rect key={k} x={x(k) - L / dias.length / 2} y={0} width={L / dias.length} height={A} fill="transparent" onMouseEnter={() => setI(k)} onClick={() => setI(k)} />
        ))}
      </svg>
      <div className="flex justify-between text-[10px] text-suave">
        <span>{dias[0] && ddmm(dias[0].dia)}</span>
        <span>máx. {fmtHoras(max)}</span>
        <span>{dias.at(-1) && ddmm(dias.at(-1)!.dia)}</span>
      </div>
    </div>
  );
}

const Titulo = ({ children }: { children: string }) => <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-suave">{children}</h3>;

/** Coluna da esquerda: os números grandes do período, a divisão produtivo × sem produzir, o dia a dia e os tipos. */
export function ResumoPeriodo({ t, dias, tipos, periodo, foraDaUsina }: { t: ReturnType<typeof totais>; dias: ReturnType<typeof porDia>; tipos: ReturnType<typeof porTipo>; periodo: number; foraDaUsina: number }) {
  const pct = t.paradoComRegra ? Math.round((t.produtivo / t.paradoComRegra) * 100) : null;
  const soma = t.produtivo + t.semProduzir;
  const maxParado = Math.max(1, ...tipos.map((x) => x.parado));
  return (
    <section aria-label="Resumo do período" className="space-y-4">
      <p className="text-xs text-suave">Usiminas e região · últimos {periodo} dias · sem o Pátio do Transporte</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-suave">Produtivo</p>
          <p className="text-3xl font-semibold leading-none tracking-tight" style={{ color: COR_PRODUTIVO }}>
            {fmtHoras(t.produtivo)}
          </p>
          <p className="mt-1 text-[11px] text-suave">{pct == null ? "—" : `${pct}% do parado com motor`}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-suave">Sem produzir</p>
          <p className="text-3xl font-semibold leading-none tracking-tight" style={{ color: COR_SEM_PRODUZIR }}>
            {fmtHoras(t.semProduzir)}
          </p>
          <p className="mt-1 text-[11px] text-suave">parado com motor ligado</p>
        </div>
      </div>
      {soma > 0 && (
        <div aria-hidden className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          <span className="rounded-l-full" style={{ width: `${(t.produtivo / soma) * 100}%`, background: COR_PRODUTIVO }} />
          <span className="flex-1 rounded-r-full" style={{ background: COR_SEM_PRODUZIR }} />
        </div>
      )}
      <dl className="grid grid-cols-3 gap-2 border-y border-borda py-3 text-center">
        <div>
          <dt className="text-[11px] text-suave">Tempo parado</dt>
          <dd className="text-sm font-semibold">{fmtHoras(t.parado)}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-suave">Áreas atendidas</dt>
          <dd className="text-sm font-semibold">{t.areas}</dd>
        </div>
        <div>
          <dt className="text-[11px] text-suave" title="Poço Redondo, Aterro, oficinas de fora...">Fora da usina</dt>
          <dd className="text-sm font-semibold">{fmtHoras(foraDaUsina)}</dd>
        </div>
      </dl>
      <div>
        <Titulo>Dia a dia</Titulo>
        <GraficoDias dias={dias} />
      </div>
      <div>
        <Titulo>Por tipo de equipamento</Titulo>
        <ul className="space-y-2">
          {tipos.map((x) => (
            <li key={x.tipo} className="text-[13px]">
              <div className="flex justify-between gap-2">
                <span className="font-semibold">{TIPOS_EQUIP[x.tipo].rotulo}</span>
                <span className="text-xs text-suave">{x.produtivo == null ? `sem regra · ${fmtHoras(x.parado)} parado` : `${fmtHoras(x.produtivo)} de ${fmtHoras(x.parado)}`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-superficie-2" style={{ width: `${(x.parado / maxParado) * 100}%` }}>
                {x.produtivo != null && <div className="h-full rounded-full" style={{ width: `${x.parado ? (x.produtivo / x.parado) * 100 : 0}%`, background: COR_PRODUTIVO }} />}
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-suave">Barra = tempo parado; verde = a parte produtiva.</p>
      </div>
    </section>
  );
}
