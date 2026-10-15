"use client";

import { useCallback, useEffect, useState } from "react";
import { Gaveta } from "@/components/gaveta";
import { Aviso, Botao, Chip, Entrada, Selecao, Selo, Vazio } from "@/components/ui";
import { apagarDestino, apagarSilencio, lerDestinos, lerSilencios, salvarDestino, type Destinatario, type SilencioGravado } from "@/lib/dados/alertas";
import { normalizarTelefone } from "@/lib/dominio/alertas/gestao";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { erroTexto, quando } from "./comum";

const NOVO: Destinatario = { nome: "", telefone: null, grupo_id: null, tipo: "supervisor", supervisor: null, regras: [], nao_perturbe_ini: null, nao_perturbe_fim: null, resumo_diario: false, ativo: true };
const TIPOS: Destinatario["tipo"][] = ["supervisor", "coordenador", "grupo", "teste"];
const ROTULO_TIPO: Record<Destinatario["tipo"], string> = { supervisor: "Supervisor", coordenador: "Coordenador", grupo: "Grupo do WhatsApp", teste: "Teste (modo teste)" };
const SUPERVISORES = ["Junior Pereira", "Donizete", "Genésio"];
const telVisivel = (t: string | null) => (t ? t.replace(/^55(\d{2})(\d{4,5})(\d{4})$/, "($1) $2-$3") : "");

