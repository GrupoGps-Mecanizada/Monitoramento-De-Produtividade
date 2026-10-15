"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/ui";
import { lerFilaEnvio } from "@/lib/dados/alertas";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { useAgora } from "@/lib/hooks";
import { erroTexto, quando } from "./comum";

function Caixa({ titulo, valor, sub }: { titulo: string; valor: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-borda bg-superficie p-4 shadow-sm">
      <p className="text-[13px] text-suave">{titulo}</p>
      <p className="text-xl font-bold tabular-nums">{valor}</p>
      {sub && <p className="text-xs text-suave">{sub}</p>}
    </div>
  );
}

/** Aba Saúde: o robô está gravando? A fila do WhatsApp anda? (o envio é a etapa 3) */
export function Saude({ alertas, logado }: { alertas: AlertaGravado[]; logado: boolean }) {
  const [fila, setFila] = useState<{ pendentes: number; erros: number; ultimoEnvio: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const agora = useAgora();
  useEffect(() => {
    if (logado) lerFilaEnvio().then(setFila, (e: unknown) => setErro(erroTexto(e)));
  }, [logado]);
  const ultimo = alertas.map((a) => a.atualizado_em).sort().at(-1) ?? null;
  const atrasado = !ultimo || (agora > 0 && agora - Date.parse(ultimo) > 30 * 60000);
  const so = (v: string) => (logado ? v : "entre para ver");
  return (
    <section aria-label="Saúde" className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Caixa titulo="Robô dos alertas" valor={quando(ultimo)} sub="última gravação" />
        <Caixa titulo="Mensagens na fila" valor={so(String(fila?.pendentes ?? "…"))} />
        <Caixa titulo="Mensagens com erro" valor={so(String(fila?.erros ?? "…"))} />
        <Caixa titulo="Último WhatsApp enviado" valor={so(quando(fila?.ultimoEnvio ?? null))} />
      </div>
      {atrasado && <Aviso tipo="alerta">O robô não grava há mais de 30 min (ou não houve alerta no período). Sem exceções no dia, é normal.</Aviso>}
      {logado && fila && !fila.ultimoEnvio && <Aviso tipo="info">O envio pelo WhatsApp ainda não foi ligado (etapa 3).</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </section>
  );
}
