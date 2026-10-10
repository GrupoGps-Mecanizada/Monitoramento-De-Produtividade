"use client";

import { useEffect, useMemo, useState } from "react";
import { avisar } from "@/components/avisos";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Botao, Entrada, Segmentado, Selecao, Selo, SecaoTitulo } from "@/components/ui";
import { lerHistoricoEquip, salvarEquipamento, type MudancaHistorico } from "@/lib/dados/use-matriz";
import {
  ORDEM_STATUS,
  ORDEM_TIPOS,
  STATUS_EQUIP,
  TIPOS_EQUIP,
  nomeCadastro,
  proximaOrdem,
  validarEquipamento,
  type DadosEquipamento,
} from "@/lib/dominio/equipamentos";
import { dataHora } from "@/lib/dominio/formato";
import type { EquipamentoCadastro, ItemLista, StatusEquip, TipoEquip } from "@/lib/tipos";

const vazio = (tipo: TipoEquip = "ap"): DadosEquipamento => ({
  tipo, placa: "", numero: "", codigo: "", status: "ATIVO", supervisor_id: null, regime_id: null, observacao: "",
});
const doCadastro = (c: EquipamentoCadastro): DadosEquipamento => ({
  tipo: c.tipo,
  placa: c.placa ?? "",
  numero: c.numero == null ? "" : String(c.numero),
  codigo: c.codigo ?? "",
  status: c.status,
  supervisor_id: c.supervisor_id,
  regime_id: c.regime_id,
  observacao: c.observacao ?? "",
});

/** Opções da lista: as ativas + a atual mesmo se estiver inativa (o nome não some do equipamento). */
const opcoes = (itens: ItemLista[], atual: number | null) => itens.filter((i) => i.ativo || i.id === atual);

/** Painel de um equipamento: cadastra ou altera (sem login, decisão do dono). `equip` ausente = novo equipamento. */
export function EditorEquipamento({
  equip,
  cadastro,
  supervisores,
  regimes,
  fechar,
}: {
  equip: EquipamentoCadastro | null;
  cadastro: EquipamentoCadastro[];
  supervisores: ItemLista[];
  regimes: ItemLista[];
  fechar: () => void;
}) {
  const inicial = useMemo(() => (equip ? doCadastro(equip) : vazio()), [equip]);
  const [d, setD] = useState<DadosEquipamento>(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [gravando, setGravando] = useState(false);
  const mexeu = JSON.stringify(d) !== JSON.stringify(inicial);
  const campo = <K extends keyof DadosEquipamento>(k: K, v: DadosEquipamento[K]) => setD((x) => ({ ...x, [k]: v }));

  const sair = () => {
    if (mexeu && !window.confirm("Sair sem salvar? O que você mudou será perdido.")) return;
    fechar();
  };

  const salvar = async () => {
    const v = validarEquipamento(d, cadastro, equip?.id);
    if (!v.ok) return setErro(v.erro);
    // novo, ou mudou de tipo: entra no fim da lista do tipo
    const ordem = !equip || equip.tipo !== d.tipo ? proximaOrdem(cadastro, d.tipo) : equip.ordem;
    setGravando(true);
    setErro(null);
    const falha = await salvarEquipamento({ ...v.linha, ordem }, equip?.id);
    setGravando(false);
    if (falha) return setErro(falha);
    avisar(equip ? "Equipamento atualizado." : "Equipamento cadastrado.", { tipo: "ok" });
    fechar();
  };

  const titulo = equip ? nomeCadastro(equip) : "Novo equipamento";
  const sub = equip ? (
    <span className="flex flex-wrap items-center gap-2">
      {TIPOS_EQUIP[equip.tipo].rotulo}
      <Selo tom={STATUS_EQUIP[equip.status].tom}>{STATUS_EQUIP[equip.status].rotulo}</Selo>
    </span>
  ) : (
    "Entra na matriz e, se não estiver desmobilizado, no Monitoramento"
  );

  const rotulo = "mb-1 block text-[13px] font-medium";
  return (
    <Gaveta
      titulo={titulo}
      sub={sub}
      fechar={fechar}
      rodape={
        <div className="flex items-center justify-end gap-2">
          <Botao variante="secundaria" onClick={sair}>
            Cancelar
          </Botao>
          <Botao onClick={salvar} disabled={gravando || (!!equip && !mexeu)}>
            {gravando ? "Salvando…" : equip ? "Salvar mudanças" : "Cadastrar"}
          </Botao>
        </div>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          void salvar();
        }}
      >
        <div>
          <span className={rotulo}>Status</span>
          <Segmentado<StatusEquip> rotulo="Status" valor={d.status} mudar={(s) => campo("status", s)} opcoes={ORDEM_STATUS.map((s) => ({ id: s, rotulo: STATUS_EQUIP[s].rotulo }))} />
          {d.status === "DESMOBILIZADO" && <p className="mt-1.5 text-xs text-suave">Desmobilizado sai do mapa, da Timeline, do Dia da frota e dos alertas.</p>}
          {d.status === "EM_MANUTENCAO" && <p className="mt-1.5 text-xs text-suave">Continua no Monitoramento, marcado como &quot;em manutenção&quot;.</p>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label>
            <span className={rotulo}>Tipo</span>
            <Selecao className="w-full" value={d.tipo} onChange={(e) => campo("tipo", e.target.value as TipoEquip)}>
              {ORDEM_TIPOS.map((t) => (
                <option key={t} value={t}>
                  {TIPOS_EQUIP[t].rotulo}
                </option>
              ))}
            </Selecao>
          </label>
          {d.tipo === "as" ? (
            <label>
              <span className={rotulo}>Número do aspirador</span>
              <Entrada className="w-full" inputMode="numeric" placeholder="ex.: 11" value={d.numero} onChange={(e) => campo("numero", e.target.value)} />
              <span className="mt-1 block text-xs text-suave">O mesmo da vaga no GAUSS (&quot;ASPIRADOR INDUSTRIAL - GPS - 11&quot;).</span>
            </label>
          ) : (
            <label>
              <span className={rotulo}>Placa</span>
              <Entrada className="w-full uppercase" placeholder="ex.: EGC-2985" value={d.placa} onChange={(e) => campo("placa", e.target.value)} />
              <span className="mt-1 block text-xs text-suave">Antiga ou Mercosul: o sistema reconhece as duas.</span>
            </label>
          )}
          <label>
            <span className={rotulo}>Supervisor</span>
            <Selecao className="w-full" value={d.supervisor_id ?? ""} onChange={(e) => campo("supervisor_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— sem supervisor —</option>
              {opcoes(supervisores, d.supervisor_id).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.nome}
                  {s.ativo ? "" : " (inativo)"}
                </option>
              ))}
            </Selecao>
          </label>
          <label>
            <span className={rotulo}>Regime</span>
            <Selecao className="w-full" value={d.regime_id ?? ""} onChange={(e) => campo("regime_id", e.target.value ? Number(e.target.value) : null)}>
              <option value="">— sem regime —</option>
              {opcoes(regimes, d.regime_id).map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nome}
                  {r.ativo ? "" : " (inativo)"}
                </option>
              ))}
            </Selecao>
          </label>
        </div>
        <label className="block">
          <span className={rotulo}>Observação (opcional)</span>
          <textarea
            className="min-h-20 w-full rounded-lg border border-borda bg-superficie px-3 py-2 text-sm text-texto focus:border-primaria"
            maxLength={500}
            value={d.observacao}
            onChange={(e) => campo("observacao", e.target.value)}
          />
        </label>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        {/* Enter no campo grava */}
        <button type="submit" hidden />
      </form>
      {equip && <Historico id={equip.id} supervisores={supervisores} regimes={regimes} />}
    </Gaveta>
  );
}

