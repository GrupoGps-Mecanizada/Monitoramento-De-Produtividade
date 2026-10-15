"use client";

import Link from "next/link";
import { useState } from "react";
import { Aviso, Botao, Campos, Entrada, Selecao, Selo } from "@/components/ui";
import { corDoTom } from "@/lib/cores";
import { avaliar, marcarVisto, resolver, silenciar } from "@/lib/dados/alertas";
import { NOTA_GRAVE, ROTULO_DESTINO, rotuloRegra } from "@/lib/dominio/alertas/fila";
import type { AlertaGravado, Avaliacao } from "@/lib/dominio/alertas/gestao";
import { diaMenos } from "@/lib/dominio/analise";
import { fmtHora, rotuloDia } from "@/lib/dominio/formato";
import { NotaSelo, ROTULO_SITUACAO, TOM_DESTINO, TOM_SITUACAO, erroTexto, quando } from "./comum";

const DIAS_SILENCIO = [1, 3, 7, 30];
const hm = (s: number | null) => (s == null ? "" : fmtHora(s).slice(0, 5));

/** De onde veio cada ponto da nota, em barrinhas (verde tira, vermelho soma). */
function Composicao({ a }: { a: AlertaGravado }) {
  const maior = Math.max(1, ...a.motivos.map((m) => Math.abs(m.pontos)));
  return (
    <ul className="space-y-1.5">
      {a.motivos.map((m) => (
        <li key={m.texto} className="grid grid-cols-[1fr_120px_42px] items-center gap-2 text-[13px]">
          <span className="min-w-0 truncate">{m.texto}</span>
          <span className="h-2 overflow-hidden rounded-full bg-superficie-2">
            <span className="block h-full rounded-full" style={{ width: `${(Math.abs(m.pontos) / maior) * 100}%`, background: corDoTom(m.pontos >= 0 ? "bad" : "ok") }} />
          </span>
          <b className="text-right tabular-nums">
            {m.pontos > 0 ? "+" : ""}
            {m.pontos}
          </b>
        </li>
      ))}
    </ul>
  );
}

