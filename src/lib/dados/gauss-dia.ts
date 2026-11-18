"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { diaLocal } from "../dominio/formato";
import type { ConferenciaVaga, LinhaMotorVaga } from "../dominio/dia-vaga";
import { formasDaPlaca, montarStatusGauss, montarTablet, type GaussDia, type LinhaMotorGauss, type LinhaTablet } from "../dominio/gauss-dia";
import { db, ok } from "../supabase/cliente";

const diaSeguinte = (dia: string) => {
  const d = new Date(`${dia}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return diaLocal(d);
};

/**
 * Status do GAUSS (timeline_motor_vaga) e apontamentos do tablet (demoras_categorizadas) de um veículo num dia.
 * Só lê o Supabase (a extração do PC grava essas tabelas): nenhuma consulta nova ao GAUSS.
 */
export async function lerGaussDia(id: string, placa: string, dia: string, c: SupabaseClient = db()): Promise<GaussDia> {
  const ate = diaSeguinte(dia);
  const [motor, tablet] = await Promise.all([
    ok(
      c
        .from("timeline_motor_vaga")
        .select("inicio, fim, status, status_label, gravado:updated_at")
        .eq("placa_ou_codigo", id)
        .lt("inicio", ate)
        .gt("fim", dia)
        .order("inicio")
        .limit(2000),
    ) as Promise<LinhaMotorGauss[]>,
    ok(
      c
        .from("demoras_categorizadas")
        .select("demora_cod, inicio, fim, categoria_demora, motorista, concluido")
        .in("placa", formasDaPlaca(placa))
        .lt("inicio", ate)
        .or(`fim.is.null,fim.gt.${dia}`)
        .order("inicio")
        .limit(500),
    ) as Promise<LinhaTablet[]>,
  ]);
  const agora = new Date();
  const agoraSeg = dia === diaLocal(agora) ? agora.getHours() * 3600 + agora.getMinutes() * 60 : 86400;
  return { status: montarStatusGauss(motor ?? [], dia), tablet: montarTablet(tablet ?? [], dia, agoraSeg) };
}

// o Supabase entrega no máximo 1000 linhas por consulta: o dia da frota (~900 linhas) vem em páginas
const PAGINA = 1000;
const MAX_LINHAS = 10000;

/** Timeline de motor do GAUSS de todas as vagas num dia (Dia da frota) e quando ela foi gravada pela última vez. */
export async function lerMotorFrotaDia(dia: string, c: SupabaseClient = db()): Promise<{ linhas: LinhaMotorVaga[]; gravadoEm: string | null }> {
  const ate = diaSeguinte(dia);
  const linhas: LinhaMotorVaga[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(
      c
        .from("timeline_motor_vaga")
        .select("vaga_id, vaga_nome, placa_ou_codigo, placa, cor, inicio, fim, status, status_label, gravado:updated_at")
        .lt("inicio", ate)
        .gt("fim", dia)
        // id desempata: as páginas não repetem nem pulam linhas
        .order("id")
        .range(de, de + PAGINA - 1),
    )) as LinhaMotorVaga[];
    linhas.push(...pag);
    if (pag.length < PAGINA) break;
  }
  const gravadoEm = linhas.reduce<string | null>((m, l) => (l.gravado && (!m || l.gravado > m) ? l.gravado : m), null);
  return { linhas, gravadoEm };
}

/** O que o GAUSS mandou em cada vaga no dia (última busca do coletor). Falha (tabela ainda não criada) = sem conferência. */
export async function lerConferenciaDia(dia: string, c: SupabaseClient = db()): Promise<ConferenciaVaga[]> {
  const { data, error } = await c.from("timeline_conferencia").select("vaga_id, minutos, trechos, buscado_em").eq("dia", dia).limit(500);
  return error ? [] : ((data ?? []) as ConferenciaVaga[]);
}

/** Apontamentos do tablet de toda a frota num dia (Exceções do dia), em páginas. */
export async function lerTabletFrotaDia(dia: string, c: SupabaseClient = db()): Promise<(LinhaTablet & { placa: string })[]> {
  const ate = diaSeguinte(dia);
  const linhas: (LinhaTablet & { placa: string })[] = [];
  for (let de = 0; de < MAX_LINHAS; de += PAGINA) {
    const pag = (await ok(
      c
        .from("demoras_categorizadas")
        .select("placa, demora_cod, inicio, fim, categoria_demora, motorista, concluido")
        .lt("inicio", ate)
        .or(`fim.is.null,fim.gt.${dia}`)
        // demora_cod desempata: as páginas não repetem nem pulam linhas
        .order("inicio")
        .order("demora_cod")
        .range(de, de + PAGINA - 1),
    )) as (LinhaTablet & { placa: string })[];
    linhas.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return linhas;
}

/** Dia da frota: lê a timeline de motor do dia e, se for hoje, relê a cada 5 min (só o Supabase, nunca o GAUSS). */
export function useMotorFrota(dia: string, hoje: boolean) {
  // "carregando" = o que está guardado é de outro dia (sem setState síncrono no efeito)
  const [estado, setEstado] = useState<{ dia: string | null; linhas: LinhaMotorVaga[]; conferencias: ConferenciaVaga[]; gravadoEm: string | null; erro: string | null }>({
    dia: null,
    linhas: [],
    conferencias: [],
    gravadoEm: null,
    erro: null,
  });
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      Promise.all([lerMotorFrotaDia(dia), lerConferenciaDia(dia)]).then(
        ([r, conferencias]) => vivo && setEstado({ dia, ...r, conferencias, erro: null }),
        (e: unknown) => vivo && setEstado((s) => ({ ...s, dia, erro: e instanceof Error ? e.message : String(e) })),
      );
    void ler();
    const t = hoje ? setInterval(ler, 5 * 60 * 1000) : undefined;
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, [dia, hoje]);
  const doDia = estado.dia === dia;
  return { linhas: doDia ? estado.linhas : [], conferencias: doDia ? estado.conferencias : [], gravadoEm: doDia ? estado.gravadoEm : null, carregando: !doDia, erro: estado.erro };
}

export type EstadoGaussDia = { dados: GaussDia | null; erro: string | null };

/** Lê uma vez por veículo e dia (a Timeline já é montada com key do histórico). Falha não derruba a tela. */
export function useGaussDia(id: string, placa: string, dia: string): EstadoGaussDia {
  const [estado, setEstado] = useState<EstadoGaussDia>({ dados: null, erro: null });
  useEffect(() => {
    let vivo = true;
    lerGaussDia(id, placa, dia).then(
      (dados) => vivo && setEstado({ dados, erro: null }),
      (e: unknown) => vivo && setEstado({ dados: null, erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [id, placa, dia]);
  return estado;
}
