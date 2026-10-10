"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Apontamento } from "@/components/historico/apontamento";
import { ControlesPlayer, InfoPlayer } from "@/components/historico/barra-tempo";
import { ListaCapitulos } from "@/components/historico/capitulos";
import { FaixaDia } from "@/components/historico/faixa-dia";
import { TAMANHOS_REGUA, TrilhasDia, type TamanhoRegua } from "@/components/historico/trilhas-dia";
import { Icone } from "@/components/icones";
import { Alca } from "@/components/trilhas/alca";
import { Botao, Selecao, cx } from "@/components/ui";
import { proximoCapitulo } from "@/lib/dominio/capitulos";
import { DIA, ampliar, janelaDeHoras, janelaDosTrechos, type Janela } from "@/lib/dominio/trilhas";
import { useCelular, useMedida, useOpcao, usePreferencia } from "@/lib/hooks";
import { useConteudoDia, type PropsConteudo } from "./conteudo";
import { BotaoFunil, PainelOpcoes } from "./opcoes";
import { CartaoAgora, SecoesDoDia } from "./partes";

// painel das trilhas: abaixo disto ao soltar, recolhe; no máximo 60% da altura da janela
const MIN_PAINEL = 64;
const maxPainel = () => (typeof window === "undefined" ? 400 : Math.round(window.innerHeight * 0.6));

/**
 * Timeline clássica (voltou a pedido do dono em 07/10/2026). Em cima, o mesmo filtro minimalista da nova (cartão do
 * horário e funil); embaixo, o painel de trilhas que se arrasta (capítulos, onde estava, motor pelo GAUSS, tablet).
 * No celular, a faixa do dia com o player. Use com key do histórico.
 */
