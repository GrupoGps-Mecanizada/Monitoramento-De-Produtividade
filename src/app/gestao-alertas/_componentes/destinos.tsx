"use client";

import { useCallback, useEffect, useState } from "react";
import { Aviso, Botao, Chip, Entrada, Selecao, Vazio } from "@/components/ui";
import { apagarDestino, apagarSilencio, lerDestinos, lerSilencios, salvarDestino, type Destinatario, type SilencioGravado } from "@/lib/dados/alertas";
import { normalizarTelefone } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";

const NOVO: Destinatario = { nome: "", telefone: null, grupo_id: null, tipo: "supervisor", supervisor: null, regras: [], nao_perturbe_ini: null, nao_perturbe_fim: null, resumo_diario: false, ativo: true };
const TIPOS: Destinatario["tipo"][] = ["supervisor", "coordenador", "grupo", "teste"];
const ROTULO_TIPO: Record<Destinatario["tipo"], string> = { supervisor: "Supervisor", coordenador: "Coordenador", grupo: "Grupo do WhatsApp", teste: "Teste (modo teste)" };

function Formulario({ inicial, aoSalvar, aoCancelar }: { inicial: Destinatario; aoSalvar: () => void; aoCancelar: () => void }) {
  const [d, setD] = useState(inicial);
  const [telefone, setTelefone] = useState(inicial.telefone ?? "");
  const [erro, setErro] = useState<string | null>(null);
  const grupo = d.tipo === "grupo";
  async function salvar() {
    const tel = grupo ? null : normalizarTelefone(telefone);
    if (d.nome.trim().length < 2) return setErro("Escreva o nome.");
    if (!grupo && !tel) return setErro("Telefone inválido: use DDD + número, ex.: (31) 98888-7777.");
    if (grupo && !d.grupo_id?.trim()) return setErro("Informe o código do grupo do WhatsApp.");
    try {
      await salvarDestino({ ...d, nome: d.nome.trim(), telefone: tel, grupo_id: grupo ? (d.grupo_id?.trim() ?? null) : null });
      aoSalvar();
    } catch (e) {
      setErro(e instanceof Error ? e.message : String(e));
    }
  }
  const alternar = (r: RegraExcecao) => setD({ ...d, regras: d.regras.includes(r) ? d.regras.filter((x) => x !== r) : [...d.regras, r] });
  return (
    <div className="space-y-3 rounded-lg border border-borda p-3 text-[13px]">
      <div className="flex flex-wrap gap-2">
        <Entrada placeholder="Nome" aria-label="Nome" value={d.nome} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        <Selecao aria-label="Tipo" value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as Destinatario["tipo"] })}>
          {TIPOS.map((t) => (
            <option key={t} value={t}>
              {ROTULO_TIPO[t]}
            </option>
          ))}
        </Selecao>
        {grupo ? (
          <Entrada placeholder="Código do grupo" aria-label="Código do grupo" value={d.grupo_id ?? ""} onChange={(e) => setD({ ...d, grupo_id: e.target.value })} />
        ) : (
          <Entrada placeholder="(31) 98888-7777" aria-label="Telefone" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
        )}
        {d.tipo === "supervisor" && (
          <Entrada placeholder="Supervisor (ex.: Junior Pereira)" aria-label="Supervisor" value={d.supervisor ?? ""} onChange={(e) => setD({ ...d, supervisor: e.target.value || null })} />
        )}
      </div>
      <div className="flex flex-wrap gap-1.5">
        <span className="text-suave">Regras (nenhuma marcada = todas):</span>
        {REGRAS.map((r) => (
          <Chip key={r} ativo={d.regras.includes(r)} onClick={() => alternar(r)}>
            {ROTULO_REGRA[r]}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2">
          <span className="text-suave">Não perturbe das</span>
          <Entrada type="time" value={d.nao_perturbe_ini ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_ini: e.target.value || null })} />
          <span className="text-suave">às</span>
          <Entrada type="time" value={d.nao_perturbe_fim ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_fim: e.target.value || null })} />
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.resumo_diario} onChange={(e) => setD({ ...d, resumo_diario: e.target.checked })} /> Recebe o resumo diário
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /> Ativo
        </label>
      </div>
      <div className="flex gap-2">
        <Botao onClick={() => void salvar()}>Salvar</Botao>
        <Botao variante="secundaria" onClick={aoCancelar}>
          Cancelar
        </Botao>
      </div>
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
    </div>
  );
}

