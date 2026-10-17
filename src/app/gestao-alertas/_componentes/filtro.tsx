"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Aviso, Botao, cx } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { salvarPolitica, salvarRegra, type ConfigGestao } from "@/lib/dados/alertas";
import type { ConfigRegra, FamiliaJust, Politica } from "@/lib/dominio/alertas/config";
import { ROTULO_DESTINO } from "@/lib/dominio/alertas/fila";
import { simular, sugestoes, type AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { Destino } from "@/lib/dominio/alertas/nota";
import { diaMenos } from "@/lib/dominio/analise";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { ROTULO_FAMILIA } from "@/lib/dominio/familias";
import { ROTULO_NIVEL, comJustificativa, deConfig, paraConfig, temJustificativa, type Nivel, type RegraSimples } from "@/lib/dominio/alertas/simples";
import { CampoNumero, TOM_DESTINO, erroTexto } from "./comum";

const FAMILIAS_JUST: FamiliaJust[] = ["manutencao", "preparacao", "aguardando", "pausas", "logistica"];
const DESTINOS: Destino[] = ["whatsapp", "resumo", "tela"];
const faixasTexto = (c: ConfigRegra) => (c.faixas.length ? [...c.faixas].sort((a, b) => a.acima_min - b.acima_min).map((f) => `>${f.acima_min} min +${f.pontos}`).join(" · ") : "—");
const Titulo = ({ children }: { children: ReactNode }) => <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">{children}</p>;

function Campo({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-[13px]">
      <span className="text-suave">{rotulo}</span>
      {children}
    </label>
  );
}

/** Edição de uma regra, ao lado da tabela (modelo 32). */
function EditorRegra({ c, mudar, fechar }: { c: ConfigRegra; mudar: (c: ConfigRegra) => void; fechar: () => void }) {
  return (
    <aside aria-label={`Editar ${ROTULO_REGRA[c.regra]}`} className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:border-l lg:border-borda lg:pl-6">
      <header className="flex items-start gap-3 pb-4">
        <div className="flex-1">
          <h2 className="text-lg font-semibold">{ROTULO_REGRA[c.regra]}</h2>
          <p className="text-sm text-suave">O simulador já mostra o efeito; salvar fica embaixo (pede login).</p>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto">
          ×
        </button>
      </header>
      <fieldset className="space-y-6">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={c.ativa} onChange={(e) => mudar({ ...c, ativa: e.target.checked })} />
          Regra ligada
        </label>
        <div className="flex flex-wrap gap-6">
          <Campo rotulo="Peso (0 a 100)">
            <CampoNumero valor={c.peso} mudar={(peso) => mudar({ ...c, peso })} aria-label="Peso" />
          </Campo>
          <Campo rotulo="Lembrete a cada (min)">
            <CampoNumero valor={c.lembrete_min} min={15} max={1440} mudar={(lembrete_min) => mudar({ ...c, lembrete_min })} aria-label="Lembrete em minutos" />
          </Campo>
        </div>
        <div className="space-y-2">
          <Titulo>Faixas · pontos a mais quando passa de X minutos</Titulo>
          {c.faixas.map((f, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
              <span className="text-suave">acima de</span>
              <CampoNumero valor={f.acima_min} max={1440} mudar={(acima_min) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? { ...x, acima_min } : x)) })} aria-label={`Faixa ${i + 1}: minutos`} />
              <span className="text-suave">min, +</span>
              <CampoNumero valor={f.pontos} mudar={(pontos) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? { ...x, pontos } : x)) })} aria-label={`Faixa ${i + 1}: pontos`} />
              <button type="button" className="text-suave hover:text-texto" onClick={() => mudar({ ...c, faixas: c.faixas.filter((_, k) => k !== i) })}>
                Tirar
              </button>
            </div>
          ))}
          <button type="button" className="text-[13px] font-medium text-link hover:underline" onClick={() => mudar({ ...c, faixas: [...c.faixas, { acima_min: 30, pontos: 20 }] })}>
            + Faixa
          </button>
        </div>
        <div className="space-y-2">
          <Titulo>Apontamento no tablet tira pontos · vale o maior</Titulo>
          <div className="grid grid-cols-2 gap-4">
            {FAMILIAS_JUST.map((f) => (
              <Campo key={f} rotulo={ROTULO_FAMILIA[f]}>
                <CampoNumero valor={c.justificativas[f] ?? 0} mudar={(n) => mudar({ ...c, justificativas: { ...c.justificativas, [f]: n } })} aria-label={`Justificativa ${ROTULO_FAMILIA[f]}`} />
              </Campo>
            ))}
          </div>
        </div>
      </fieldset>
    </aside>
  );
}

