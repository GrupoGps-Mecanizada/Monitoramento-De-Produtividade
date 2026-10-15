"use client";

import { useMemo, useState } from "react";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Botao, Entrada, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { salvarPolitica, salvarRegra, type ConfigGestao } from "@/lib/dados/alertas";
import type { ConfigRegra, FamiliaJust, Politica } from "@/lib/dominio/alertas/config";
import { ROTULO_DESTINO } from "@/lib/dominio/alertas/fila";
import { simular, sugestoes, type AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { diaMenos } from "@/lib/dominio/analise";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { ROTULO_FAMILIA } from "@/lib/dominio/familias";
import { CampoNumero, TOM_DESTINO, erroTexto } from "./comum";

const FAMILIAS_JUST: FamiliaJust[] = ["manutencao", "preparacao", "aguardando", "pausas", "logistica"];
const DESTINOS: Destino[] = ["whatsapp", "resumo", "tela"];
const faixasTexto = (c: ConfigRegra) => (c.faixas.length ? [...c.faixas].sort((a, b) => a.acima_min - b.acima_min).map((f) => `>${f.acima_min} min +${f.pontos}`).join(" · ") : "—");

function Rotulado({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="text-suave">{rotulo}</span>
      {children}
    </label>
  );
}

/** Editor de uma regra (gaveta): peso, lembrete, faixas e justificativas. */
function EditorRegra({ c, mudar, fechar, travado }: { c: ConfigRegra; mudar: (c: ConfigRegra) => void; fechar: () => void; travado: boolean }) {
  return (
    <Gaveta titulo={ROTULO_REGRA[c.regra]} sub="As mudanças entram no simulador na hora; salvar fica na barra de baixo." fechar={fechar} modal={false} largura="min(480px, 100vw)">
      <fieldset disabled={travado} className="space-y-5 p-5">
        <label className="flex items-center gap-2 font-semibold">
          <input type="checkbox" checked={c.ativa} onChange={(e) => mudar({ ...c, ativa: e.target.checked })} />
          Regra ligada
        </label>
        <div className="flex flex-wrap gap-4">
          <Rotulado rotulo="Peso (0 a 100)">
            <CampoNumero valor={c.peso} mudar={(peso) => mudar({ ...c, peso })} aria-label="Peso" />
          </Rotulado>
          <Rotulado rotulo="Lembrete a cada (min)">
            <CampoNumero valor={c.lembrete_min} min={15} max={1440} mudar={(lembrete_min) => mudar({ ...c, lembrete_min })} aria-label="Lembrete em minutos" />
          </Rotulado>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">Faixas: pontos a mais quando passa de X minutos</p>
          {c.faixas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              acima de
              <CampoNumero valor={f.acima_min} max={1440} mudar={(acima_min) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? { ...x, acima_min } : x)) })} aria-label={`Faixa ${i + 1}: minutos`} />
              min, +
              <CampoNumero valor={f.pontos} mudar={(pontos) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? { ...x, pontos } : x)) })} aria-label={`Faixa ${i + 1}: pontos`} />
              pontos
              <Botao tamanho="mini" variante="discreta" onClick={() => mudar({ ...c, faixas: c.faixas.filter((_, k) => k !== i) })}>
                Tirar
              </Botao>
            </div>
          ))}
          <Botao tamanho="mini" variante="secundaria" onClick={() => mudar({ ...c, faixas: [...c.faixas, { acima_min: 30, pontos: 20 }] })}>
            + Faixa
          </Botao>
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">Apontamento no tablet tira pontos (vale o maior)</p>
          <div className="grid grid-cols-2 gap-3">
            {FAMILIAS_JUST.map((f) => (
              <Rotulado key={f} rotulo={ROTULO_FAMILIA[f]}>
                <CampoNumero valor={c.justificativas[f] ?? 0} mudar={(n) => mudar({ ...c, justificativas: { ...c.justificativas, [f]: n } })} aria-label={`Justificativa ${ROTULO_FAMILIA[f]}`} />
              </Rotulado>
            ))}
          </div>
        </div>
      </fieldset>
    </Gaveta>
  );
}

