"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Icone } from "@/components/icones";
import { Botao, Campos, Ponto, Selo } from "@/components/ui";
import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";
import { diaLocal, hora, horaSeg, idadeCurta } from "@/lib/dominio/formato";
import { CATEGORIAS, FRESCOR, categoria, frescor, partesEstado } from "@/lib/dominio/veiculo";
import type { Veiculo } from "@/lib/tipos";

interface Props {
  v: Veiculo;
  agora: number;
  semSinalMin: number;
  voltar: () => void;
  centralizar: () => void;
  /** "fechar" no cartão do computador; "voltar" na gaveta do celular */
  modo?: "voltar" | "fechar";
}

/** Detalhe do equipamento: uma frase que diz o que importa, 4 dados e o caminho para o dia (Timeline). */
export function Detalhe({ v, agora, semSinalMin, voltar, centralizar, modo = "voltar" }: Props) {
  const fr = frescor(v, semSinalMin, agora);
  const p = partesEstado(v, semSinalMin, agora);
  const campos: [string, ReactNode][] = [
    ["Vaga", v.vaga || "Sem vaga"],
    ["Posição", `${horaSeg(v.posicao_em)} (há ${idadeCurta(v.posicao_em, agora)})`],
    ["Motorista", v.motorista || "Não identificado"],
    ...(v.motor2 ? ([["Bomba (motor 2º)", `${v.motor2.status}${v.motor2.status_desde ? ` desde ${hora(v.motor2.status_desde)}` : ""}`]] as [string, ReactNode][]) : []),
  ];
  const mais: [string, ReactNode][] = [
    ["Endereço", v.endereco || "—"],
    ["Via", v.via || "—"],
    ["Demora", v.demora || "—"],
    ["Coordenadas", v.lat != null && v.lng != null ? `${v.lat.toFixed(6)}, ${v.lng.toFixed(6)}` : "—"],
  ];
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-2 border-b border-borda p-3">
        <Botao variante="secundaria" tamanho="mini" onClick={voltar}>
          <Icone nome={modo === "fechar" ? "fechar" : "voltar"} className="h-4 w-4" />
          {modo === "fechar" ? "Fechar" : "Voltar"}
        </Botao>
        <Botao variante="secundaria" tamanho="mini" onClick={centralizar}>
          <Icone nome="alvo" className="h-4 w-4" />
          Centralizar
        </Botao>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-lg font-semibold">{nomeEquip(v)}</span>
          {v.equip && <Selo tom="reg">{TIPOS_EQUIP[v.equip.tipo].rotulo}</Selo>}
          <Selo tom={FRESCOR[fr].tom}>{FRESCOR[fr].rotulo}</Selo>
        </div>
        <p className="mt-3 flex items-start gap-2 text-base leading-snug">
          <Ponto tom={p.semSinal ? "neu" : CATEGORIAS[categoria(v)].tom} className="mt-1.5 h-3 w-3" />
          <span>
            <b>{p.estado}</b> · {p.lugar}
          </span>
        </p>
        <div className="mt-4">
          <Campos itens={campos} />
        </div>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-suave">Mais (endereço, coordenadas)</summary>
          <div className="mt-2">
            <Campos itens={mais} />
          </div>
        </details>
        <Link href={`/timeline/?v=${encodeURIComponent(v.id)}&dia=${diaLocal()}`} className="btn-pri mt-5 flex h-10 w-full items-center justify-center text-sm hover:no-underline">
          Ver o dia ▸
        </Link>
      </div>
    </div>
  );
}
