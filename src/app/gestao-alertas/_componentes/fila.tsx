"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Entrada, Selecao, Vazio } from "@/components/ui";
import { avaliar, marcarVisto, resolver, silenciar } from "@/lib/dados/alertas";
import type { AlertaGravado, Avaliacao } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { CartaoAlerta, ROTULO_DESTINO } from "./cartao";

const DIAS_SILENCIO = [1, 3, 7, 30];

function Acoes({ a, email, aoMudar }: { a: AlertaGravado; email: string | null; aoMudar: () => void }) {
  const [silencio, setSilencio] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [dias, setDias] = useState(1);
  const [erro, setErro] = useState<string | null>(null);
  const travado = !email;
  const dica = travado ? "Entre para usar as ações" : undefined;
  const fazer = (p: Promise<unknown>) => p.then(aoMudar, (e: unknown) => setErro(e instanceof Error ? e.message : String(e)));
  const motivoOk = motivo.trim().length >= 2 && motivo.trim().length <= 200;
  return (
    <div className="flex flex-col items-stretch gap-1.5 md:items-end">
      <div className="flex flex-wrap gap-1.5">
        {a.situacao === "aberto" && (
          <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => email && void fazer(marcarVisto(a.id, email))}>
            Visto
          </Botao>
        )}
        <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => void fazer(resolver(a.id))}>
          Resolver
        </Botao>
        <Botao tamanho="mini" variante="secundaria" disabled={travado} title={dica} onClick={() => setSilencio((s) => !s)}>
          Silenciar
        </Botao>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {(["problema", "nao_era_problema"] as Avaliacao[]).map((v) => (
          <Botao key={v} tamanho="mini" variante="discreta" disabled={travado || a.avaliacao === v} title={dica} onClick={() => void fazer(avaliar(a.id, v))}>
            {v === "problema" ? "Era problema" : "Não era problema"}
          </Botao>
        ))}
      </div>
      {silencio && !travado && (
        <div className="flex flex-wrap items-center gap-1.5">
          <Entrada placeholder="Motivo (ex.: em manutenção)" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo do silêncio" className="w-48" />
          <Selecao value={dias} onChange={(e) => setDias(Number(e.target.value))} aria-label="Por quanto tempo">
            {DIAS_SILENCIO.map((d) => (
              <option key={d} value={d}>
                {d === 1 ? "1 dia" : `${d} dias`}
              </option>
            ))}
          </Selecao>
          <Botao tamanho="mini" disabled={!motivoOk} onClick={() => void fazer(silenciar(a, motivo, dias))}>
            Silenciar este equipamento
          </Botao>
        </div>
      )}
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

/** Alertas abertos e vistos (os de dias anteriores o robô fecha sozinho), da maior nota para a menor. */
export function Fila({ alertas, hoje, email, aoMudar }: { alertas: AlertaGravado[]; hoje: string; email: string | null; aoMudar: () => void }) {
  const [regra, setRegra] = useState("");
  const [supervisor, setSupervisor] = useState("");
  const [destino, setDestino] = useState("");
  const abertos = useMemo(() => alertas.filter((a) => a.situacao === "aberto" || a.situacao === "visto"), [alertas]);
  const supervisores = useMemo(() => [...new Set(abertos.map((a) => a.supervisor).filter((s): s is string => !!s))].sort(), [abertos]);
  const lista = abertos
    .filter((a) => (!regra || a.regra === regra) && (!supervisor || a.supervisor === supervisor) && (!destino || a.destino === destino))
    .sort((p, q) => q.nota - p.nota);
  return (
    <section aria-label="Fila de alertas" className="rounded-xl border border-borda bg-superficie shadow-sm">
      <div className="flex flex-wrap items-center gap-2 border-b border-borda p-3">
        <Selecao value={regra} onChange={(e) => setRegra(e.target.value)} aria-label="Regra">
          <option value="">Todas as regras</option>
          {REGRAS.map((r) => (
            <option key={r} value={r}>
              {ROTULO_REGRA[r]}
            </option>
          ))}
        </Selecao>
        <Selecao value={supervisor} onChange={(e) => setSupervisor(e.target.value)} aria-label="Supervisor">
          <option value="">Todos os supervisores</option>
          {supervisores.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Selecao>
        <Selecao value={destino} onChange={(e) => setDestino(e.target.value)} aria-label="Destino">
          <option value="">Todos os destinos</option>
          {Object.entries(ROTULO_DESTINO).map(([id, r]) => (
            <option key={id} value={id}>
              {r}
            </option>
          ))}
        </Selecao>
        <span className="text-sm text-suave md:ml-auto">
          <b className="tabular-nums text-texto">{lista.length}</b> {lista.length === 1 ? "alerta" : "alertas"} na fila
        </span>
      </div>
      {lista.length ? (
        <ul>
          {lista.map((a) => (
            <CartaoAlerta key={a.id} a={a} hoje={hoje} acoes={<Acoes a={a} email={email} aoMudar={aoMudar} />} />
          ))}
        </ul>
      ) : (
        <Vazio titulo="Nenhum alerta na fila">Os alertas resolvidos e silenciados ficam no Histórico.</Vazio>
      )}
    </section>
  );
}
