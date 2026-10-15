"use client";

import { useEffect, useState } from "react";
import { Aviso } from "@/components/ui";
import { lerFilaEnvio } from "@/lib/dados/alertas";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { useAgora } from "@/lib/hooks";
import { erroTexto, quando } from "./comum";

function Item({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-borda/60 py-3 text-sm">
      <span className="text-suave">{titulo}</span>
      <b className="tabular-nums">{valor}</b>
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
    <section aria-label="Saúde" className="max-w-xl space-y-4">
      <div>
        <Item titulo="Última gravação do robô" valor={quando(ultimo)} />
        <Item titulo="Mensagens na fila do WhatsApp" valor={so(String(fila?.pendentes ?? "…"))} />
        <Item titulo="Mensagens com erro" valor={so(String(fila?.erros ?? "…"))} />
        <Item titulo="Último WhatsApp enviado" valor={so(quando(fila?.ultimoEnvio ?? null))} />
      </div>
      {atrasado && <p className="text-sm text-suave">O robô não grava há mais de 30 min (ou não houve alerta no período). Sem exceções no dia, é normal.</p>}
      {logado && fila && !fila.ultimoEnvio && <p className="text-sm text-suave">O envio pelo WhatsApp ainda não foi ligado (etapa 3).</p>}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </section>
  );
}