/** Modo simples (padrão): uma linha por regra — para onde vai, WhatsApp após X min e coordenador após Y min. */
function FiltroSimples({
  regras,
  setRegras,
  pol,
  whatsPorRegra,
  abrirAvancado,
}: {
  regras: Record<RegraExcecao, ConfigRegra>;
  setRegras: (r: Record<RegraExcecao, ConfigRegra>) => void;
  pol: Politica;
  whatsPorRegra: Map<string, { antes: number; depois: number }>;
  abrirAvancado: () => void;
}) {
  const mudar = (r: RegraExcecao, p: Partial<RegraSimples>) => {
    const atual = deConfig(regras[r], pol);
    const novo = { ...atual, ...p };
    // ao virar WhatsApp, começa com tolerância e coordenador sugeridos (o dono ajusta)
    if (p.nivel === "whatsapp" && atual.nivel !== "whatsapp") Object.assign(novo, { whatsappApos: 15, coordenadorApos: 60 });
    setRegras({ ...regras, [r]: paraConfig(novo, regras[r], pol) });
  };
  const justificaTodas = REGRAS.every((r) => temJustificativa(regras[r]) || regras[r].peso === 0);
  const ligarJustificativa = (v: boolean) => setRegras(Object.fromEntries(REGRAS.map((r) => [r, comJustificativa(regras[r], v)])) as Record<RegraExcecao, ConfigRegra>);
  const minutos = "w-16 tabular-nums";
  return (
    <section aria-label="Regras" className="space-y-5">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
            <tr className="border-b border-borda">
              <th className="w-10 py-2 pl-1 font-medium">On</th>
              <th className="px-3 py-2 font-medium">Regra</th>
              <th className="px-3 py-2 font-medium">Para onde vai</th>
              <th className="px-3 py-2 font-medium">WhatsApp após</th>
              <th className="px-3 py-2 font-medium">Coordenador após</th>
              <th className="px-3 py-2 text-right font-medium">WhatsApp em 7 dias</th>
            </tr>
          </thead>
          <tbody>
            {REGRAS.map((r) => {
              const s = deConfig(regras[r], pol);
              const w = whatsPorRegra.get(r);
              const whats = s.nivel === "whatsapp";
              return (
                <tr key={r} className={cx("border-b border-borda/60", !s.ativa && "text-suave")}>
                  <td className="py-2 pl-1">
                    <input type="checkbox" checked={s.ativa} onChange={(e) => mudar(r, { ativa: e.target.checked })} aria-label={`Ligar ${ROTULO_REGRA[r]}`} />
                  </td>
                  <td className="px-3 py-2 font-medium">{ROTULO_REGRA[r]}</td>
                  <td className="px-3 py-2">
                    <select
                      aria-label={`Para onde vai: ${ROTULO_REGRA[r]}`}
                      value={s.nivel}
                      disabled={!s.ativa}
                      onChange={(e) => mudar(r, { nivel: e.target.value as Nivel })}
                      className="h-8 rounded-lg border border-borda bg-superficie px-2 text-[13px]"
                    >
                      {(["whatsapp", "resumo", "tela"] as Nivel[]).map((n) => (
                        <option key={n} value={n}>
                          {ROTULO_NIVEL[n]}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {whats ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CampoNumero valor={s.whatsappApos ?? 0} max={1440} mudar={(n) => mudar(r, { whatsappApos: n || null })} aria-label={`WhatsApp após (min): ${ROTULO_REGRA[r]}`} className={minutos} />
                        <span className="text-suave">min</span>
                      </span>
                    ) : (
                      <span className="text-suave">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2">
                    {whats ? (
                      <span className="inline-flex items-center gap-1.5">
                        <CampoNumero valor={s.coordenadorApos ?? 0} max={1440} mudar={(n) => mudar(r, { coordenadorApos: n || null })} aria-label={`Coordenador após (min): ${ROTULO_REGRA[r]}`} className={minutos} />
                        <span className="text-suave">min</span>
                      </span>
                    ) : (
                      <span className="text-suave">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    {w ? w.depois : 0}
                    {w && w.depois !== w.antes && <span className="text-suave"> (antes {w.antes})</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-suave">0 min em “WhatsApp após” = manda sempre; 0 em “Coordenador após” = nunca chama o coordenador.</p>
      <div className="space-y-2 text-[13px]">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={justificaTodas} onChange={(e) => ligarJustificativa(e.target.checked)} />
          Se tiver apontamento no tablet (manutenção, aguardando, pausa...), vai só para o resumo
        </label>
        <p className="text-suave">Se repetir 3 vezes na semana na mesma vaga, sobe um nível (resumo → WhatsApp → coordenador).</p>
      </div>
      <button type="button" className="text-[13px] font-medium text-link hover:underline" onClick={abrirAvancado}>
        Ajuste fino (pesos e pontos) ›
      </button>
    </section>
  );
}

/** Aba Filtro inteligente: simulador numa linha, cortes, tabela das regras com edição ao lado, sugestões e barra de salvar. */
export function Filtro({ alertas, config, hoje, logado, aoSalvar }: { alertas: AlertaGravado[]; config: ConfigGestao; hoje: string; logado: boolean; aoSalvar: () => void }) {
  const [base, setBase] = useState(config);
  const [regras, setRegras] = useState(config.regras);
  const [pol, setPol] = useState<Politica>(config.politica);
  const [editando, setEditando] = useState<RegraExcecao | null>(null);
  const [avancado, setAvancado] = useState(false);
  const [estado, setEstado] = useState<{ salvando: boolean; msg: { tipo: "ok" | "erro"; texto: string } | null }>({ salvando: false, msg: null });
  const semana = useMemo(() => alertas.filter((a) => a.dia >= diaMenos(hoje, 6)), [alertas, hoje]);
  const sugs = useMemo(() => sugestoes(alertas, hoje), [alertas, hoje]);
  const sim = useMemo(() => simular(semana, regras, pol), [semana, regras, pol]);
  const whatsPorRegra = useMemo(() => new Map(sim.porRegra.map((r) => [r.regra, r])), [sim]);
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
    <div className="space-y-8 pb-20">
      <section aria-label="Simulador" className="space-y-1">
        <p className="text-sm text-suave">
          Últimos 7 dias · <b className="tabular-nums text-texto">{sim.total}</b> alertas. Com esta configuração:{" "}
          {DESTINOS.map((d, i) => (
            <span key={d}>
              {i > 0 && <span className="mx-1.5">·</span>}
              <b className="tabular-nums" style={{ color: d === "whatsapp" ? corDoTom(TOM_DESTINO[d]) : undefined }}>
                {sim.depois[d]}
              </b>{" "}
              {ROTULO_DESTINO[d]}
              {sim.depois[d] !== sim.antes[d] && <span className="text-suave"> (antes {sim.antes[d]})</span>}
            </span>
          ))}
        </p>
        {sugs.map((s) => (
          <p key={s.regra} className="text-sm text-texto">
            💡 {s.texto}
          </p>
        ))}
      </section>

      {avancado ? (
        <>
      <section aria-label="Cortes" className="space-y-3">
        <Titulo>Cortes da nota</Titulo>
        <fieldset className="flex flex-wrap items-end gap-x-8 gap-y-4">
          <Campo rotulo="WhatsApp a partir de">
            <CampoNumero valor={pol.corte_whatsapp} mudar={(n) => setPol({ ...pol, corte_whatsapp: n })} aria-label="Corte do WhatsApp" />
          </Campo>
          <Campo rotulo="Resumo a partir de">
            <CampoNumero valor={pol.corte_resumo} mudar={(n) => setPol({ ...pol, corte_resumo: n })} aria-label="Corte do resumo" />
          </Campo>
          <Campo rotulo="Coordenador a partir de">
            <CampoNumero valor={pol.corte_coordenador} mudar={(n) => setPol({ ...pol, corte_coordenador: n })} aria-label="Corte do coordenador" />
          </Campo>
          <Campo rotulo="Máx. mensagens/hora">
            <CampoNumero valor={pol.max_por_hora} min={1} max={60} mudar={(n) => setPol({ ...pol, max_por_hora: n })} aria-label="Máximo de mensagens por hora" />
          </Campo>
          <Campo rotulo="Resumo diário às">
            <input
              type="time"
              required
              value={pol.resumo_hora}
              onChange={(e) => setPol({ ...pol, resumo_hora: e.target.value })}
              aria-label="Hora do resumo diário"
              className="h-9 rounded-lg border border-borda bg-superficie px-2 text-sm"
            />
          </Campo>
          <label className="flex items-center gap-2 pb-2 text-[13px]">
            <input type="checkbox" checked={pol.modo_teste} onChange={(e) => setPol({ ...pol, modo_teste: e.target.checked })} />
            Modo teste (tudo vai só para o destinatário de teste)
          </label>
        </fieldset>
        {cortesErrados && <p className="text-sm text-[color:var(--warn,#b45309)]">Os cortes precisam subir: resumo ≤ WhatsApp ≤ coordenador.</p>}
        {!horaOk && <p className="text-sm text-[color:var(--warn,#b45309)]">Escolha a hora do resumo diário.</p>}
      </section>

      <div className={cx("grid gap-6", editando && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
        <section aria-label="Regras" className="min-w-0 space-y-3">
          <Titulo>Regras</Titulo>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
                <tr className="border-b border-borda">
                  <th className="w-10 py-2 pl-1 font-medium">On</th>
                  <th className="px-3 py-2 font-medium">Regra</th>
                  <th className="px-3 py-2 text-right font-medium">Peso</th>
                  <th className="px-3 py-2 font-medium">Faixas</th>
                  <th className="px-3 py-2 text-right font-medium">WhatsApp em 7 dias</th>
                </tr>
              </thead>
              <tbody>
                {REGRAS.map((r) => {
                  const c = regras[r];
                  const w = whatsPorRegra.get(r);
                  return (
                    <tr
                      key={r}
                      onClick={() => setEditando(r)}
                      className={cx("cursor-pointer border-b border-borda/60 hover:bg-superficie-2", editando === r && "bg-primaria-suave hover:bg-primaria-suave", !c.ativa && "text-suave")}
                    >
                      <td className="py-2 pl-1" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={c.ativa} onChange={(e) => setRegras({ ...regras, [r]: { ...c, ativa: e.target.checked } })} aria-label={`Ligar ${ROTULO_REGRA[r]}`} />
                      </td>
                      <td className="px-3 py-2 font-medium">
                        {ROTULO_REGRA[r]}
                        {mudadas.includes(r) && <span className="ml-2 text-xs font-normal text-link">alterada</span>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{c.peso}</td>
                      <td className="px-3 py-2 text-suave">{faixasTexto(c)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">
                        {w ? w.depois : 0}
                        {w && w.depois !== w.antes && <span className="text-suave"> (antes {w.antes})</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
        {editando && <EditorRegra c={regras[editando]} mudar={(c) => setRegras({ ...regras, [editando]: c })} fechar={() => setEditando(null)} />}
      </div>
          <button type="button" className="text-[13px] font-medium text-link hover:underline" onClick={() => setAvancado(false)}>
            ‹ Voltar ao modo simples
          </button>
        </>
      ) : (
        <FiltroSimples regras={regras} setRegras={setRegras} pol={pol} whatsPorRegra={whatsPorRegra} abrirAvancado={() => setAvancado(true)} />
      )}

      <div role="region" aria-label="Salvar" className="sticky bottom-3 z-10 flex flex-wrap items-center gap-3 rounded-full border border-borda bg-superficie/95 py-2 pl-5 pr-2 shadow-lg backdrop-blur">
        <span className="text-sm">
          {nMudancas ? <b>{nMudancas === 1 ? "1 mudança não salva" : `${nMudancas} mudanças não salvas`}</b> : <span className="text-suave">Nenhuma mudança</span>}
          {travado && <span className="text-suave"> · entre para salvar (o simulador funciona sem entrar)</span>}
        </span>
        <span className="ml-auto flex gap-2">
          <Botao variante="discreta" disabled={!nMudancas || estado.salvando} onClick={desfazer}>
            Desfazer
          </Botao>
          <Botao disabled={travado || !nMudancas || estado.salvando || cortesErrados || !horaOk} onClick={() => void salvar()}>
            Salvar
          </Botao>
        </span>
      </div>
      {estado.msg && <Aviso tipo={estado.msg.tipo}>{estado.msg.texto}</Aviso>}
    </div>
  );
}
