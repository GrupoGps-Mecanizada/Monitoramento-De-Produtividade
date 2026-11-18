"use client";

import { useMemo, useState } from "react";
import { AbasTexto } from "@/app/gestao-alertas/_componentes/comum";
import { Aviso, Vazio } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { useMotorFrota } from "@/lib/dados/gauss-dia";
import { duplicados, montarDiaVagas, type LinhaVaga } from "@/lib/dominio/dia-vaga";
import { diaLocal, fmtHoras, idadeCurta, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { useAgora } from "@/lib/hooks";
import { DiaVagas, LegendaGauss, TrechosDaVaga, vagaCurtaNome } from "./dia-vagas";

type Tipo = "todas" | "ap" | "av" | "hv";
const TIPOS: { id: Exclude<Tipo, "todas">; rotulo: string }[] = [
  { id: "ap", rotulo: "Alta Pressão" },
  { id: "av", rotulo: "Auto Vácuo" },
  { id: "hv", rotulo: "Hiper Vácuo" },
];
const LIGADO = new Set(["on", "stopped", "secondary_motor_on"]);
const DESLIGADO = new Set(["off", "main_switch_off"]);

/** "22 vagas · 9 ligadas agora · 7 desligadas · 6 sem caminhão · todas iguais ao GAUSS" (como os números da Gestão de alertas). */
function Numeros({ vagas, hoje }: { vagas: LinhaVaga[]; hoje: boolean }) {
  const divergentes = vagas.filter((v) => v.conferencia && !v.conferencia.ok).length;
  const semConf = vagas.filter((v) => !v.conferencia).length;
  const itens: [number | string, string, boolean?][] = [[vagas.length, vagas.length === 1 ? "vaga" : "vagas"]];
  if (hoje) {
    itens.push([vagas.filter((v) => v.agora && LIGADO.has(v.agora.cod)).length, "ligadas agora"]);
    itens.push([vagas.filter((v) => v.agora && DESLIGADO.has(v.agora.cod)).length, "desligadas"]);
    itens.push([vagas.filter((v) => !v.agora?.veiculo).length, "sem caminhão"]);
  } else {
    itens.push([fmtHoras(vagas.reduce((n, v) => n + v.ligado_min, 0)), "de motor ligado"]);
  }
  if (divergentes) itens.push([divergentes, "diferentes do GAUSS", true]);
  else if (!semConf && vagas.length) itens.push(["✓", "todas iguais ao GAUSS"]);
  if (semConf) itens.push([semConf, "sem conferência"]);
  return (
    <p className="text-sm text-suave">
      {itens.map(([n, t, ruim], i) => (
        <span key={t}>
          {i > 0 && <span className="mx-2">·</span>}
          <b className="tabular-nums text-texto" style={ruim ? { color: corDoTom("bad") } : undefined}>
            {n}
          </b>{" "}
          {t}
        </span>
      ))}
    </p>
  );
}

/**
 * Dia da frota (16/10/2026, pedido do dono): só por vaga, no desenho da Gestão de alertas — página branca, abas em
 * cascata (tipo → vaga), números em linha e o dia numa pílula. É o espelho da "Timeline Tempo de Motor (Vaga)" do GAUSS
 * (as 22 vagas da Mecanizada); escolhendo a vaga aparecem os trechos dela.
 */
export function DiaFrota() {
  const agora = useAgora();
  const [hoje] = useState(() => diaLocal());
  const [dia, setDia] = useState(hoje);
  const [tipo, setTipo] = useState<Tipo>("todas");
  const [vaga, setVaga] = useState<string | null>(null);
  const ehHoje = dia === hoje;
  const { linhas, conferencias, gravadoEm, carregando, erro } = useMotorFrota(dia, ehHoje);
  const agoraSeg = ehHoje && agora ? (agora - new Date(`${dia}T00:00:00`).getTime()) / 1000 : null;
  const todas = useMemo(() => montarDiaVagas(linhas, dia, agoraSeg, conferencias), [linhas, dia, agoraSeg, conferencias]);
  const dup = useMemo(() => duplicados(todas), [todas]);
  const dias = useMemo(() => ultimosDias(30), []);
  const doTipo = tipo === "todas" ? todas : todas.filter((v) => v.tipo === tipo);
  const escolhida = doTipo.find((v) => v.vaga_id === vaga) ?? null;
  const vistas = escolhida ? [escolhida] : doTipo;
  const mudarTipo = (t: Tipo) => {
    setTipo(t);
    setVaga(null);
  };
  const escolher = (id: string) => {
    const v = todas.find((x) => x.vaga_id === id);
    if (v?.tipo && tipo === "todas") setTipo(v.tipo as Tipo);
    setVaga((atual) => (atual === id ? null : id));
  };

  return (
    // página toda branca, separada só por linhas finas e espaço (o desenho da Gestão de alertas)
    <div className="min-h-[calc(100dvh-64px)] w-full bg-superficie pb-24 md:pb-12">
      <header className="border-b border-borda">
        <div className="mx-auto flex max-w-[1400px] flex-wrap items-end gap-3 px-4 pt-3 md:px-10">
          <AbasTexto<Tipo>
            grande
            semLinha
            rotulo="Tipo de vaga"
            valor={tipo}
            mudar={mudarTipo}
            abas={[{ id: "todas", rotulo: "Todas", n: todas.length }, ...TIPOS.map((t) => ({ ...t, n: todas.filter((v) => v.tipo === t.id).length }))]}
          />
          <label className="mb-2 ml-auto inline-flex h-7 items-center gap-1 rounded-full border border-transparent bg-primaria-suave pl-3 pr-1 text-[13px]">
            <span className="text-suave">Dia</span>
            <select
              aria-label="Dia"
              value={dia}
              onChange={(e) => {
                setDia(e.target.value);
                setVaga(null);
              }}
              className="cursor-pointer appearance-none bg-transparent pr-1 font-medium text-texto outline-none"
            >
              {dias.map((d) => (
                <option key={d} value={d}>
                  {rotuloDia(d, hoje)}
                </option>
              ))}
            </select>
            <span aria-hidden className="text-suave">
              ▾
            </span>
          </label>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[1400px] space-y-6 px-4 pt-6 md:px-10 md:pt-8">
        {tipo !== "todas" && doTipo.length > 0 && (
          <AbasTexto<string>
            rotulo="Vaga"
            valor={vaga ?? "todas"}
            mudar={(id) => setVaga(id === "todas" ? null : id)}
            abas={[{ id: "todas", rotulo: "Todas" }, ...doTipo.map((v) => ({ id: v.vaga_id, rotulo: vagaCurtaNome(v.nome) }))]}
          />
        )}
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
          <Numeros vagas={vistas} hoje={ehHoje} />
          <span className="text-xs text-suave">{gravadoEm ? `timeline de motor do GAUSS · atualizada ${idadeCurta(gravadoEm, agora ?? undefined)}` : "timeline de motor do GAUSS"}</span>
        </div>
        {erro && <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>}
        {dup.length > 0 && (
          <Aviso tipo="alerta">
            No próprio GAUSS, caminhão apropriado em duas vagas ao mesmo tempo: {dup.map((d) => `${d.placa} (${d.vagas.map(vagaCurtaNome).join(" e ")}, ${fmtHoras(d.min)})`).join("; ")}. Corrija a
            apropriação no GAUSS.
          </Aviso>
        )}
        {carregando && !linhas.length ? (
          <Vazio titulo="Carregando o dia da frota…" />
        ) : !todas.length ? (
          <Vazio titulo="Sem timeline de motor neste dia">O coletor ainda não gravou nenhuma vaga.</Vazio>
        ) : (
          <>
            <LegendaGauss vagas={vistas} />
            <DiaVagas vagas={vistas} dia={dia} agoraSeg={agoraSeg} escolhida={escolhida?.vaga_id ?? null} escolher={escolher} />
            {escolhida && <TrechosDaVaga v={escolhida} dia={dia} />}
          </>
        )}
      </div>
    </div>
  );
}
