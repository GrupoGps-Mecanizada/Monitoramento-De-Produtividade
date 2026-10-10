"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Andamento } from "@/components/historico/andamento";
import { useMapa } from "@/components/mapa/use-mapa";
import { Aviso, Botao, Selecao, Vazio } from "@/components/ui";
import { pedirHistorico, type EtapaPedido } from "@/lib/dados/historico";
import { useRetrato } from "@/lib/dados/use-retrato";
import { TIPOS_EQUIP, compararEquip, nomeEquip } from "@/lib/dominio/equipamentos";
import { diaBR, diaLocal, rotuloDia, ultimosDias } from "@/lib/dominio/formato";
import { resolverVeiculo, semMotor2 } from "@/lib/dominio/veiculo";
import { pontosDoTrecho } from "@/lib/mapa/rota";
import type { Historico } from "@/lib/tipos";
import { ConteudoHistorico } from "./conteudo";
import { ConteudoClassico } from "./conteudo-classica";
import { BotaoFunil, CartaoTopo, PainelOpcoes } from "./opcoes";
import { SeletorVeiculo } from "./seletor-veiculo";
import { TrocaVisual, useVisualTimeline } from "./troca-visual";

type Carga = { etapa: EtapaPedido | "buscando"; desde: number } | null;

/**
 * Timeline: trajeto de um veículo num dia, com player. Endereço: /timeline/?v=<id ou placa>&dia=AAAA-MM-DD
 * O mapa ocupa a tela toda (computador e celular); veículo, dia e opções ficam no funil. Embaixo, a linha fina do dia
 * (nova) ou o painel de trilhas (clássica, que voltou a pedido do dono em 07/10/2026): a pessoa escolhe no funil.
 */
