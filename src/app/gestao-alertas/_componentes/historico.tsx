"use client";

import { useMemo, useState } from "react";
import { Entrada, Selecao, Vazio } from "@/components/ui";
import type { AlertaGravado } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { rotuloDia } from "@/lib/dominio/formato";
import { CartaoAlerta } from "./cartao";
import { BotoesAvaliacao } from "./fila";

const MAX_LINHAS = 300;

/** 90 dias de alertas, do mais novo para o mais antigo, com filtros. */
export function Historico({ alertas, hoje, email, aoMudar }: { alertas: AlertaGravado[]; hoje: string; email: string | null; aoMudar: () => void }) {
  const [dia, setDia] = useState("");
  const [regra, setRegra] = useState("");
  const [situacao, setSituacao] = useState("");
  const [placa, setPlaca] = useState("");
  const dias = useMemo(() => [...new Set(alertas.map((a) => a.dia))].sort().reverse(), [alertas]);
  const busca = placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  const lista = alertas
    .filter(
      (a) =>
        (!dia || a.dia === dia) &&
        (!regra || a.regra === regra) &&
        (!situacao || a.situacao === situacao) &&
        (!busca || a.placa.replace(/[^A-Za-z0-9]/g, "").toUpperCase().includes(busca)),
    )
    .sort((p, q) => q.dia.localeCompare(p.dia) || q.ini - p.ini);
  return (
    <section aria-label="Histórico de alertas" className="rounded-xl border border-borda bg-superficie shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
        <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia">
          <option value="">Últimos 90 dias</option>
          {dias.map((d) => (
            <option key={d} value={d}>
              {rotuloDia(d, hoje)}
            </option>
          ))}
        </Selecao>
        <Selecao value={regra} onChange={(e) => setRegra(e.target.value)} aria-label="Regra">
          <option value="">Todas as regras</option>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {ROTULO_REGRA[r]}
            </option>
          ))}
        </Selecao>
        <Selecao value={situacao} onChange={(e) => setSituacao(e.target.value)} aria-label="Situação">
          <option value="">Todas as situações</option>
          <option value="aberto">Aberto</option>
          <option value="visto">Visto</option>
          <option value="resolvido">Resolvido</option>
          <option value="silenciado">Silenciado</option>
        </Selecao>
        <Entrada value={placa} onChange={(e) => setPlaca(e.target.value)} placeholder="Placa" aria-label="Placa" className="w-32" />
        <span className="text-sm text-suave md:ml-auto">
          <b className="tabular-nums text-texto">{lista.length}</b> {lista.length === 1 ? "alerta" : "alertas"}
          {lista.length > MAX_LINHAS && ` (mostrando ${MAX_LINHAS}; use os filtros)`}
        </span>
      </div>
      {lista.length ? (
        <ul>
          {lista.slice(0, MAX_LINHAS).map((a) => (
            <CartaoAlerta key={a.id} a={a} hoje={hoje} acoes={<BotoesAvaliacao a={a} email={email} aoMudar={aoMudar} />} />
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nenhum alerta com esses filtros" />
      )}
    </section>
  );
}
