"use client";

import { useCallback, useEffect, useState } from "react";
import { Aviso, Botao, Chip, Entrada, Selecao, Selo, Vazio, cx } from "@/components/ui";
import { apagarDestino, apagarSilencio, lerDestinos, lerSilencios, salvarDestino, type Destinatario, type SilencioGravado } from "@/lib/dados/alertas";
import { REGRAS, ROTULO_REGRA, type RegraExcecao } from "@/lib/dominio/excecoes";
import { erroTexto, quando } from "./comum";

const NOVO: Destinatario = { nome: "", tipo: "supervisor", supervisor: null, regras: [], nao_perturbe_ini: null, nao_perturbe_fim: null, resumo_diario: false, ativo: true };
const TIPOS: Destinatario["tipo"][] = ["supervisor", "coordenador", "grupo", "teste"];
const ROTULO_TIPO: Record<Destinatario["tipo"], string> = { supervisor: "Supervisor", coordenador: "Coordenador", grupo: "Grupo do WhatsApp", teste: "Teste (modo teste)" };
const SUPERVISORES = ["Junior Pereira", "Donizete", "Genésio"];
const titulo = "text-[11px] font-semibold uppercase tracking-wider text-suave";

/** Cadastro/edição ao lado da tabela (modelo 32). */
function Formulario({ inicial, fechar, aoSalvar }: { inicial: Destinatario; fechar: () => void; aoSalvar: () => void }) {
  const [d, setD] = useState(inicial);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const nomeTela = inicial.id ? `Editar ${inicial.nome}` : "Novo destinatário";
  async function salvar() {
    const nome = d.nome.trim();
    if (nome.length < 2 || nome.length > 60) return setErro("O nome precisa ter de 2 a 60 letras.");
    setSalvando(true);
    try {
      // supervisor só vale para o tipo supervisor
      await salvarDestino({ ...d, nome, supervisor: d.tipo === "supervisor" ? d.supervisor : null });
      aoSalvar();
      fechar();
    } catch (e) {
      setErro(erroTexto(e));
      setSalvando(false);
    }
  }
  const alternar = (r: RegraExcecao) => setD({ ...d, regras: d.regras.includes(r) ? d.regras.filter((x) => x !== r) : [...d.regras, r] });
  return (
    <aside aria-label={nomeTela} className="min-w-0 lg:sticky lg:top-4 lg:self-start lg:border-l lg:border-borda lg:pl-6">
      <header className="flex items-start gap-3 pb-4">
        <h2 className="flex-1 text-lg font-semibold">{nomeTela}</h2>
        <button type="button" onClick={fechar} aria-label="Fechar" className="grid h-8 w-8 place-items-center rounded-lg text-suave hover:bg-superficie-2 hover:text-texto">
          ×
        </button>
      </header>
      <div className="space-y-4 text-[13px]">
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
        <p className="text-xs text-suave">O número do WhatsApp fica só no programa de envio do seu PC, nunca na internet: aqui vai só o nome.</p>
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
        <div className="flex gap-2 pt-2">
          <Botao disabled={salvando} onClick={() => void salvar()}>
            Salvar
          </Botao>
          <Botao variante="discreta" onClick={fechar}>
            Cancelar
          </Botao>
        </div>
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
      </div>
    </aside>
  );
}

/** Aba Destinatários: quem recebe (tabela sem grade, edição ao lado) e os silêncios valendo. Sem telefone: ele fica no programa de envio do PC. */
export function Destinos() {
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
    ler();
  }, [ler]);
  const tentar = (p: Promise<unknown>) => p.then(ler, (e: unknown) => setErro(erroTexto(e)));
  return (
    <div className={cx("grid gap-6", editando && "lg:grid-cols-[minmax(0,1fr)_420px]")}>
      <div className="min-w-0 space-y-10">
        {erro && <Aviso tipo="erro">{erro}</Aviso>}
        <section aria-label="Destinatários" className="space-y-3">
          <div className="flex items-center justify-between">
            <p className={titulo}>Quem recebe</p>
            <button type="button" className="text-[13px] font-medium text-link hover:underline" onClick={() => setEditando(NOVO)}>
              + Destinatário
            </button>
          </div>
          {lista.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead className="text-left text-[11px] uppercase tracking-wider text-suave">
                  <tr className="border-b border-borda">
                    <th className="py-2 pr-3 font-medium">Nome</th>
                    <th className="px-3 py-2 font-medium">Tipo</th>
                    <th className="px-3 py-2 font-medium">Regras</th>
                    <th className="px-3 py-2 font-medium">Não perturbe</th>
                    <th className="px-3 py-2 font-medium">Resumo</th>
                    <th className="px-3 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {lista.map((d) => (
                    <tr key={d.id} onClick={() => setEditando(d)} className={cx("cursor-pointer border-b border-borda/60 hover:bg-superficie-2", editando?.id === d.id && "bg-primaria-suave hover:bg-primaria-suave")}>
                      <td className="py-2 pr-3 font-medium">
                        {d.nome} {!d.ativo && <Selo tom="na">Inativo</Selo>}
                      </td>
                      <td className="px-3 py-2">
                        {ROTULO_TIPO[d.tipo]}
                        {d.supervisor && <span className="text-suave"> · {d.supervisor}</span>}
                      </td>
                      <td className="px-3 py-2 text-suave">{d.regras.length ? `${d.regras.length} regra(s)` : "Todas"}</td>
                      <td className="px-3 py-2 text-suave">{d.nao_perturbe_ini ? `${d.nao_perturbe_ini.slice(0, 5)}–${d.nao_perturbe_fim?.slice(0, 5) ?? ""}` : "—"}</td>
                      <td className="px-3 py-2">{d.resumo_diario ? "Sim" : "—"}</td>
                      <td className="whitespace-nowrap px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                        <button type="button" className="text-[13px] text-suave hover:text-texto" onClick={() => d.id && confirm(`Apagar ${d.nome}?`) && void tentar(apagarDestino(d.id))}>
                          Apagar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Vazio titulo="Ninguém cadastrado ainda">Comece por você mesmo, como “Teste”: no modo teste, tudo vai só para ele.</Vazio>
          )}
        </section>
        <section aria-label="Silêncios" className="space-y-2">
          <p className={titulo}>Silêncios valendo</p>
          <ul className="divide-y divide-borda/60 border-y border-borda/60 text-[13px]">
            {silencios.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-2 py-2">
                <span>
                  {s.veiculo_id ? `Equipamento ${s.veiculo_id}` : "Todos"} · {s.regra ? (ROTULO_REGRA[s.regra as RegraExcecao] ?? s.regra) : "todas as regras"} · até {quando(s.ate)} ·{" "}
                  <span className="text-suave">{s.motivo}</span>
                </span>
                <button type="button" className="ml-auto text-[13px] font-medium text-link hover:underline" onClick={() => void tentar(apagarSilencio(s.id))}>
                  Tirar silêncio
                </button>
              </li>
            ))}
            {!silencios.length && <li className="py-2 text-suave">Nenhum silêncio valendo.</li>}
          </ul>
          <p className="text-xs text-suave">Tirar o silêncio vale para os próximos alertas; os já silenciados ficam assim no histórico.</p>
        </section>
      </div>
      {editando && <Formulario key={editando.id ?? "novo"} inicial={editando} fechar={() => setEditando(null)} aoSalvar={ler} />}
    </div>
  );
}