/** Barras antes × depois por destino. */
function Simulador({ alertas, regras, pol }: { alertas: AlertaGravado[]; regras: Record<RegraExcecao, ConfigRegra>; pol: Politica }) {
  const sim = useMemo(() => simular(alertas, regras, pol), [alertas, regras, pol]);
  const maior = Math.max(1, ...DESTINOS.flatMap((d) => [sim.antes[d], sim.depois[d]]));
  return (
    <section aria-label="Simulador" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
      <div>
        <p className="font-semibold">Simulador · últimos 7 dias</p>
        <p className="text-[13px] text-suave">
          {sim.total} alertas. {sim.mudaram ? `${sim.mudaram} mudariam de destino com o que você mexeu.` : "Mexa nas regras para ver o efeito antes de salvar."}
        </p>
      </div>
      {DESTINOS.map((d) => (
        <div key={d} className="space-y-1 text-[13px]">
          <div className="flex justify-between">
            <span>{ROTULO_DESTINO[d]}</span>
            <span className="tabular-nums">
              <span className="text-suave">{sim.antes[d]} →</span> <b>{sim.depois[d]}</b>
            </span>
          </div>
          <div className="space-y-0.5">
            <span className="block h-1.5 rounded-full bg-superficie-2">
              <span className="block h-full rounded-full opacity-40" style={{ width: `${(sim.antes[d] / maior) * 100}%`, background: corDoTom(TOM_DESTINO[d]) }} />
            </span>
            <span className="block h-1.5 rounded-full bg-superficie-2">
              <span className="block h-full rounded-full" style={{ width: `${(sim.depois[d] / maior) * 100}%`, background: corDoTom(TOM_DESTINO[d]) }} />
            </span>
          </div>
        </div>
      ))}
      {sim.porRegra.length > 0 && (
        <ul className="space-y-0.5 border-t border-borda pt-2 text-xs text-suave">
          {sim.porRegra.map((r) => (
            <li key={r.regra} className="flex justify-between">
              <span>{ROTULO_REGRA[r.regra as RegraExcecao] ?? r.regra}</span>
              <span className="tabular-nums">
                {r.antes} → {r.depois} no WhatsApp
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Aba Filtro inteligente: cortes, tabela das regras (edição em gaveta), simulador ao lado, sugestões e barra de salvar. */
export function Filtro({ alertas, config, hoje, logado, aoSalvar }: { alertas: AlertaGravado[]; config: ConfigGestao; hoje: string; logado: boolean; aoSalvar: () => void }) {
  const [base, setBase] = useState(config);
  const [regras, setRegras] = useState(config.regras);
  const [pol, setPol] = useState<Politica>(config.politica);
  const [editando, setEditando] = useState<RegraExcecao | null>(null);
  const [estado, setEstado] = useState<{ salvando: boolean; msg: { tipo: "ok" | "erro"; texto: string } | null }>({ salvando: false, msg: null });
  const semana = useMemo(() => alertas.filter((a) => a.dia >= diaMenos(hoje, 6)), [alertas, hoje]);
  const sugs = useMemo(() => sugestoes(alertas, hoje), [alertas, hoje]);
  const whatsPorRegra = useMemo(() => new Map(simular(semana, regras, pol).porRegra.map((r) => [r.regra, r.depois])), [semana, regras, pol]);
  const mudadas = REGRAS.filter((r) => JSON.stringify(regras[r]) !== JSON.stringify(base.regras[r]));
  const polMudou = JSON.stringify(pol) !== JSON.stringify(base.politica);
  const nMudancas = mudadas.length + (polMudou ? 1 : 0);
  const travado = !logado;
  const cortesErrados = pol.corte_resumo > pol.corte_whatsapp || pol.corte_whatsapp > pol.corte_coordenador;
  const horaOk = /^\d{2}:\d{2}$/.test(pol.resumo_hora);

  async function salvar() {
    setEstado({ salvando: true, msg: null });
    try {
      for (const r of mudadas) await salvarRegra(regras[r]);
      if (polMudou) await salvarPolitica(pol);
      // o salvo vira a nova base aqui mesmo: a mensagem não some quando a tela relê do banco
      setBase({ regras, politica: pol });
      setEstado({ salvando: false, msg: { tipo: "ok", texto: "Salvo. Vale a partir do próximo ciclo do robô (até 10 min)." } });
      aoSalvar();
    } catch (e) {
      setEstado({ salvando: false, msg: { tipo: "erro", texto: erroTexto(e) } });
    }
  }
  const desfazer = () => {
    setRegras(base.regras);
    setPol(base.politica);
    setEstado({ salvando: false, msg: null });
  };

  return (
    <div className="space-y-4 pb-16">
      {sugs.map((s) => (
        <Aviso key={s.regra} tipo="alerta">
          💡 {s.texto}
        </Aviso>
      ))}
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section aria-label="Cortes" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
            <p className="font-semibold">Cortes da nota</p>
            <fieldset disabled={travado} className="flex flex-wrap items-end gap-4">
              <Rotulado rotulo="WhatsApp a partir de">
                <CampoNumero valor={pol.corte_whatsapp} mudar={(n) => setPol({ ...pol, corte_whatsapp: n })} aria-label="Corte do WhatsApp" />
              </Rotulado>
              <Rotulado rotulo="Resumo a partir de">
                <CampoNumero valor={pol.corte_resumo} mudar={(n) => setPol({ ...pol, corte_resumo: n })} aria-label="Corte do resumo" />
              </Rotulado>
              <Rotulado rotulo="Coordenador a partir de">
                <CampoNumero valor={pol.corte_coordenador} mudar={(n) => setPol({ ...pol, corte_coordenador: n })} aria-label="Corte do coordenador" />
              </Rotulado>
              <Rotulado rotulo="Máx. mensagens/hora">
                <CampoNumero valor={pol.max_por_hora} min={1} max={60} mudar={(n) => setPol({ ...pol, max_por_hora: n })} aria-label="Máximo de mensagens por hora" />
              </Rotulado>
              <Rotulado rotulo="Resumo diário às">
                <Entrada type="time" required value={pol.resumo_hora} onChange={(e) => setPol({ ...pol, resumo_hora: e.target.value })} aria-label="Hora do resumo diário" />
              </Rotulado>
              <label className="flex items-center gap-2 pb-2 text-[13px]">
                <input type="checkbox" checked={pol.modo_teste} onChange={(e) => setPol({ ...pol, modo_teste: e.target.checked })} />
                Modo teste (tudo vai só para o destinatário de teste)
              </label>
            </fieldset>
            {cortesErrados && <Aviso tipo="alerta">Os cortes precisam subir: resumo ≤ WhatsApp ≤ coordenador.</Aviso>}
            {!horaOk && <Aviso tipo="alerta">Escolha a hora do resumo diário.</Aviso>}
          </section>
          <section aria-label="Regras" className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
            <table className="w-full text-[13px]">
              <thead className="text-left text-xs text-suave">
                <tr className="border-b border-borda">
                  <th className="px-3 py-2 font-medium">Ligada</th>
                  <th className="px-3 py-2 font-medium">Regra</th>
                  <th className="px-3 py-2 text-right font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">Faixas</th>
                  <th className="px-3 py-2 text-right font-medium">WhatsApp (7 dias)</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {REGRAS.map((r) => {
                  const c = regras[r];
                  return (
                    <tr key={r} className={cx("border-b border-borda last:border-b-0", mudadas.includes(r) && "bg-primaria-suave", !c.ativa && "text-suave")}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={c.ativa} disabled={travado} onChange={(e) => setRegras({ ...regras, [r]: { ...c, ativa: e.target.checked } })} aria-label={`Ligar ${ROTULO_REGRA[r]}`} />
                      </td>
                      <td className="px-3 py-2 font-medium">{ROTULO_REGRA[r]}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.peso}</td>
                      <td className="px-3 py-2 text-suave">{faixasTexto(c)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{whatsPorRegra.get(r) ?? 0}</td>
                      <td className="px-3 py-2 text-right">
                        <Botao tamanho="mini" variante="secundaria" onClick={() => setEditando(r)}>
                          {travado ? "Ver" : "Editar"}
                        </Botao>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </div>
        <div className="lg:sticky lg:top-4 lg:self-start">
          <Simulador alertas={semana} regras={regras} pol={pol} />
        </div>
      </div>
      {editando && <EditorRegra c={regras[editando]} mudar={(c) => setRegras({ ...regras, [editando]: c })} fechar={() => setEditando(null)} travado={travado} />}
      <div role="region" aria-label="Salvar" className="sticky bottom-2 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-borda bg-superficie p-3 shadow-lg">
        <span className="text-sm">
          {nMudancas ? (
            <b>
              {nMudancas} {nMudancas === 1 ? "mudança não salva" : "mudanças não salvas"}
            </b>
          ) : (
            <span className="text-suave">Nenhuma mudança</span>
          )}
          {travado && <span className="text-suave"> · entre para salvar (o simulador funciona sem entrar)</span>}
        </span>
        <span className="ml-auto flex gap-2">
          <Botao variante="secundaria" disabled={!nMudancas || estado.salvando} onClick={desfazer}>
            Desfazer
          </Botao>
          <Botao disabled={travado || !nMudancas || estado.salvando || cortesErrados || !horaOk} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </span>
        {estado.msg && (
          <div className="w-full">
            <Aviso tipo={estado.msg.tipo}>{estado.msg.texto}</Aviso>
          </div>
        )}
      </div>
    </div>
  );
}
