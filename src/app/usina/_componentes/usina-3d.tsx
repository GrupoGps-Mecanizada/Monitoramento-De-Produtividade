"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRetrato } from "@/lib/dados/use-retrato";
import { frotaParaMaquete } from "@/lib/dominio/usina-3d";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/**
 * Usina 3D: a maquete do projeto Usina Virtual (public/usina/maquete.html) dentro do sistema.
 * A maquete não tem chave nenhuma: esta tela lê a frota ao vivo (Realtime) e manda para ela por mensagem,
 * só para a própria página aberta aqui e do mesmo endereço.
 */
export function Usina3D() {
  const quadro = useRef<HTMLIFrameElement>(null);
  const pronta = useRef(false);
  const { retrato } = useRetrato();

  const enviar = useCallback(() => {
    const destino = quadro.current?.contentWindow;
    if (!pronta.current || !destino || !retrato) return;
    destino.postMessage({ tipo: "usina:frota", frota: frotaParaMaquete(retrato.veiculos) }, location.origin);
  }, [retrato]);

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      if (e.origin !== location.origin || e.source !== quadro.current?.contentWindow || e.data?.tipo !== "usina:pronta") return;
      pronta.current = true;
      enviar();
    };
    addEventListener("message", ouvir);
    return () => removeEventListener("message", ouvir);
  }, [enviar]);

  useEffect(enviar, [enviar]);

  return <iframe ref={quadro} src={`${BASE}/usina/maquete.html`} title="Maquete 3D da usina com a frota ao vivo" className="w-full min-h-[70dvh] flex-1 border-0" />;
}