function Formulario({ inicial, fechar, aoSalvar }: { inicial: Destinatario; fechar: () => void; aoSalvar: () => void }) {
  const [d, setD] = useState(inicial);
  const [telefone, setTelefone] = useState(telVisivel(inicial.telefone));
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const grupo = d.tipo === "grupo";
  async function salvar() {
    const nome = d.nome.trim();
    const tel = grupo ? null : normalizarTelefone(telefone);
    if (nome.length < 2 || nome.length > 60) return setErro("O nome precisa ter de 2 a 60 letras.");
    if (!grupo && !tel) return setErro("Telefone inválido: use DDD + número, ex.: (31) 98888-7777.");
    if (grupo && !d.grupo_id?.trim()) return setErro("Informe o código do grupo do WhatsApp.");
    setSalvando(true);
    try {
      // supervisor só vale para o tipo supervisor
      await salvarDestino({ ...d, nome, telefone: tel, grupo_id: grupo ? (d.grupo_id?.trim() ?? null) : null, supervisor: d.tipo === "supervisor" ? d.supervisor : null });
      aoSalvar();
      fechar();
    } catch (e) {
      setErro(erroTexto(e));
      setSalvando(false);
    }
  }
  const alternar = (r: RegraExcecao) => setD({ ...d, regras: d.regras.includes(r) ? d.regras.filter((x) => x !== r) : [...d.regras, r] });
  return (
    <Gaveta
      titulo={inicial.id ? `Editar ${inicial.nome}` : "Novo destinatário"}
      fechar={fechar}
      largura="min(480px, 100vw)"
      rodape={
        <div className="flex gap-2">
          <Botao disabled={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
          <Botao variante="secundaria" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
      }
    >
      <div className="space-y-4 p-5 text-[13px]">
        <label className="flex flex-col gap-1">
          <span className="text-suave">Nome</span>
          <Entrada value={d.nome} maxLength={60} onChange={(e) => setD({ ...d, nome: e.target.value })} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-suave">Tipo</span>
          <Selecao value={d.tipo} onChange={(e) => setD({ ...d, tipo: e.target.value as Destinatario["tipo"] })}>
            {TIPOS.map((t) => (
              <option key={t} value={t}>
                {ROTULO_TIPO[t]}
              </option>
            ))}
          </Selecao>
        </label>
        {grupo ? (
          <label className="flex flex-col gap-1">
            <span className="text-suave">Código do grupo</span>
            <Entrada value={d.grupo_id ?? ""} onChange={(e) => setD({ ...d, grupo_id: e.target.value })} />
          </label>
        ) : (
          <label className="flex flex-col gap-1">
            <span className="text-suave">Telefone (WhatsApp)</span>
            <Entrada placeholder="(31) 98888-7777" inputMode="tel" value={telefone} onChange={(e) => setTelefone(e.target.value)} />
          </label>
        )}
        {d.tipo === "supervisor" && (
          <label className="flex flex-col gap-1">
            <span className="text-suave">Recebe os alertas das vagas de</span>
            <Selecao value={d.supervisor ?? ""} onChange={(e) => setD({ ...d, supervisor: e.target.value || null })}>
              <option value="">Escolha</option>
              {SUPERVISORES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Selecao>
          </label>
        )}
        <div className="space-y-1.5">
          <span className="text-suave">Regras (nenhuma marcada = todas)</span>
          <div className="flex flex-wrap gap-1.5">
            {REGRAS.map((r) => (
              <Chip key={r} ativo={d.regras.includes(r)} onClick={() => alternar(r)}>
                {ROTULO_REGRA[r]}
              </Chip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-suave">Não perturbe das</span>
          <Entrada type="time" value={d.nao_perturbe_ini?.slice(0, 5) ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_ini: e.target.value || null })} aria-label="Não perturbe: início" />
          <span className="text-suave">às</span>
          <Entrada type="time" value={d.nao_perturbe_fim?.slice(0, 5) ?? ""} onChange={(e) => setD({ ...d, nao_perturbe_fim: e.target.value || null })} aria-label="Não perturbe: fim" />
        </div>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.resumo_diario} onChange={(e) => setD({ ...d, resumo_diario: e.target.checked })} /> Recebe o resumo diário
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={d.ativo} onChange={(e) => setD({ ...d, ativo: e.target.checked })} /> Ativo
        </label>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </Gaveta>
  );
}

/** Aba Destinatários: quem recebe (tabela, edição em gaveta) e os silêncios valendo. Telefone é dado pessoal: só com login. */
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
        setErro(null);
      },
      (e: unknown) => setErro(erroTexto(e)),
    );
  }, []);
  useEffect(() => {
    if (logado) ler();
  }, [logado, ler]);
  const tentar = (p: Promise<unknown>) => p.then(ler, (e: unknown) => setErro(erroTexto(e)));
  if (!logado) return <Vazio titulo="Entre para ver e editar quem recebe">Os telefones são dados pessoais: só aparecem para quem entrou com e-mail e senha.</Vazio>;
  return (
    <div className="space-y-4">
      {erro && <Aviso tipo="erro">{erro}</Aviso>}
      <section aria-label="Destinatários" className="overflow-x-auto rounded-xl border border-borda bg-superficie shadow-sm">
        <div className="flex items-center justify-between border-b border-borda p-3">
          <p className="font-semibold">Quem recebe</p>
          <Botao tamanho="mini" onClick={() => setEditando(NOVO)}>
            + Destinatário
          </Botao>
        </div>
        {lista.length ? (
          <table className="w-full text-[13px]">
            <thead className="text-left text-xs text-suave">
              <tr className="border-b border-borda">
                <th className="px-3 py-2 font-medium">Nome</th>
                <th className="px-3 py-2 font-medium">Tipo</th>
                <th className="px-3 py-2 font-medium">Contato</th>
                <th className="px-3 py-2 font-medium">Regras</th>
                <th className="px-3 py-2 font-medium">Não perturbe</th>
                <th className="px-3 py-2 font-medium">Resumo</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lista.map((d) => (
                <tr key={d.id} className="border-b border-borda last:border-b-0">
                  <td className="px-3 py-2 font-medium">
                    {d.nome} {!d.ativo && <Selo tom="na">Inativo</Selo>}
                  </td>
                  <td className="px-3 py-2">
                    {ROTULO_TIPO[d.tipo]}
                    {d.supervisor && <span className="text-suave"> · {d.supervisor}</span>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{telVisivel(d.telefone) || d.grupo_id}</td>
                  <td className="px-3 py-2 text-suave">{d.regras.length ? `${d.regras.length} regra(s)` : "Todas"}</td>
                  <td className="px-3 py-2 text-suave">{d.nao_perturbe_ini ? `${d.nao_perturbe_ini.slice(0, 5)}–${d.nao_perturbe_fim?.slice(0, 5) ?? ""}` : "—"}</td>
                  <td className="px-3 py-2">{d.resumo_diario ? "Sim" : "—"}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Botao tamanho="mini" variante="secundaria" onClick={() => setEditando(d)}>
                      Editar
                    </Botao>{" "}
                    <Botao tamanho="mini" variante="discreta" onClick={() => d.id && confirm(`Apagar ${d.nome}?`) && void tentar(apagarDestino(d.id))}>
                      Apagar
                    </Botao>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <Vazio titulo="Ninguém cadastrado ainda">Comece por você mesmo, como “Teste”: no modo teste, tudo vai só para ele.</Vazio>
        )}
      </section>
      <section aria-label="Silêncios" className="rounded-xl border border-borda bg-superficie shadow-sm">
        <p className="border-b border-borda p-3 font-semibold">Silêncios valendo</p>
        <ul className="divide-y divide-borda text-[13px]">
          {silencios.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span>
                {s.veiculo_id ? `Equipamento ${s.veiculo_id}` : "Todos"} · {s.regra ? (ROTULO_REGRA[s.regra as RegraExcecao] ?? s.regra) : "todas as regras"} · até {quando(s.ate)} ·{" "}
                <span className="text-suave">{s.motivo}</span>
              </span>
              <Botao tamanho="mini" variante="discreta" className="ml-auto" onClick={() => void tentar(apagarSilencio(s.id))}>
                Tirar silêncio
              </Botao>
            </li>
          ))}
          {!silencios.length && <li className="px-3 py-2 text-suave">Nenhum silêncio valendo.</li>}
        </ul>
        <p className="border-t border-borda px-3 py-2 text-xs text-suave">Tirar o silêncio vale para os próximos alertas; os já silenciados ficam assim no histórico.</p>
      </section>
      {editando && <Formulario key={editando.id ?? "novo"} inicial={editando} fechar={() => setEditando(null)} aoSalvar={ler} />}
    </div>
  );
}
