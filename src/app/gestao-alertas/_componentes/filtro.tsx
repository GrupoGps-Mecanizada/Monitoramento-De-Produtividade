"use client";

import { useMemo, useState } from "react";
import { Aviso, Botao, Entrada } from "@/components/ui";
import { salvarPolitica, salvarRegra, type ConfigGestao } from "@/lib/dados/alertas";
import { simular, sugestoes, type AlertaGravado } from "@/lib/dominio/alertas/gestao";
import type { ConfigRegra, Faixa, FamiliaJust, Politica } from "@/lib/dominio/alertas/config";
import { diaMenos } from "@/lib/dominio/analise";
import { REGRAS, ROTULO_REGRA } from "@/lib/dominio/excecoes";
import { ROTULO_FAMILIA } from "@/lib/dominio/familias";
import { ROTULO_DESTINO } from "./cartao";

const FAMILIAS_JUST: FamiliaJust[] = ["manutencao", "preparacao", "aguardando", "pausas", "logistica"];
const num = (v: string, min: number, max: number) => Math.min(max, Math.max(min, Math.round(Number(v) || 0)));

function Numero({ rotulo, valor, mudar, min = 0, max = 100, travado }: { rotulo: string; valor: number; mudar: (n: number) => void; min?: number; max?: number; travado: boolean }) {
  return (
    <label className="flex items-center gap-2 text-[13px]">
      <span className="text-suave">{rotulo}</span>
      <Entrada type="number" min={min} max={max} value={valor} disabled={travado} onChange={(e) => mudar(num(e.target.value, min, max))} className="w-20 tabular-nums" />
    </label>
  );
}

function CartaoRegra({ c, mudar, travado }: { c: ConfigRegra; mudar: (c: ConfigRegra) => void; travado: boolean }) {
  const faixa = (i: number, f: Faixa) => mudar({ ...c, faixas: c.faixas.map((x, k) => (k === i ? f : x)) });
  return (
    <div className="space-y-2 rounded-lg border border-borda p-3">
      <label className="flex items-center gap-2 font-semibold">
        <input type="checkbox" checked={c.ativa} disabled={travado} onChange={(e) => mudar({ ...c, ativa: e.target.checked })} />
        {ROTULO_REGRA[c.regra]}
      </label>
      <div className="flex flex-wrap gap-3">
        <Numero rotulo="Peso" valor={c.peso} mudar={(peso) => mudar({ ...c, peso })} travado={travado} />
        <Numero rotulo="Lembrete (min)" valor={c.lembrete_min} min={15} max={1440} mudar={(lembrete_min) => mudar({ ...c, lembrete_min })} travado={travado} />
      </div>
      <div className="space-y-1 text-[13px]">
        <p className="text-suave">Faixas (pontos a mais quando passa de X minutos)</p>
        {c.faixas.map((f, i) => (
          <div key={i} className="flex flex-wrap items-center gap-2">
            <Numero rotulo="acima de" valor={f.acima_min} max={1440} mudar={(acima_min) => faixa(i, { ...f, acima_min })} travado={travado} />
            <Numero rotulo="min: +" valor={f.pontos} mudar={(pontos) => faixa(i, { ...f, pontos })} travado={travado} />
            <Botao tamanho="mini" variante="discreta" disabled={travado} onClick={() => mudar({ ...c, faixas: c.faixas.filter((_, k) => k !== i) })}>
              Tirar
            </Botao>
          </div>
        ))}
        <Botao tamanho="mini" variante="discreta" disabled={travado} onClick={() => mudar({ ...c, faixas: [...c.faixas, { acima_min: 30, pontos: 20 }] })}>
          + Faixa
        </Botao>
      </div>
      <div className="flex flex-wrap gap-3">
        <span className="w-full text-[13px] text-suave">Apontamento no tablet tira pontos (vale o maior)</span>
        {FAMILIAS_JUST.map((f) => (
          <Numero key={f} rotulo={ROTULO_FAMILIA[f]} valor={c.justificativas[f] ?? 0} mudar={(n) => mudar({ ...c, justificativas: { ...c.justificativas, [f]: n } })} travado={travado} />
        ))}
      </div>
    </div>
  );
}

