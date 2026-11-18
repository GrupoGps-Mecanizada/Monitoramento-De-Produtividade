"use client";

import type { ReactNode } from "react";
import { Avisos } from "./avisos";
import { BarraSuperior } from "./barra-superior";
import { MenuNoPortal, useNoPortalNovo } from "./no-portal";
import { Paleta } from "./paleta";

/**
 * Moldura de todas as telas: barra superior (e inferior no celular), busca Ctrl K e avisos.
 * Dentro do portal novo (17/11/2026) a barra é a do portal: aqui só manda as telas para o menu dele.
 */
export function Casca({ children }: { children: ReactNode }) {
  const noPortalNovo = useNoPortalNovo();
  return (
    <div className="flex min-h-dvh flex-col">
      {noPortalNovo ? <MenuNoPortal /> : <BarraSuperior />}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</main>
      <Paleta />
      <Avisos />
    </div>
  );
}
