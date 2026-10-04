"use client";

import { useEffect, useRef, useState } from "react";
import { Entrada, Ponto, cx } from "@/components/ui";
import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";
import { CATEGORIAS, categoria } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

/** Campo de busca com lista de veículos (placa, vaga ou motorista). */
export function SeletorVeiculo({ veiculos, escolhido, escolher, paraCima = false }: { veiculos: Veiculo[]; escolhido: Veiculo | null; escolher: (v: Veiculo) => void; paraCima?: boolean }) {
  const [texto, setTexto] = useState<string | null>(null); // null = mostra a placa escolhida
  const [aberto, setAberto] = useState(false);
  const caixa = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!aberto) return;
    const fora = (e: MouseEvent) => {
      if (caixa.current && !caixa.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener("mousedown", fora);
    return () => document.removeEventListener("mousedown", fora);
  }, [aberto]);
  const q = (texto ?? "").trim().toUpperCase();
  const lista = q ? veiculos.filter((v) => [v.placa, v.equip?.nome, v.vaga, v.motorista].join(" ").toUpperCase().includes(q)) : veiculos.slice(0, 30);
  return (
    <div ref={caixa} className="relative min-w-0 flex-1">
      <Entrada
        type="search"
        value={texto ?? (escolhido ? nomeEquip(escolhido) : "")}
        onChange={(e) => {
          setTexto(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        placeholder="Placa, vaga ou motorista…"
        aria-label="Veículo"
        autoComplete="off"
        className="w-full"
      />
      {aberto && (
        <div role="listbox" className={cx("absolute inset-x-0 z-[1200] max-h-72 overflow-y-auto rounded-xl border border-borda bg-superficie p-1 shadow-xl", paraCima ? "bottom-full mb-1" : "top-full mt-1")}>
          {lista.length ? (
            lista.map((v) => (
              <button
                key={v.id}
                type="button"
                role="option"
                aria-selected={v.id === escolhido?.id}
                onClick={() => {
                  escolher(v);
                  setTexto(null);
                  setAberto(false);
                }}
                className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-x-2 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-superficie-2"
              >
                <Ponto tom={CATEGORIAS[categoria(v)].tom} />
                <span className="font-semibold">
                  {nomeEquip(v)}
                  {v.equip && <span className="ml-1.5 text-xs font-normal text-suave">{TIPOS_EQUIP[v.equip.tipo].sigla}</span>}
                  {v.motor2 && (
                    <span className="ml-1 text-motor2" title="tem motor secundário">
                      ⚙
                    </span>
                  )}
                </span>
                <span className="truncate text-xs text-suave">{v.vaga}</span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-suave">Nenhum veículo encontrado</p>
          )}
        </div>
      )}
    </div>
  );
}
