"use client";

import type { SupabaseClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";
import type { ParadaAnalise } from "../dominio/analise";
import { diaLocal } from "../dominio/formato";
import { mapaVagaDoDia, type VagaDoDia } from "../dominio/supervisor-vaga";
import { db, ok } from "../supabase/cliente";
import { validarParadasAnalise } from "./esquemas";

// 30 dias ≈ 11 mil paradas; o Supabase entrega no máximo 1000 linhas por consulta
const PAGINA = 1000;
const MAX = 30000;

/** Todas as paradas guardadas (a tabela só tem os últimos 30 dias), em páginas; com `dia`, só as daquele dia. */
export async function lerParadasAnalise(c: SupabaseClient = db(), dia?: string): Promise<ParadaAnalise[]> {
  const out: ParadaAnalise[] = [];
  for (let de = 0; de < MAX; de += PAGINA) {
    let q = c.from("analise_paradas").select("dia, veiculo_id, placa, ini, fim, lat, lng, area, motor, apont");
    if (dia) q = q.eq("dia", dia);
    // id desempata: as páginas não repetem nem pulam linhas
    const pag = (await ok(q.order("id").range(de, de + PAGINA - 1))) as unknown[];
    out.push(...validarParadasAnalise(pag));
    if (pag.length < PAGINA) break;
  }
  return out;
}

/** Troca as paradas de um dia pelas novas, mantendo os outros dias. */
export const juntarDia = (paradas: ParadaAnalise[], dia: string, novas: ParadaAnalise[]) => [...paradas.filter((p) => p.dia !== dia), ...novas];

let cache: Promise<ParadaAnalise[]> | null = null;
/** Uma leitura por aba (os dados mudam uma vez por dia). Falha não fica guardada. */
function emCache(): Promise<ParadaAnalise[]> {
  cache ??= lerParadasAnalise().catch((e: unknown) => {
    cache = null;
    throw e;
  });
  return cache;
}

// o coletor regrava as paradas de hoje a cada 10 min (tempo real): a tela relê no mesmo ritmo, SÓ o dia de hoje
// (os outros dias não mudam) e só com a aba à vista — poupa a cota grátis de saída de dados do Supabase
const RELER_MS = 10 * 60 * 1000;

export function useParadasAnalise(): { paradas: ParadaAnalise[]; carregando: boolean; erro: string | null } {
  const [estado, setEstado] = useState<{ paradas: ParadaAnalise[]; carregando: boolean; erro: string | null }>({ paradas: [], carregando: true, erro: null });
  useEffect(() => {
    let vivo = true;
    const ler = () =>
      emCache().then(
        (paradas) => vivo && setEstado({ paradas, carregando: false, erro: null }),
        // falha numa releitura: mantém o que já estava na tela
        (e: unknown) => vivo && setEstado((s) => ({ paradas: s.paradas, carregando: false, erro: s.paradas.length ? null : e instanceof Error ? e.message : String(e) })),
      );
    void ler();
    const t = setInterval(() => {
      if (document.hidden) return;
      const hoje = diaLocal();
      lerParadasAnalise(db(), hoje).then(
        (novas) => {
          if (!vivo) return;
          setEstado((s) => ({ ...s, paradas: juntarDia(s.paradas, hoje, novas) }));
          cache = null; // outra montagem relê tudo
        },
        () => undefined, // falha numa releitura: fica o que já está na tela
      );
    }, RELER_MS);
    return () => {
      vivo = false;
      clearInterval(t);
    };
  }, []);
  return estado;
}

/**
 * Em que vaga cada caminhão esteve em cada dia (view vaga_do_dia, da timeline de motor por vaga): o supervisor é da
 * vaga, não da placa. Uma leitura por aba. Sem a view (SQL não rodado) ou com falha, volta vazio e vale a matriz.
 */
let cacheVagas: Promise<Map<string, string>> | null = null;
export function lerVagaDoDia(c: SupabaseClient = db()): Promise<Map<string, string>> {
  const d = new Date();
  d.setDate(d.getDate() - 31);
  cacheVagas ??= (async () => {
    const linhas: VagaDoDia[] = [];
    for (let de = 0; de < MAX; de += PAGINA) {
      const pag = (await ok(
        c.from("vaga_do_dia").select("dia, veiculo_id, vaga_nome, minutos").gte("dia", diaLocal(d)).order("dia").order("veiculo_id").order("vaga_nome").range(de, de + PAGINA - 1),
      )) as VagaDoDia[];
      linhas.push(...pag.map((l) => ({ ...l, minutos: Number(l.minutos) })));
      if (pag.length < PAGINA) break;
    }
    return mapaVagaDoDia(linhas);
  })().catch(() => {
    cacheVagas = null;
    return new Map<string, string>();
  });
  return cacheVagas;
}

export function useVagaDoDia(): Map<string, string> {
  const [mapa, setMapa] = useState<Map<string, string>>(() => new Map());
  useEffect(() => {
    let vivo = true;
    lerVagaDoDia().then((m) => vivo && setMapa(m));
    return () => {
      vivo = false;
    };
  }, []);
  return mapa;
}
