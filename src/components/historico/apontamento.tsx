"use client";

import { useState } from "react";
import { baixarTexto } from "@/lib/arquivo";
import { MIN_CAPITULO, type Capitulo, type HistoriaDia } from "@/lib/dominio/capitulos";
import { csvApontamento, nomeCsv } from "@/lib/dominio/csv";
import { diaBR } from "@/lib/dominio/formato";
import type { Historico } from "@/lib/tipos";
import { Gaveta } from "../gaveta";
import { Icone } from "../icones";
import { Botao, Segmentado, Vazio } from "../ui";
import { ListaCapitulos } from "./capitulos";
import { TempoPorArea } from "./tempo-area";
import { ListaTrechos } from "./trechos";

type Aba = "capitulos" | "trechos" | "areas";
interface Props {
  h: Historico;
  placa: string;
  historia: HistoriaDia;
  atual: number | null;
  foco: [number, number] | null;
  irCapitulo: (c: Capitulo) => void;
  trechoSel: number | null;
  escolherTrecho: (i: number) => void;
  fechar: () => void;
}

/** Gaveta "Apontamento" (sem bloquear o mapa): capítulos, trechos e tempo por área, com o CSV. */
export function Apontamento(p: Props) {
  const [aba, setAba] = useState<Aba>("capitulos");
  const areas = p.h.resumo?.areas ?? [];
  return (
    <Gaveta
      titulo={`Apontamento · ${p.placa}`}
      sub={diaBR(p.h.dia)}
      fechar={p.fechar}
      modal={false}
      ajustavel="apontamento"
      rodape={
        <Botao variante="secundaria" onClick={() => baixarTexto(nomeCsv(p.placa, p.h.dia), csvApontamento(p.h, p.placa))}>
          <Icone nome="baixar" className="h-4 w-4" />
          Exportar CSV
        </Botao>
      }
    >
      <div className="border-b border-borda p-3">
        <Segmentado
          rotulo="O que ver"
          valor={aba}
          mudar={setAba}
          opcoes={[
            { id: "capitulos", rotulo: `Capítulos (${p.historia.capitulos.length})` },
            { id: "trechos", rotulo: `Trechos (${p.h.trechos.length})` },
            { id: "areas", rotulo: "Tempo por área" },
          ]}
        />
        {aba === "capitulos" && <p className="mt-2 text-xs text-suave">Paradas de {MIN_CAPITULO} min ou mais no mesmo lugar.</p>}
      </div>
      {aba === "capitulos" && <ListaCapitulos capitulos={p.historia.capitulos} atual={p.atual} foco={p.foco} escolher={p.irCapitulo} />}
      {aba === "trechos" && <ListaTrechos trechos={p.h.trechos} sel={p.trechoSel} aoEscolher={p.escolherTrecho} />}
      {aba === "areas" && (areas.length ? <TempoPorArea areas={areas} /> : <Vazio titulo="Sem áreas">Neste dia o equipamento não ficou dentro de nenhuma área cadastrada.</Vazio>)}
    </Gaveta>
  );
}