export function ConteudoClassico(props: PropsConteudo) {
  const { h, placa, tipo, vaga, motorista, pronto, sobreMapa, trechoSel, opcoes, abrirOpcoes, fecharOpcoes, formulario } = props;
  const celular = useCelular();
  const [foco, setFoco] = useState<[number, number] | null>(null);
  const { player, gauss, historia, agora, produtivo, atual, irCapitulo, escolherTrecho, ondeEsta } = useConteudoDia(props, foco);
  const { trecho, tocando, irPara } = player;
  const [verCapitulos, setVerCapitulos] = useState(false);
  const prox = proximoCapitulo(historia.capitulos, player.t);
  // painel de baixo: altura guardada, a que acompanha o arrasto (sem animação) e recolhido
  const [alturaGuardada, guardarAltura] = useMedida("mon-trilhas-px", 200, MIN_PAINEL, 2000);
  const [arrastando, setArrastando] = useState<number | null>(null);
  const [recolhido, setRecolhido] = usePreferencia("mon-trilhas-recolhido");
  const [regua, setRegua] = useOpcao<TamanhoRegua>("mon-regua-tamanho", TAMANHOS_REGUA, "normal");
  const registros = useMemo(() => janelaDosTrechos(h.trechos), [h.trechos]);
  const [janela, setJanela] = useState<Janela>(registros);
  const [apontamento, setApontamento] = useState(false);

  // acompanha na lista o capítulo em que o caminhão está
  useEffect(() => {
    if (tocando && atual) document.querySelector(`[data-capitulo="${atual}"]`)?.scrollIntoView({ block: "nearest" });
  }, [atual, tocando]);

  const andou = tocando || player.t > player.t0 || trechoSel != null;
  const motorAgora = agora.status?.rotulo ?? null;
  const botaoProximo = prox && (
    <Botao variante="secundaria" tamanho="mini" onClick={() => irCapitulo(prox)}>
      <Icone nome="proximo" className="h-4 w-4" />
      Próximo capítulo
    </Botao>
  );

  const alturaPainel = arrastando ?? (recolhido ? 0 : alturaGuardada);
  const diaInteiro = janela[0] === 0 && janela[1] === DIA;
  const soRegistros = janela[0] === registros[0] && janela[1] === registros[1];
  const de = Math.floor(janela[0] / 3600);
  const ate = Math.ceil(janela[1] / 3600);
  const filtroHora = (
    <span className="flex items-center gap-1 text-xs text-suave">
      De
      <Selecao value={de} onChange={(e) => setJanela(janelaDeHoras(Number(e.target.value), ate))} aria-label="Mostrar a partir de" className="h-8 w-[88px] text-[13px]">
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i} value={i}>
            {i}h
          </option>
        ))}
      </Selecao>
      até
      <Selecao value={ate} onChange={(e) => setJanela(janelaDeHoras(de, Number(e.target.value)))} aria-label="Mostrar até" className="h-8 w-[88px] text-[13px]">
        {Array.from({ length: 24 }, (_, i) => (
          <option key={i + 1} value={i + 1}>
            {i + 1}h
          </option>
        ))}
      </Selecao>
    </span>
  );

  // embaixo: no celular a faixa do dia com o player; no computador o painel de trilhas
  const baixo = celular ? (
    <div className="absolute inset-x-2 bottom-2 z-[600] max-h-[55%] overflow-y-auto rounded-2xl border border-borda bg-superficie/95 p-3 shadow-xl">
      <InfoPlayer player={player} motor={motorAgora} />
      <div className="my-2">
        <FaixaDia g={gauss.dados} historia={historia} player={player} foco={foco} mudarFoco={setFoco} />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <ControlesPlayer player={player} />
        {botaoProximo}
        <Botao variante="secundaria" tamanho="mini" onClick={() => setVerCapitulos((x) => !x)} aria-expanded={verCapitulos}>
          Capítulos ({historia.capitulos.length})
        </Botao>
      </div>
      {verCapitulos && (
        <div className="mt-2 border-t border-borda">
          <ListaCapitulos capitulos={historia.capitulos} atual={atual} foco={foco} escolher={irCapitulo} />
        </div>
      )}
    </div>
  ) : (
    <section aria-label="Timeline do veículo" className="absolute inset-x-3 bottom-3 z-[600] rounded-xl border border-borda bg-superficie shadow-xl">
      <Alca
        altura={alturaPainel}
        maximo={maxPainel()}
        mudando={(px) => {
          if (recolhido && px > 0) setRecolhido(false);
          setArrastando(px);
        }}
        soltar={(px) => {
          setArrastando(null);
          // soltou quase fechado: recolhe (e guarda a altura de antes para quando expandir)
          if (px < MIN_PAINEL) setRecolhido(true);
          else {
            setRecolhido(false);
            guardarAltura(px);
          }
        }}
        rotulo="Altura das trilhas"
      />
      <div className="flex flex-wrap items-center gap-2 px-3 pb-2">
        <Botao variante="secundaria" tamanho="mini" onClick={() => setRecolhido(!recolhido)} aria-expanded={!recolhido} aria-label={recolhido ? "Expandir trilhas" : "Recolher trilhas"} title={recolhido ? "Expandir trilhas" : "Recolher trilhas"}>
          {recolhido ? "▴ Expandir" : "▾ Recolher"}
        </Botao>
        <ControlesPlayer player={player} />
        {botaoProximo}
        <InfoPlayer player={player} motor={motorAgora} />
        <span className="ml-auto flex flex-wrap items-center gap-1.5">
          {filtroHora}
          <Botao variante="secundaria" tamanho="mini" aria-pressed={regua === "grande"} title="Horários maiores na régua" onClick={() => setRegua(regua === "grande" ? "normal" : "grande")} className={cx(regua === "grande" && "border-primaria bg-primaria-suave")}>
            A+
          </Botao>
          {foco && (
            <>
              <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(ampliar(foco))}>
                Ampliar o foco
              </Botao>
              <Botao variante="discreta" tamanho="mini" onClick={() => setFoco(null)}>
                ✕ Limpar foco
              </Botao>
            </>
          )}
          {!soRegistros && (
            <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela(registros)}>
              Horas com registro
            </Botao>
          )}
          {!diaInteiro && (
            <Botao variante="secundaria" tamanho="mini" onClick={() => setJanela([0, DIA])}>
              Dia inteiro
            </Botao>
          )}
          <Botao variante="secundaria" tamanho="mini" onClick={() => setApontamento(true)}>
            Apontamento
          </Botao>
        </span>
      </div>
      <div
        data-testid="corpo-trilhas"
        className="overflow-hidden px-3"
        // enquanto arrasta, a altura segue o ponteiro sem atraso; recolher/expandir tem animação curta
        style={{ height: alturaPainel, transition: arrastando != null ? "none" : "height 180ms ease" }}
      >
        <div className="pb-2">
          <TrilhasDia historia={historia} player={player} janela={janela} alturaPx={Math.max(alturaPainel - 16, MIN_PAINEL)} regua={regua} foco={foco} mudarFoco={setFoco} atual={atual} irCapitulo={irCapitulo} gauss={gauss.dados} mudarJanela={setJanela} />
          {gauss.erro && <p className="mt-1 text-[10px] text-suave">motor do GAUSS e tablet não carregaram: {gauss.erro}</p>}
        </div>
      </div>
    </section>
  );

  return (
    <>
      {sobreMapa &&
        createPortal(
          <>
            <CartaoAgora placa={placa} player={player} ondeEsta={ondeEsta} agora={agora} abrir={abrirOpcoes} />
            <BotaoFunil abrir={abrirOpcoes} />
            {baixo}
          </>,
          sobreMapa,
        )}
      {opcoes && (
        <PainelOpcoes fechar={fecharOpcoes} formulario={formulario} pronto={pronto}>
          <SecoesDoDia
            h={h}
            historia={historia}
            gauss={gauss}
            produtivo={produtivo}
            info={[tipo, vaga, motorista && `Motorista: ${motorista}`].filter(Boolean).join(" · ")}
            agora={agora}
            abrirApontamento={() => {
              fecharOpcoes();
              setApontamento(true);
            }}
            irPara={(s) => {
              fecharOpcoes();
              irPara(s, true);
            }}
          />
        </PainelOpcoes>
      )}
      {apontamento && (
        <Apontamento
          h={h}
          placa={placa}
          historia={historia}
          atual={atual}
          foco={foco}
          irCapitulo={irCapitulo}
          trechoSel={andou && trecho >= 0 ? trecho : null}
          escolherTrecho={escolherTrecho}
          fechar={() => setApontamento(false)}
        />
      )}
    </>
  );
}