export function Timeline() {
  const params = useSearchParams();
  const { retrato } = useRetrato();
  const { ref, pronto } = useMapa(13);
  const [sobreMapa, setSobreMapa] = useState<HTMLDivElement | null>(null);
  const [hoje] = useState(() => diaLocal());
  const [chave, setChave] = useState<string | null>(() => params.get("v"));
  const [dia, setDia] = useState(() => params.get("dia") || hoje);
  const [pedido, setPedido] = useState<{ chave: string; dia: string; n: number } | null>(() => {
    const v = params.get("v");
    return v ? { chave: v, dia: params.get("dia") || hoje, n: 0 } : null;
  });
  const [carga, setCarga] = useState<Carga>(() => (params.get("v") ? { etapa: "buscando", desde: 0 } : null));
  const [hist, setHist] = useState<Historico | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [trechoSel, setTrechoSel] = useState<{ i: number; vez: number } | null>(null);
  // funil (veículo, dia e opções): já aberto quando não veio veículo no endereço
  const [opcoes, setOpcoes] = useState(() => !params.get("v"));
  // nova: linha fina do dia embaixo; clássica: painel de trilhas embaixo (o filtro é o mesmo)
  const [visual] = useVisualTimeline();

  const todos = retrato?.veiculos;
  const lista = useMemo(() => semMotor2(todos ?? []).sort(compararEquip), [todos]);
  const escolhido = useMemo(() => (chave && todos ? resolverVeiculo(todos, chave) : null), [chave, todos]);
  const alvo = useMemo(() => (pedido && todos ? resolverVeiculo(todos, pedido.chave) : null), [pedido, todos]);
  const alvoId = alvo?.id ?? null;
  // a rota do GAUSS existe para qualquer dia: oferece os últimos 30
  const dias = useMemo(() => {
    const d = ultimosDias(30);
    return d.includes(dia) ? d : [dia, ...d];
  }, [dia]);

  // pede o histórico (o coletor atende se o dia ainda não está no banco)
  useEffect(() => {
    if (!pedido || !alvoId) return;
    const c = new AbortController();
    const desde = Date.now();
    pedirHistorico(alvoId, pedido.dia, { sinal: c.signal, aoAndar: (etapa) => setCarga({ etapa, desde }) }).then(
      (h) => {
        if (c.signal.aborted) return;
        setHist(h);
        setCarga(null);
      },
      (e: unknown) => {
        if (c.signal.aborted) return;
        setErro(e instanceof Error ? e.message : String(e));
        setCarga(null);
      },
    );
    return () => c.abort();
  }, [pedido, alvoId]);

  const ver = () => {
    if (!escolhido) return;
    setHist(null);
    setErro(null);
    setTrechoSel(null);
    setOpcoes(false);
    setCarga({ etapa: "buscando", desde: Date.now() });
    setPedido((p) => ({ chave: escolhido.id, dia, n: (p?.n ?? 0) + 1 }));
  };
  const focarTrecho = useCallback((i: number) => setTrechoSel((t) => ({ i, vez: (t?.vez ?? 0) + 1 })), []);

  // mapa limpo: zoom pela roda do mouse ou pinça; a camada (satélite/ruas) troca no funil
  useEffect(() => {
    pronto?.mapa.zoomControl.remove();
  }, [pronto]);
  // a rota e os capítulos são desenhados pelo ConteudoHistorico; aqui só enquadra o dia
  useEffect(() => {
    if (!pronto || !hist?.pontos.length) return;
    pronto.mapa.fitBounds(pronto.L.latLngBounds(hist.pontos.map((p): [number, number] => [p[0], p[1]])).pad(0.06));
  }, [pronto, hist]);
  useEffect(() => {
    if (!pronto || !hist || !trechoSel) return;
    const pts = pontosDoTrecho(hist, trechoSel.i);
    const t = hist.trechos[trechoSel.i];
    if (pts.length > 1) pronto.mapa.fitBounds(pronto.L.latLngBounds(pts).pad(0.2), { maxZoom: 18 });
    else if (t && t.estado !== "movimento" && t.lat != null && t.lng != null) pronto.mapa.flyTo([t.lat, t.lng], 17);
  }, [pronto, hist, trechoSel]);

  const naoAchado = !!pedido && !!todos && !alvo;
  const placa = alvo ? nomeEquip(alvo) : (hist?.id ?? "");
  const situacao = naoAchado ? (
    <Vazio titulo="Veículo não encontrado">O endereço aponta para um veículo que não está mais na frota.</Vazio>
  ) : carga ? (
    <Andamento etapa={carga.etapa} desde={carga.desde} />
  ) : erro ? (
    <div className="p-4">
      <Aviso tipo="erro">Não foi possível carregar: {erro}</Aviso>
    </div>
  ) : !hist ? (
    <Vazio titulo="Selecione um veículo">Escolha a placa e o dia para ver a rota e o apontamento completo.</Vazio>
  ) : !hist.trechos.length ? (
    <Vazio titulo="Sem dados neste dia">
      O GAUSS não tem posições para {placa} em {diaBR(hist.dia)}.
    </Vazio>
  ) : null;

  const formulario = (
    <div className="space-y-2.5">
      <SeletorVeiculo veiculos={lista} escolhido={escolhido} escolher={(v) => setChave(v.id)} paraCima={false} />
      <Selecao value={dia} onChange={(e) => setDia(e.target.value)} aria-label="Dia" className="w-full">
        {dias.map((d) => (
          <option key={d} value={d}>
            {rotuloDia(d, hoje)}
          </option>
        ))}
      </Selecao>
      <Botao onClick={ver} disabled={!escolhido || !!carga} className="w-full">
        Ver timeline
      </Botao>
      <TrocaVisual />
    </div>
  );
  const abrirOpcoes = () => setOpcoes(true);
  const fecharOpcoes = () => setOpcoes(false);
  const Conteudo = visual === "classica" ? ConteudoClassico : ConteudoHistorico;
  const conteudo =
    hist && hist.trechos.length > 0 && !carga ? (
      <Conteudo
        key={`${hist.id}|${hist.dia}|${hist.baixado_em}`}
        h={hist}
        placa={placa}
        placaGauss={alvo?.placa ?? ""}
        tipoEquip={alvo?.equip?.tipo}
        tipo={alvo?.equip ? TIPOS_EQUIP[alvo.equip.tipo].rotulo : ""}
        vaga={alvo?.vaga ?? ""}
        motorista={hist.dia === hoje ? alvo?.motorista || null : null}
        pronto={pronto}
        sobreMapa={sobreMapa}
        trechoSel={trechoSel?.i ?? null}
        focarTrecho={focarTrecho}
        opcoes={opcoes}
        abrirOpcoes={abrirOpcoes}
        fecharOpcoes={fecharOpcoes}
        formulario={formulario}
      />
    ) : null;

  return (
    <div className="altura-tela relative overflow-hidden">
      <div ref={ref} className="absolute inset-0" />
      <div ref={setSobreMapa} className="pointer-events-none absolute inset-0 z-[500] [&>*]:pointer-events-auto" />
      {!conteudo && (
        <>
          <CartaoTopo abrir={abrirOpcoes}>
            {escolhido ? (
              <>
                <b className="text-[14px]">{nomeEquip(escolhido)}</b> {rotuloDia(dia, hoje)}
              </>
            ) : (
              "Escolher veículo"
            )}
          </CartaoTopo>
          <BotaoFunil abrir={abrirOpcoes} />
          {opcoes && <PainelOpcoes fechar={fecharOpcoes} formulario={formulario} pronto={pronto} />}
        </>
      )}
      {situacao && (
        <div className="absolute left-1/2 top-1/2 z-[600] w-[min(380px,calc(100%-24px))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-borda bg-superficie/95 shadow-xl">
          {situacao}
          {!carga && !hist?.trechos.length && (
            <div className="px-3 pb-3">
              <Botao variante="secundaria" className="w-full" onClick={abrirOpcoes}>
                Escolher veículo e dia
              </Botao>
            </div>
          )}
        </div>
      )}
      {conteudo}
    </div>
  );
}
