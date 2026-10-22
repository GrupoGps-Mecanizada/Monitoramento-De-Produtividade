"use client";

import { useEffect, useMemo, useState } from "react";
import { Carregando, ErroTela } from "@/components/estado-tela";
import { PlanilhaExcel, precarregarPlanilha, type ColunaPlanilha } from "@/components/planilha-excel-sob-demanda";
import { Botao, Selo } from "@/components/ui";
import { useMatriz } from "@/lib/dados/use-matriz";
import { STATUS_EQUIP, TIPOS_EQUIP, nomeCadastro } from "@/lib/dominio/equipamentos";
import { dataHora } from "@/lib/dominio/formato";
import { COR_STATUS, linhasMatriz } from "@/lib/dominio/matriz";
import { useCelular } from "@/lib/hooks";
import type { EquipamentoCadastro } from "@/lib/tipos";
import { EditorEquipamento } from "./editor-equipamento";
import { PainelListas } from "./paineis";

const COLUNAS: ColunaPlanilha<EquipamentoCadastro>[] = [
  { id: "tipo", rotulo: "Tipo", largura: 180, valor: (l) => TIPOS_EQUIP[l.tipo].rotulo },
  { id: "equip", rotulo: "Placa / Equipamento", largura: 170, valor: (l) => nomeCadastro(l) },
  { id: "status", rotulo: "Status", largura: 150, valor: (l) => STATUS_EQUIP[l.status].rotulo, cor: (l) => COR_STATUS[l.status] },
  { id: "supervisor", rotulo: "Supervisor", largura: 170, valor: (l) => l.supervisor },
  { id: "regime", rotulo: "Regime", largura: 130, valor: (l) => l.regime },
  { id: "observacao", rotulo: "Observação", largura: 380, valor: (l) => l.observacao },
  { id: "atualizado", rotulo: "Atualizado em", largura: 140, valor: (l) => dataHora(l.atualizado_em) },
];

type Painel = { qual: "equip"; equip: EquipamentoCadastro | null } | { qual: "listas" } | null;

/** Equipamentos: a matriz da frota (status, supervisor, regime), ligada ao banco; o Monitoramento inteiro usa esta lista. */
export function Equipamentos() {
  const { cadastro, supervisores, regimes, erro } = useMatriz();
  const celular = useCelular();
  const [painel, setPainel] = useState<Painel>(null);
  useEffect(() => precarregarPlanilha(), []);

  const linhas = useMemo(() => (cadastro ? linhasMatriz(cadastro) : []), [cadastro]);

  if (erro && !cadastro) return <ErroTela mensagem={erro} />;
  if (!cadastro) return <Carregando />;

  const abrir = (equip: EquipamentoCadastro | null) => setPainel({ qual: "equip", equip });

  const botoes = (
    <>
      <Botao onClick={() => abrir(null)}>+ Novo equipamento</Botao>
      <Botao variante="secundaria" onClick={() => setPainel({ qual: "listas" })}>
        Supervisores e regimes
      </Botao>
    </>
  );

  return (
    <div className="flex w-full flex-col gap-3 px-3 pb-24 pt-3 md:px-4 md:pb-3">
      {celular ? (
        <>
          <div className="flex flex-wrap gap-2">{botoes}</div>
          <ListaCelular linhas={linhas} abrir={abrir} />
        </>
      ) : (
        <PlanilhaExcel
          nome="Equipamentos"
          linhas={linhas}
          colunas={COLUNAS}
          chave={(l) => l.id}
          aoAbrir={(l) => abrir(l)}
          dica="dois cliques numa linha para editar"
          acoes={botoes}
          altura="calc(100dvh - 80px)"
        />
      )}

      {painel?.qual === "equip" && (
        <EditorEquipamento
          key={painel.equip?.id ?? "novo"}
          equip={painel.equip}
          cadastro={cadastro}
          supervisores={supervisores}
          regimes={regimes}
          fechar={() => setPainel(null)}
        />
      )}
      {painel?.qual === "listas" && <PainelListas supervisores={supervisores} regimes={regimes} fechar={() => setPainel(null)} />}
    </div>
  );
}

/** No celular a planilha não cabe: cartões, um por equipamento (toque abre). */
function ListaCelular({ linhas, abrir }: { linhas: EquipamentoCadastro[]; abrir: (l: EquipamentoCadastro) => void }) {
  if (!linhas.length) return <p className="py-10 text-center text-sm text-suave">Nenhum equipamento cadastrado.</p>;
  return (
    <ul className="divide-y divide-borda overflow-hidden rounded-xl border border-borda bg-superficie shadow-sm">
      {linhas.map((l) => (
        <li key={l.id}>
          <button type="button" onClick={() => abrir(l)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-superficie-2">
            <span className="w-8 shrink-0 text-xs font-bold text-suave">{TIPOS_EQUIP[l.tipo].sigla}</span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{nomeCadastro(l)}</span>
              <span className="block truncate text-xs text-suave">{[l.supervisor, l.regime].filter(Boolean).join(" · ") || "sem supervisor e regime"}</span>
            </span>
            <Selo tom={STATUS_EQUIP[l.status].tom}>{STATUS_EQUIP[l.status].rotulo}</Selo>
          </button>
        </li>
      ))}
    </ul>
  );
}