/** Pesos, faixas, justificativas e cortes, com o simulador (últimos 7 dias) e as sugestões. Salvar pede login. */
export function Filtro({ alertas, config, hoje, logado, aoSalvar }: { alertas: AlertaGravado[]; config: ConfigGestao; hoje: string; logado: boolean; aoSalvar: () => void }) {
  const [regras, setRegras] = useState(config.regras);
  const [pol, setPol] = useState<Politica>(config.politica);
  const [msg, setMsg] = useState<{ tipo: "ok" | "erro"; texto: string } | null>(null);
  const semana = useMemo(() => alertas.filter((a) => a.dia >= diaMenos(hoje, 6)), [alertas, hoje]);
  const sim = useMemo(() => simular(semana, regras, pol), [semana, regras, pol]);
  const sugs = useMemo(() => sugestoes(alertas, hoje), [alertas, hoje]);
  const mudadas = REGRAS.filter((r) => JSON.stringify(regras[r]) !== JSON.stringify(config.regras[r]));
  const polMudou = JSON.stringify(pol) !== JSON.stringify(config.politica);
  const travado = !logado;
  async function salvar() {
    try {
      for (const r of mudadas) await salvarRegra(regras[r]);
      if (polMudou) await salvarPolitica(pol);
      setMsg({ tipo: "ok", texto: "Salvo. Vale a partir do próximo ciclo do robô (até 10 min)." });
      aoSalvar();
    } catch (e) {
      setMsg({ tipo: "erro", texto: e instanceof Error ? e.message : String(e) });
    }
  }
  return (
    <div className="space-y-4">
      <section aria-label="Simulador" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Simulador · últimos 7 dias</p>
        <p className="text-sm">
          <b className="tabular-nums">{sim.total}</b> alertas. Com esta configuração:{" "}
          {(["whatsapp", "resumo", "tela"] as const).map((d, i) => (
            <span key={d}>
              {i > 0 && " · "}
              <b className="tabular-nums">{sim.depois[d]}</b> {ROTULO_DESTINO[d]} <span className="text-suave">(hoje: {sim.antes[d]})</span>
            </span>
          ))}
          {sim.mudaram > 0 && <span> · {sim.mudaram} mudariam de destino</span>}
        </p>
        {sim.porRegra.length > 0 && (
          <ul className="text-xs text-suave">
            {sim.porRegra.map((r) => (
              <li key={r.regra}>
                {ROTULO_REGRA[r.regra as keyof typeof ROTULO_REGRA] ?? r.regra}: {r.antes} → {r.depois} no WhatsApp
              </li>
            ))}
          </ul>
        )}
      </section>
      {sugs.map((s) => (
        <Aviso key={s.regra} tipo="alerta">
          {s.texto}
        </Aviso>
      ))}
      <section aria-label="Cortes" className="space-y-3 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Cortes da nota</p>
        <div className="flex flex-wrap gap-4">
          <Numero rotulo="WhatsApp a partir de" valor={pol.corte_whatsapp} mudar={(n) => setPol({ ...pol, corte_whatsapp: n })} travado={travado} />
          <Numero rotulo="Resumo a partir de" valor={pol.corte_resumo} mudar={(n) => setPol({ ...pol, corte_resumo: n })} travado={travado} />
          <Numero rotulo="Coordenador a partir de" valor={pol.corte_coordenador} mudar={(n) => setPol({ ...pol, corte_coordenador: n })} travado={travado} />
          <Numero rotulo="Máx. mensagens por hora" valor={pol.max_por_hora} min={1} max={60} mudar={(n) => setPol({ ...pol, max_por_hora: n })} travado={travado} />
          <label className="flex items-center gap-2 text-[13px]">
            <span className="text-suave">Resumo diário às</span>
            <Entrada type="time" value={pol.resumo_hora} disabled={travado} onChange={(e) => setPol({ ...pol, resumo_hora: e.target.value })} />
          </label>
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" checked={pol.modo_teste} disabled={travado} onChange={(e) => setPol({ ...pol, modo_teste: e.target.checked })} />
            Modo teste (tudo vai só para o destinatário de teste)
          </label>
        </div>
      </section>
      <section aria-label="Regras" className="grid gap-3 md:grid-cols-2">
        {REGRAS.map((r) => (
          <CartaoRegra key={r} c={regras[r]} mudar={(c) => setRegras({ ...regras, [r]: c })} travado={travado} />
        ))}
      </section>
      <div className="flex flex-wrap items-center gap-3">
        <Botao disabled={travado || (!mudadas.length && !polMudou)} onClick={() => void salvar()}>
          Salvar
        </Botao>
        {travado && <span className="text-sm text-suave">Entre para salvar. Dá para testar no simulador sem entrar.</span>}
        {msg && <Aviso tipo={msg.tipo}>{msg.texto}</Aviso>}
      </div>
    </div>
  );
}
