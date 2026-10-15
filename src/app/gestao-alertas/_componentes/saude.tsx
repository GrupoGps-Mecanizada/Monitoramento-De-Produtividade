"use client";

import { useEffect, useState } from "react";
import { Aviso, Campos } from "@/components/ui";
import { lerFilaEnvio } from "@/lib/dados/alertas";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { useAgora } from "@/lib/hooks";

const quando = (iso: string | null) => (iso ? new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—");

/** O robô está gravando? A fila do WhatsApp anda? (o envio é a etapa 3) */
export function Saude({ alertas, logado }: { alertas: AlertaGravado[]; logado: boolean }) {
  const [fila, setFila] = useState<{ pendentes: number; erros: number; ultimoEnvio: string | null } | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    if (logado) lerFilaEnvio().then(setFila, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  }, [logado]);
  const agora = useAgora();
  const ultimo = alertas.map((a) => a.atualizado_em).sort().at(-1) ?? null;
  const atrasado = !ultimo || (agora > 0 && agora - Date.parse(ultimo) > 30 * 60000);
  return (
    <section aria-label="Saúde" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
      <Campos
        itens={[
          ["Robô dos alertas", `${quando(ultimo)} (última gravação)`],
          ["Mensagens na fila", logado ? String(fila?.pendentes ?? "…") : "entre para ver"],
          ["Mensagens com erro", logado ? String(fila?.erros ?? "…") : "entre para ver"],
          ["Último WhatsApp enviado", logado ? quando(fila?.ultimoEnvio ?? null) : "entre para ver"],
        ]}
      />
      {atrasado && <Aviso tipo="alerta">O robô não grava há mais de 30 min (ou não há alertas no período). Sem exceções no dia, é normal.</Aviso>}
      {logado && fila && !fila.ultimoEnvio && <Aviso tipo="info">O envio pelo WhatsApp ainda não foi ligado (etapa 3).</Aviso>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </section>
  );
}
