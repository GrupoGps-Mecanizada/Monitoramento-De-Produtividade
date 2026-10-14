"use client";

import { cx } from "@/components/ui";
import { DIAS_CURTOS } from "@/lib/dominio/analise";
import { faixaDe, faixasDe } from "@/lib/dominio/assuntos";
import { fmtHoras } from "@/lib/dominio/formato";
import { corDaFaixa } from "./cores-analise";

/** seg a dom (a semana de trabalho primeiro) */
const LINHAS = [1, 2, 3, 4, 5, 6, 0];
const COM_NUMERO = 5;

/**
 * "Quando para": dia da semana × hora de início, mais escuro = mais tempo. Os 5 quadradinhos mais fortes mostram as horas;
 * passar o mouse mostra o valor de qualquer um; clicar escolhe hora e dia (clicar de novo desfaz).
 */
export function GradeQuando({ grade, hora, dia, escolher, vazio }: { grade: number[][]; hora: number | null; dia: number | null; escolher: (dia: number, hora: number) => void; vazio: string }) {
  const valores = grade.flat();
  const limites = faixasDe(valores);
  const fortes = new Set([...valores].filter((v) => v > 0).sort((a, b) => b - a).slice(0, COM_NUMERO));
  const temDado = valores.some((v) => v > 0);
  return (
    <section aria-label="Quando para" className="rounded-xl border border-borda bg-superficie p-3">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-suave">
        Quando para <span className="font-normal normal-case tracking-normal">· dia da semana × hora de início</span>
      </h2>
      {!temDado ? (
        <p className="mt-2 text-xs text-suave">{vazio}</p>
      ) : (
        <div className="mt-2 grid gap-[2px]">
          {LINHAS.map((d) => (
            <div key={d} className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] items-center gap-[2px]">
              <span className="text-[10px] text-suave">{DIAS_CURTOS[d]}</span>
              {grade[d].map((v, h) => {
                const f = faixaDe(v, limites);
                const escolhido = hora === h && dia === d;
                return (
                  <button
                    key={h}
                    type="button"
                    aria-pressed={escolhido}
                    aria-label={`${DIAS_CURTOS[d]} ${h}h, ${fmtHoras(v)}`}
                    title={`${DIAS_CURTOS[d]} ${h}h · ${fmtHoras(v)}`}
                    onClick={() => escolher(d, h)}
                    className={cx("flex h-6 items-center justify-center rounded-[3px] text-[9px] font-semibold leading-none", escolhido && "ring-2 ring-texto", hora != null && !escolhido && "opacity-40")}
                    style={{ background: v > 0 ? corDaFaixa(f, limites.length + 1) : "var(--superficie-2)", color: f >= 2 ? "#fff" : "var(--texto)" }}
                  >
                    {fortes.has(v) && v > 0 ? `${Math.round(v / 60)}h` : ""}
                  </button>
                );
              })}
            </div>
          ))}
          <div aria-hidden className="grid grid-cols-[28px_repeat(24,minmax(0,1fr))] text-[9px] text-suave">
            <span />
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="text-center">{h % 6 === 0 ? `${h}h` : ""}</span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
