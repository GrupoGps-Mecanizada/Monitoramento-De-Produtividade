"use client";

import { useState } from "react";
import { avisar } from "@/components/avisos";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Botao, Entrada, Selo, SecaoTitulo } from "@/components/ui";
import { salvarItemLista, type TabelaLista } from "@/lib/dados/use-matriz";
import type { ItemLista } from "@/lib/tipos";

/** Supervisores e regimes: cadastrar e desativar (inativo some das opções, mas o nome continua nos equipamentos). */
export function PainelListas({ supervisores, regimes, fechar }: { supervisores: ItemLista[]; regimes: ItemLista[]; fechar: () => void }) {
  return (
    <Gaveta titulo="Supervisores e regimes" sub="Opções que aparecem ao editar um equipamento" fechar={fechar}>
      <Lista titulo="Supervisores" tabela="frota_supervisor" itens={supervisores} exemplo="ex.: OZIAS" />
      <Lista titulo="Regimes" tabela="frota_regime" itens={regimes} exemplo="ex.: 4X4 - A" />
    </Gaveta>
  );
}

function Lista({ titulo, tabela, itens, exemplo }: { titulo: string; tabela: TabelaLista; itens: ItemLista[]; exemplo: string }) {
  const [nome, setNome] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState<number | "novo" | null>(null);

  const adicionar = async () => {
    setGravando("novo");
    const falha = await salvarItemLista(tabela, { nome });
    setGravando(null);
    setErro(falha);
    if (!falha) {
      setNome("");
      avisar(`${nome.trim().toUpperCase()} cadastrado.`, { tipo: "ok" });
    }
  };
  const alternar = async (i: ItemLista) => {
    setGravando(i.id);
    const falha = await salvarItemLista(tabela, { ativo: !i.ativo }, i.id);
    setGravando(null);
    setErro(falha);
  };

  return (
    <section className="mb-5">
      <SecaoTitulo>{titulo}</SecaoTitulo>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void adicionar();
        }}
      >
        <Entrada className="flex-1" placeholder={exemplo} maxLength={60} value={nome} onChange={(e) => setNome(e.target.value)} aria-label={`Novo em ${titulo}`} />
        <Botao type="submit" variante="secundaria" disabled={gravando === "novo" || !nome.trim()}>
          Adicionar
        </Botao>
      </form>
      {erro && (
        <div className="mt-2">
          <Aviso tipo="erro">{erro}</Aviso>
        </div>
      )}
      <ul className="mt-2 divide-y divide-borda rounded-lg border border-borda">
        {itens.map((i) => (
          <li key={i.id} className="flex items-center gap-2 px-3 py-2 text-sm">
            <span className="flex-1">{i.nome}</span>
            {!i.ativo && <Selo tom="na">Inativo</Selo>}
            <Botao tamanho="mini" variante="discreta" disabled={gravando === i.id} onClick={() => void alternar(i)}>
              {i.ativo ? "Desativar" : "Reativar"}
            </Botao>
          </li>
        ))}
      </ul>
    </section>
  );
}
