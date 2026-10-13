"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import { diaSeguinte, type Boletim, type EventoIndisp, type TrechoMotor, type VagaBoletim, type VagaDia } from "../dominio/medicao";
import { db, ok } from "../supabase/cliente";
import { validarBoletins, validarEventosIndisp, validarTrechosMotor, validarVagaDias, validarVagasBoletim } from "./esquemas";

// o Supabase entrega no máximo 1000 linhas por consulta
const PAGINA = 1000;
const MAX = 20000;

async function paginado(consulta: (de: number, ate: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<unknown[]> {
  const out: unknown[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    const pag = ((await ok(consulta(de, de + PAGINA - 1))) as unknown[] | null) ?? [];
    out.push(...pag);
    if (pag.length < PAGINA) break;
  }
  return out;
}

/** Boletins gravados por inteiro, do mais novo ao mais antigo. */
export const lerBoletins = async (c: SupabaseClient = db()): Promise<Boletim[]> =>
  validarBoletins(await ok(c.from("medicao_boletim").select("cod, identificacao, inicio, fim").eq("completo", true).order("inicio", { ascending: false })));

export const lerVagasBoletim = async (cod: string, c: SupabaseClient = db()): Promise<VagaBoletim[]> =>
  validarVagasBoletim(await ok(c.from("medicao_boletim_vaga").select("*").eq("boletim_cod", cod)));

export interface DetalheVaga {
  eventos: EventoIndisp[];
  dias: VagaDia[];
  /** null: não foi possível ler a timeline de motor (a tela diz "sem dado do motor"). */
  motor: TrechoMotor[] | null;
}

export async function lerDetalheVaga(b: Boletim, vagaId: number, c: SupabaseClient = db()): Promise<DetalheVaga> {
  const [eventos, dias, motor] = await Promise.all([
    paginado((de, a) => c.from("medicao_indisp_evento").select("boletim_cod, vaga_id, placa, inicio, fim, tipo, horas").eq("boletim_cod", b.cod).eq("vaga_id", vagaId).order("inicio").order("id").range(de, a)),
    ok(c.from("medicao_vaga_dia").select("boletim_cod, vaga_id, dia, placas, horas_regime, horas_indisp").eq("boletim_cod", b.cod).eq("vaga_id", vagaId).order("dia")),
    // motor 2º da vaga nos dias do ciclo (o campo do boletim vem zerado e não é usado)
    paginado((de, a) =>
      c.from("timeline_motor_vaga").select("inicio, fim, status").eq("vaga_id", vagaId).eq("status", "secondary_motor_on").lt("inicio", diaSeguinte(b.fim)).gt("fim", b.inicio).order("id").range(de, a),
    ).catch(() => null),
  ]);
  return { eventos: validarEventosIndisp(eventos), dias: validarVagaDias(dias), motor: motor == null ? null : validarTrechosMotor(motor) };
}

export interface Carga<T> {
  dados: T | null;
  carregando: boolean;
  erro: string | null;
}

/** Lê uma vez por chave (null = nada a ler). `ler` precisa ser estável (função do módulo). */
function useLeitura<T>(chave: string | null, ler: (chave: string) => Promise<T>): Carga<T> {
  const [r, setR] = useState<{ chave: string | null; dados: T | null; erro: string | null }>({ chave: null, dados: null, erro: null });
  useEffect(() => {
    if (chave == null) return;
    let vivo = true;
    ler(chave).then(
      (dados) => vivo && setR({ chave, dados, erro: null }),
      (e: unknown) => vivo && setR({ chave, dados: null, erro: e instanceof Error ? e.message : String(e) }),
    );
    return () => {
      vivo = false;
    };
  }, [chave, ler]);
  const atual = chave != null && r.chave === chave;
  return { dados: atual ? r.dados : null, erro: atual ? r.erro : null, carregando: chave != null && !atual };
}

const lerTodos = () => lerBoletins();
const lerVagasPorCod = (cod: string) => lerVagasBoletim(cod);
const lerDetalhePorChave = (chave: string) => {
  const [cod, inicio, fim, vagaId] = JSON.parse(chave) as [string, string, string, number];
  return lerDetalheVaga({ cod, identificacao: "", inicio, fim }, vagaId);
};

export const useBoletins = () => useLeitura("boletins", lerTodos);
export const useVagasBoletim = (cod: string | null) => useLeitura(cod, lerVagasPorCod);
export const useDetalheVaga = (b: Boletim | null, vagaId: number | null) =>
  useLeitura(b && vagaId != null ? JSON.stringify([b.cod, b.inicio, b.fim, vagaId]) : null, lerDetalhePorChave);