/** Quem recebe e os silêncios valendo. Telefone é dado pessoal: só com login. */
export function Destinos({ logado }: { logado: boolean }) {
  const [lista, setLista] = useState<Destinatario[]>([]);
  const [silencios, setSilencios] = useState<SilencioGravado[]>([]);
  const [editando, setEditando] = useState<Destinatario | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const ler = useCallback(() => {
    Promise.all([lerDestinos(), lerSilencios()]).then(
      ([d, s]) => {
        setLista(d);
        setSilencios(s);
      },
      (e: unknown) => setErro(e instanceof Error ? e.message : String(e)),
    );
  }, []);
  useEffect(() => {
    if (logado) ler();
  }, [logado, ler]);
  if (!logado) return <Vazio titulo="Entre para ver e editar quem recebe">Os telefones são dados pessoais: só aparecem para quem entrou com e-mail e senha.</Vazio>;
  return (
    <div className="space-y-4">
      <section aria-label="Destinatários" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold">Quem recebe</p>
          <Botao tamanho="mini" onClick={() => setEditando(NOVO)}>
            + Destinatário
          </Botao>
        </div>
        {editando && <Formulario key={editando.id ?? "novo"} inicial={editando} aoCancelar={() => setEditando(null)} aoSalvar={() => (setEditando(null), ler())} />}
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <ul className="divide-y divide-borda text-[13px]">
          {lista.map((d) => (
            <li key={d.id} className="flex flex-wrap items-center gap-2 py-2">
              <b>{d.nome}</b>
              <span className="text-suave">
                {ROTULO_TIPO[d.tipo]} · {d.telefone ?? d.grupo_id}
                {d.supervisor && ` · ${d.supervisor}`}
                {d.regras.length ? ` · ${d.regras.length} regra(s)` : " · todas as regras"}
                {d.nao_perturbe_ini && ` · não perturbe ${d.nao_perturbe_ini.slice(0, 5)}–${d.nao_perturbe_fim?.slice(0, 5)}`}
                {d.resumo_diario && " · resumo diário"}
                {!d.ativo && " · inativo"}
              </span>
              <span className="ml-auto flex gap-1">
                <Botao tamanho="mini" variante="secundaria" onClick={() => setEditando(d)}>
                  Editar
                </Botao>
                <Botao tamanho="mini" variante="discreta" onClick={() => d.id && confirm(`Apagar ${d.nome}?`) && void apagarDestino(d.id).then(ler)}>
                  Apagar
                </Botao>
              </span>
            </li>
          ))}
          {!lista.length && <li className="py-2 text-suave">Ninguém cadastrado ainda.</li>}
        </ul>
      </section>
      <section aria-label="Silêncios" className="space-y-2 rounded-xl border border-borda bg-superficie p-4 shadow-sm">
        <p className="font-semibold">Silêncios valendo</p>
        <ul className="divide-y divide-borda text-[13px]">
          {silencios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
              <span>
                {s.veiculo_id ? `Equipamento ${s.veiculo_id}` : "Todos"} · {s.regra ? (ROTULO_REGRA[s.regra as RegraExcecao] ?? s.regra) : "todas as regras"} · até{" "}
                {new Date(s.ate).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })} · {s.motivo}
              </span>
              <Botao tamanho="mini" variante="discreta" className="ml-auto" onClick={() => void apagarSilencio(s.id).then(ler)}>
                Tirar silêncio
              </Botao>
            </li>
          ))}
          {!silencios.length && <li className="py-2 text-suave">Nenhum silêncio valendo.</li>}
        </ul>
      </section>
    </div>
  );
}
