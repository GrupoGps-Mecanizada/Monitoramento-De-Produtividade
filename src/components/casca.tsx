"use client";

import type { ReactNode } from "react";
import { Avisos } from "./avisos";
import { BarraSuperior } from "./barra-superior";
import { Paleta } from "./paleta";

/** Moldura de todas as telas: barra superior (e inferior no celular), busca Ctrl K e avisos. */
export function Casca({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col">
      <BarraSuperior />
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      <Paleta />
      <Avisos />
    </div>
  );
}
