"use client";

import { useEffect, useState } from "react";
import { diaMenos } from "../dominio/analise";
import type { EntradaExcecoes } from "../dominio/excecoes";
import { lerMotorFrotaDia, lerTabletFrotaDia } from "./gauss-dia";
import { lerEventos } from "./leituras";
import { db, ok } from "../supabase/cliente";

type Dados = Omit<EntradaExcecoes, "dia" | "agoraSeg" | "veiculos">;

/** Excessos de velocidade do dia (madrugada). Tabela ainda não criada ou falha: lista vazia (a tela segue). */
async function lerExcessos(dia: string): Promise<NonNullable<EntradaExcecoes["excessos"]>> {
  try {
    return ((await ok(db().from("analise_excessos").select("dia, veiculo_id, ini, fim, vel_max, lat, lng").eq("dia", dia).limit(2000))) ?? []) as NonNullable<EntradaExcecoes["excessos"]>;
  } catch {
    return [];
  }
}

/** Exceções do dia: eventos de área, motor e tablet da véspera e do dia (só o Supabase); hoje relê a cada 5 min. */
export function useExcecoesDados(dia: string, hoje: boolean): { dados: Dados | null; erro: string | null } {
  const [estado, setEstado] = useState<{ dia: string | null; dados: Dados | null; erro: string | null }>({ dia: null, dados: null, erro: null });
  useEffect(() => {
    let vivo = true;
    const vespera = diaMenos(dia, 1);
    const ler = () =>
      Promise.all([lerEventos(vespera), lerEventos(dia), lerMotorFrotaDia(vespera), lerMotorFrotaDia(dia), lerTabletFrotaDia(vespera), lerTabletFrotaDia(dia), lerExcessos(dia)]).then(
        ([ev1, ev2, m1, m2, t1, t2, excessos]) => vivo && setEstado({ dia, dados: { eventos: [...ev1, ...ev2], motor: [...m1.linhas, ...m2.linhas], tablet: [...t1, ...t2], excessos }, erro: null }),
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
  return { dados: doDia ? estado.dados : null, erro: doDia ? estado.erro : null };
}
