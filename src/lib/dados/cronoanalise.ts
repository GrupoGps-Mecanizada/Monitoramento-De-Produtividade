"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { fimDoTurno, padraoVagaGauss, type LinhaCrono, type TurnoCrono } from "../dominio/cronoanalise";
import { formasDaPlaca, type LinhaMotorGauss, type LinhaTablet } from "../dominio/gauss-dia";
import { db, ok } from "../supabase/cliente";

const COLUNAS = "data, turno, horario, area, nome, papel, placa, vaga, equip, hi, hf, cod, descricao, cls, obs, supervisor, kit";

/** Folhas da cronoanálise (sem as de teste). São centenas de linhas: cabem em poucas páginas. */
export async function lerFolhas(c: SupabaseClient = db()): Promise<LinhaCrono[]> {
  const linhas: LinhaCrono[] = [];
  for (let de = 0; de < 20000; de += 1000) {
    const pag = (await ok(
      c
        .from("crono_registros")
        .select(COLUNAS)
        .or("ficticio.is.null,ficticio.eq.false")
        .order("id")
        .range(de, de + 999),
    )) as LinhaCrono[];
    linhas.push(...pag);
    if (pag.length < 1000) break;
  }
  return linhas;
}

/**
 * Motor do GAUSS (pela vaga da folha: a timeline é gravada por vaga) e tablet (pela placa) na janela do turno.
 * Só o Supabase, nunca o GAUSS. Vaga sem número: o motor vem vazio e a tela avisa.
 */
export async function lerTelemetriaDoTurno(t: TurnoCrono, c: SupabaseClient = db()): Promise<{ motor: LinhaMotorGauss[]; tablet: LinhaTablet[] }> {
  const de = t.inicio;
  const ate = fimDoTurno(t);
  const vaga = padraoVagaGauss(t.vaga, t.equip);
  const [motor, tablet] = await Promise.all([
    vaga
      ? (ok(
          c
            .from("timeline_motor_vaga")
            .select("inicio, fim, status, status_label, gravado:updated_at")
            .ilike("vaga_nome", vaga)
            .lt("inicio", ate)
            .gt("fim", de)
            .order("inicio")
            .limit(3000),
        ) as Promise<LinhaMotorGauss[]>)
      : Promise.resolve([] as LinhaMotorGauss[]),
    ok(
      c
        .from("demoras_categorizadas")
        .select("demora_cod, inicio, fim, categoria_demora, motorista, concluido")
        .in("placa", formasDaPlaca(t.placa))
        .lt("inicio", ate)
        .or(`fim.is.null,fim.gt.${de}`)
        .order("inicio")
        .limit(500),
    ) as Promise<LinhaTablet[]>,
  ]);
  return { motor: motor ?? [], tablet: tablet ?? [] };
}

export function useFolhas() {
  const [estado, setEstado] = useState<{ linhas: LinhaCrono[] | null; erro: string | null }>({ linhas: null, erro: null });
  useEffect(() => {
    let vivo = true;
    lerFolhas().then(
      (linhas) => vivo && setEstado({ linhas, erro: null }),
      (e: unknown) => vivo && setEstado({ linhas: null, erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, []);
  return estado;
}

export type EstadoTelemetria = { chave: string | null; motor: LinhaMotorGauss[]; tablet: LinhaTablet[]; erro: string | null };

/** Lê a telemetria quando muda o turno. Falha não derruba a tela. */
export function useTelemetriaDoTurno(t: TurnoCrono | null) {
  const [estado, setEstado] = useState<EstadoTelemetria>({ chave: null, motor: [], tablet: [], erro: null });
  const chave = t?.chave ?? null;
  useEffect(() => {
    if (!t || !chave) return;
    let vivo = true;
    lerTelemetriaDoTurno(t).then(
      (r) => vivo && setEstado({ chave, ...r, erro: null }),
      (e: unknown) => vivo && setEstado({ chave, motor: [], tablet: [], erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
    // t muda junto com a chave
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  const doTurno = estado.chave === chave;
  return { motor: doTurno ? estado.motor : [], tablet: doTurno ? estado.tablet : [], carregando: !!chave && !doTurno, erro: doTurno ? estado.erro : null };
}
