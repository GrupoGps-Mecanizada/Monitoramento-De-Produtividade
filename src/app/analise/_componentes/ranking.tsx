"use client";

import { useState } from "react";
import { ranking, valorDe, type Medida, type ResumoLocal } from "@/lib/dominio/analise";
import { COR_CATEGORIA, ROTULO_MEDIDA, corDoApontamento, rotuloValor } from "./cores-analise";

/** Marca de cor ao lado do nome quando a medida pinta por tipo de local ou apontamento. */
function Marca({ r, medida }: { r: ResumoLocal; medida: Medida }) {
  const cor = medida === "categoria" ? COR_CATEGORIA[r.local.categoria] : medida === "apontamento" && r.apont[0] ? corDoApontamento(r.apont[0].nome) : null;
  return cor ? <i aria-hidden className="inline-block h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: cor }} /> : null;
}

function Linha({ r, medida, max, pos, abrir }: { r: ResumoLocal; medida: Medida; max: number; pos: string; abrir: (r: ResumoLocal) => void }) {
  return (
    <button type="button" onClick={() => abrir(r)} className="w-full rounded-lg px-2 py-1.5 text-left hover:bg-superficie-2">
      <span className="flex items-baseline gap-2 text-[13px]">
        <b className="w-5 shrink-0 text-right text-suave">{pos}</b>
        <span className="min-w-0 flex-1 truncate font-semibold">{r.local.nome}</span>
        <Marca r={r} medida={medida} />
      </span>
      <span className="ml-7 block text-xs text-suave">{rotuloValor(r, medida)}</span>
      <span className="ml-7 mt-0.5 block h-1 overflow-hidden rounded bg-superficie-2">
        <span className="block h-full rounded bg-primaria" style={{ width: `${max ? (valorDe(r, medida) / max) * 100 : 0}%` }} />
      </span>
    </button>
  );
}

/** Quantas áreas a lista mostra antes do "Ver todas". */
const PRIMEIRAS = 10;

/** Coluna da direita: as áreas com a medida (maior primeiro; 10 e "Ver todas") e, no fim, a linha "Fora da Usiminas". */
export function Ranking({ resumos, fora, medida, abrir, semRegra }: { resumos: ResumoLocal[]; fora: ResumoLocal | null; medida: Medida; abrir: (r: ResumoLocal) => void; semRegra: boolean }) {
  const [todas, setTodas] = useState(false);
  const titulo = <h2 className="px-2 pb-1 text-sm font-semibold">Por área · {ROTULO_MEDIDA[medida].toLowerCase()}</h2>;
  if (semRegra && (medida === "produtivo" || medida === "sem_produzir"))
    return (
      <div>
        {titulo}
        <p className="px-2 text-xs text-suave">Este tipo não tem regra de produtividade (Hiper Vácuo, Ultravac, Brook e Aspiradores). Escolha Tempo parado ou Visitas.</p>
      </div>
    );
  const todos = ranking(resumos, medida, Infinity);
  const max = todos[0] ? valorDe(todos[0], medida) : 0;
  const vistos = todas ? todos : todos.slice(0, PRIMEIRAS);
  return (
    <div>
      {titulo}
      {todos.length ? (
        <ol aria-label="Ranking" className="space-y-0.5">
          {vistos.map((r, i) => (
            <li key={r.local.chave}>
              <Linha r={r} medida={medida} max={max} pos={String(i + 1)} abrir={abrir} />
            </li>
          ))}
        </ol>
      ) : (
        <p className="px-2 text-xs text-suave">Nenhuma área com paradas neste filtro.</p>
      )}
      {todos.length > PRIMEIRAS && (
        <button type="button" onClick={() => setTodas((v) => !v)} className="mt-1 px-2 text-xs font-semibold text-primaria hover:underline">
          {todas ? "Mostrar só as 10 primeiras" : `Ver todas as ${todos.length} áreas`}
        </button>
      )}
      {fora && valorDe(fora, medida) > 0 && (
        <div className="mt-2 border-t border-borda pt-2">
          <Linha r={fora} medida={medida} max={Math.max(max, valorDe(fora, medida))} pos="·" abrir={abrir} />
        </div>
      )}
    </div>
  );
}
