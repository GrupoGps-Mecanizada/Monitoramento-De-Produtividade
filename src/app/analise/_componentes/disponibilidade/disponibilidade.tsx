"use client";

import { useMemo, useState } from "react";
import { Aviso, Selecao, Selo, Vazio } from "@/components/ui";
import { useBoletins, useDetalheVaga, useVagasBoletim } from "@/lib/dados/medicao";
import { dfDaFrota, ordenarVagas, rotuloBoletim } from "@/lib/dominio/medicao";
import { DetalheVaga } from "./detalhe-vaga";
import { ListaVagas } from "./lista-vagas";
import { PlacarDisponibilidade } from "./placar-disponibilidade";

// tabela ainda não criada (SQL não rodado): o Supabase responde em inglês técnico
const SEM_TABELA = /could not find the table|does not exist|PGRST205|42P01/i;
const mensagem = (erro: string) => (SEM_TABELA.test(erro) ? "As tabelas da medição ainda não foram criadas: rode supabase/medicao.sql no Supabase." : `Não foi possível carregar: ${erro}`);

/**
 * Aba Disponibilidade (desenho: docs/superpowers/specs/2026-10-10-medicao-oficial-design.md): os números OFICIAIS
 * dos boletins de medição GPS já fechados. Vagas da pior DF para a melhor; clicar abre o detalhe.
 */
export function Disponibilidade() {
  const boletins = useBoletins();
  const [escolhido, setEscolhido] = useState<string | null>(null);
  const [vagaSel, setVagaSel] = useState<number | null>(null);
  const lista = boletins.dados ?? [];
  const boletim = lista.find((b) => b.cod === escolhido) ?? lista[0] ?? null;
  const vagas = useVagasBoletim(boletim?.cod ?? null);
  const ordenadas = useMemo(() => ordenarVagas(vagas.dados ?? []), [vagas.dados]);
  const vaga = ordenadas.find((v) => v.vaga_id === vagaSel) ?? null;
  const detalhe = useDetalheVaga(vaga ? boletim : null, vaga?.vaga_id ?? null);
  const horasIndisp = ordenadas.reduce((s, v) => s + v.horas_indisp, 0);

  if (boletins.erro) {
    return (
      <div className="p-2">
        <Aviso tipo="erro">{mensagem(boletins.erro)}</Aviso>
      </div>
    );
  }
  if (boletins.carregando) return <p className="p-4 text-sm text-suave">Carregando os boletins…</p>;
  if (!boletim) {
    return (
      <Vazio titulo="Nenhum boletim baixado ainda">O coletor baixa o boletim quando ele fecha no GAUSS (uma vez por dia, a partir das 07:00).</Vazio>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-2 lg:overflow-hidden">
      <div className="flex flex-wrap items-center gap-2">
        <Selecao
          aria-label="Ciclo da medição"
          value={boletim.cod}
          onChange={(e) => {
            setEscolhido(e.target.value);
            setVagaSel(null);
          }}
        >
          {lista.map((b) => (
            <option key={b.cod} value={b.cod}>
              {rotuloBoletim(b)}
            </option>
          ))}
        </Selecao>
        <Selo tom="ok">Oficial</Selo>
      </div>
      {vagas.erro ? (
        <Aviso tipo="erro">{mensagem(vagas.erro)}</Aviso>
      ) : (
        <>
          <PlacarDisponibilidade df={dfDaFrota(ordenadas)} horasIndisp={horasIndisp} pior={ordenadas[0] ?? null} />
          <div className="grid min-h-0 flex-1 gap-2 lg:grid-cols-[minmax(320px,2fr)_minmax(0,3fr)] lg:grid-rows-[minmax(0,1fr)]">
            <ListaVagas vagas={ordenadas} selecionada={vaga?.vaga_id ?? null} escolher={(id) => setVagaSel((s) => (s === id ? null : id))} carregando={vagas.carregando} />
            <DetalheVaga vaga={vaga} boletim={boletim} detalhe={detalhe} />
          </div>
        </>
      )}
    </div>
  );
}