function Acoes({ a, email, aoMudar }: { a: AlertaGravado; email: string | null; aoMudar: () => void }) {
  const [silencio, setSilencio] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(1);
  const [ocupado, setOcupado] = useState(false);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const travado = !email || ocupado;
  const fazer = async (p: () => Promise<unknown>, ok: string) => {
    setOcupado(true);
    setMsg(null);
    try {
      await p();
      setMsg({ tipo: "ok", texto: ok });
      setSilencio(false);
      aoMudar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: erroTexto(e) });
    } finally {
      setOcupado(false);
    }
  };
  const motivoOk = motivo.trim().length >= 2 && motivo.trim().length <= 200;
  const fechado = a.situacao === "resolvido" || a.situacao === "silenciado";
  if (!email) return <Aviso tipo="info">Entre (botão no topo) para marcar visto, resolver, silenciar ou avaliar.</Aviso>;
  return (
    <div className="space-y-3">
      {!fechado && (
        <div className="flex flex-wrap gap-2">
          {a.situacao === "aberto" && (
            <Botao variante="secundaria" disabled={travado} onClick={() => void fazer(() => marcarVisto(a.id, email), "Marcado como visto.")}>
              Visto
            </Botao>
          )}
          <Botao variante="secundaria" disabled={travado} onClick={() => void fazer(() => resolver(a.id), "Resolvido.")}>
            Resolver
          </Botao>
          <Botao variante="secundaria" disabled={travado} onClick={() => setSilencio((s) => !s)} aria-expanded={silencio}>
            Silenciar…
          </Botao>
        </div>
      )}
      {silencio && !fechado && (
        <div className="space-y-2 rounded-lg border border-borda p-3">
          <p className="text-[13px] text-suave">
            Silencia <b>{a.placa}</b> em <b>{rotuloRegra(a.regra)}</b>: não gera aviso até a data escolhida.
          </p>
          <div className="flex flex-wrap gap-2">
            <Entrada placeholder="Motivo (ex.: em manutenção)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do silêncio" maxLength={200} className="min-w-0 flex-1" />
            <Selecao value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Por quanto tempo">
              {DIAS_SILENCIO.map((d) => (
                <option key={d} value={d}>
                  {d === 1 ? "1 dia" : `${d} dias`}
                </option>
              ))}
            </Selecao>
            <Botao disabled={travado || !motivoOk} onClick={() => void fazer(() => silenciar(a, motivo, dias), "Silenciado.")}>
              Silenciar
            </Botao>
          </div>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2 text-[13px]">
        <span className="text-suave">Esse alerta era um problema de verdade?</span>
        {(["problema", "nao_era_problema"] as Avaliacao[]).map((v) => (
          <Botao key={v} tamanho="mini" variante={a.avaliacao === v ? "primaria" : "secundaria"} disabled={travado || a.avaliacao === v} onClick={() => void fazer(() => avaliar(a.id, v), "Avaliação guardada.")}>
            {v === "problema" ? "Era problema" : "Não era problema"}
          </Botao>
        ))}
      </div>
      {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
    </div>
  );
}

/** Gaveta do alerta: nota e o porquê, dados, ações, Timeline e os outros alertas do equipamento na semana. */
export function DetalheAlerta({
  a,
  todos,
  hoje,
  email,
  fechar,
  abrir,
  aoMudar,
}: {
  a: AlertaGravado;
  todos: AlertaGravado[];
  hoje: string;
  email: string | null;
  fechar: () => void;
  abrir: (a: AlertaGravado) => void;
  aoMudar: () => void;
}) {
  const semana = todos.filter((x) => x.veiculo_id === a.veiculo_id && x.id !== a.id && x.dia >= diaMenos(hoje, 6)).sort((p, q) => q.dia.localeCompare(p.dia) || q.ini - p.ini);
  const coordenador = a.nota >= NOTA_GRAVE;
  return (
    <aside aria-label={`${a.placa} · ${rotuloRegra(a.regra)}`} className="min-w-0 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:border-l lg:border-borda lg:pl-6">
      <header className="flex items-start gap-3 pb-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold leading-snug">
            {a.placa} · {rotuloRegra(a.regra)}
          </h2>
          <p className="text-sm text-suave">
            {rotuloDia(a.dia, hoje)} {hm(a.ini)}
            {a.fim != null && `–${hm(a.fim)}`} · {a.detalhe}
          </p>
        </div>
        <button type="button" onClick={fechar} aria-label="Fechar" title="Fechar (Esc)" className="grid h-8 w-8 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto">
          ×
        </button>
      </header>
      <div className="space-y-6">
        <section aria-label="Nota" className="flex items-center gap-4">
          <NotaSelo a={a} grande />
          <div className="space-y-1">
            <p className="font-semibold">
              {ROTULO_DESTINO[a.destino]}
              {coordenador && " + coordenador"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Selo tom={TOM_SITUACAO[a.situacao]}>{ROTULO_SITUACAO[a.situacao]}</Selo>
              <Selo tom={TOM_DESTINO[a.destino]}>{ROTULO_DESTINO[a.destino]}</Selo>
              {a.avaliacao && <Selo tom="neu">{a.avaliacao === "problema" ? "Era problema" : "Não era problema"}</Selo>}
            </div>
          </div>
        </section>
        <section aria-label="Por que essa nota" className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">Por que essa nota</p>
          <Composicao a={a} />
        </section>
        <section aria-label="Ações">
          <Acoes key={a.id} a={a} email={email} aoMudar={aoMudar} />
        </section>
        <section aria-label="Dados do alerta">
          <Campos
            itens={[
              ["Vaga", a.vaga || "—"],
              ["Supervisor", a.supervisor ?? "—"],
              ["Local", a.local ?? "—"],
              ["Visto pelo robô", `${a.contagem} ${a.contagem === 1 ? "vez" : "vezes"} · desde ${quando(a.detectado_em)}`],
              ...(a.visto_em ? ([["Visto", `${quando(a.visto_em)}${a.visto_por ? ` · ${a.visto_por}` : ""}`]] as [string, string][]) : []),
              ...(a.resolvido_em ? ([["Resolvido", `${quando(a.resolvido_em)} · ${a.resolvido_por === "gestor" ? "pelo gestor" : "sozinho (o problema acabou)"}`]] as [string, string][]) : []),
            ]}
          />
          <Link href={`/timeline/?v=${encodeURIComponent(a.veiculo_id)}&dia=${a.dia}`} className="mt-3 inline-block text-sm font-semibold text-primaria">
            Ver na Timeline ›
          </Link>
        </section>
        <section aria-label="Outros alertas do equipamento" className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-suave">Outros alertas de {a.placa} nos últimos 7 dias</p>
          {semana.length ? (
            <ul className="divide-y divide-borda rounded-lg border border-borda">
              {semana.map((x) => (
                <li key={x.id}>
                  <button type="button" onClick={() => abrir(x)} className="flex w-full items-center gap-3 px-3 py-2 text-left text-[13px] hover:bg-superficie-2">
                    <NotaSelo a={x} />
                    <span className="min-w-0 flex-1 truncate">
                      {rotuloRegra(x.regra)} · {x.detalhe}
                    </span>
                    <span className="text-xs text-suave">
                      {rotuloDia(x.dia, hoje)} {hm(x.ini)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-suave">Nenhum outro alerta.</p>
          )}
        </section>
      </div>
    </aside>
  );
}