const CAMPO: Record<string, string> = {
  tipo: "Tipo", placa: "Placa", numero: "Número", codigo: "Código", status: "Status", supervisor_id: "Supervisor", regime_id: "Regime", observacao: "Observação", ordem: "Posição",
};

function Historico({ id, supervisores, regimes }: { id: number; supervisores: ItemLista[]; regimes: ItemLista[] }) {
  const [itens, setItens] = useState<MudancaHistorico[] | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    lerHistoricoEquip(id).then(
      (h) => ativo && setItens(h),
      (e: unknown) => ativo && setErro(e instanceof Error ? e.message : String(e)),
    );
    return () => void (ativo = false);
  }, [id]);
  const nomeDe = (lista: ItemLista[], v: unknown) => lista.find((i) => i.id === v)?.nome ?? "—";
  const valor = (campo: string, v: unknown): string => {
    if (v == null || v === "") return "—";
    if (campo === "status") return STATUS_EQUIP[v as StatusEquip]?.rotulo ?? String(v);
    if (campo === "tipo") return TIPOS_EQUIP[v as TipoEquip]?.rotulo ?? String(v);
    if (campo === "supervisor_id") return nomeDe(supervisores, v);
    if (campo === "regime_id") return nomeDe(regimes, v);
    return String(v);
  };
  return (
    <section className="mt-5 border-t border-borda">
      <SecaoTitulo>Histórico</SecaoTitulo>
      {erro ? (
        <Aviso tipo="erro">{erro}</Aviso>
      ) : !itens ? (
        <p className="px-4 text-sm text-suave">Carregando…</p>
      ) : !itens.length ? (
        <p className="px-4 text-sm text-suave">Sem mudanças registradas.</p>
      ) : (
        <ol className="space-y-2 px-1">
          {itens.map((h) => (
            <li key={h.id} className="rounded-lg border border-borda px-3 py-2 text-[13px]">
              <p className="text-xs text-suave">{dataHora(h.em)}</p>
              {"novo" in h.mudancas ? (
                <p>Cadastrado na matriz</p>
              ) : (
                <ul>
                  {Object.entries(h.mudancas)
                    .filter(([c]) => c !== "ordem")
                    .map(([c, m]) => (
                      <li key={c}>
                        <b>{CAMPO[c] ?? c}:</b> {valor(c, m.de)} → {valor(c, m.para)}
                      </li>
                    ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
