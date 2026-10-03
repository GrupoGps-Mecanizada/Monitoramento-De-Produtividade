"use client";

import { useEffect, useState } from "react";
import type { EtapaPedido } from "@/lib/dados/historico";
import { Vazio } from "../ui";

/** Enquanto o histórico não chega: em que etapa está o pedido e há quanto tempo. */
export function Andamento({ etapa, desde }: { etapa: EtapaPedido | "buscando"; desde: number }) {
  const [agora, setAgora] = useState(desde);
  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const s = Math.max(0, Math.round((agora - desde) / 1000));
  const tempo = s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, "0")}s`;
  const titulo = etapa === "buscando" ? "Buscando histórico…" : etapa === "processando" ? "O coletor está buscando no GAUSS agora" : "Pedido na fila do coletor";
  return (
    <Vazio titulo={titulo}>
      Se este dia ainda não está no banco, o pedido vai para o coletor (roda a cada ~5 min no GitHub) e aparece aqui sozinho quando chegar. Depois fica guardado.
      {etapa !== "buscando" && desde > 0 && <b className="mt-1.5 block text-texto">{tempo}</b>}
    </Vazio>
  );
}
