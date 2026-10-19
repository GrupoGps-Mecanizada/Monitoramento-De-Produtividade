"use client";

import { useState } from "react";
import { Aviso } from "@/components/ui";
import { useGestaoDados } from "@/lib/dados/alertas";
import { diaLocal } from "@/lib/dominio/formato";
import { AbasTexto } from "./comum";
import { Destinos } from "./destinos";
import { Filtro } from "./filtro";
import { PainelAlertas } from "./painel-alertas";
import { Saude } from "./saude";

type Aba = "alertas" | "filtro" | "destinos" | "saude";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "alertas", rotulo: "Alertas" },
  { id: "filtro", rotulo: "Filtro inteligente" },
  { id: "destinos", rotulo: "Destinatários" },
  { id: "saude", rotulo: "Saúde" },
];

/** Sem login: só o dono gere os alertas (decisão de 17/10/2026). Fica registrado como quem marcou "visto". */
const QUEM = "Dono";

/** Gestão de alertas (P-026): o que o robô gravou, o que vai para o WhatsApp e quem recebe. */
export function Gestao() {
  const [aba, setAba] = useState<Aba>("alertas");
  const [hoje] = useState(() => diaLocal());
  const { alertas, config, erro, recarregar } = useGestaoDados(hoje);
  return (
    // página toda branca, separada só por linhas finas e espaço (estilo A, escolhido pelo dono em 16/10/2026)
    <div className="min-h-[calc(100dvh-64px)] w-full bg-superficie pb-24 md:pb-12">
      <header className="border-b border-borda">
        <div className="flex w-full flex-wrap items-end gap-3 px-4 pt-3 md:px-8">
          <AbasTexto<Aba> grande semLinha rotulo="Gestão de alertas" valor={aba} mudar={setAba} abas={ABAS} />
        </div>
      </header>
      <div className="w-full px-4 pt-6 md:px-8 md:pt-8">
        <div className="space-y-6">
      {erro && (
        <Aviso tipo="erro">
          Não deu para ler os alertas ({erro}). Se for a primeira vez, rode o SQL <code>supabase/alertas.sql</code> no Supabase PRODUTIVIDADE.
        </Aviso>
      )}
      {aba === "alertas" && <PainelAlertas alertas={alertas} hoje={hoje} email={QUEM} aoMudar={recarregar} />}
      {aba === "filtro" && (config ? <Filtro alertas={alertas} config={config} hoje={hoje} logado aoSalvar={recarregar} /> : !erro && <p>Carregando…</p>)}
      {aba === "destinos" && <Destinos />}
      {aba === "saude" && <Saude alertas={alertas} logado />}
        </div>
      </div>
    </div>
  );
}
