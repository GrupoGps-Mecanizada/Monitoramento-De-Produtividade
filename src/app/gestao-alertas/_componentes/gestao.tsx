"use client";

import { useState, type FormEvent } from "react";
import { Aviso, Botao, Entrada, cx } from "@/components/ui";
import { useGestaoDados } from "@/lib/dados/alertas";
import { diaLocal } from "@/lib/dominio/formato";
import { useSessao, type Sessao } from "@/lib/supabase/sessao";
import { Destinos } from "./destinos";
import { Filtro } from "./filtro";
import { Fila } from "./fila";
import { Historico } from "./historico";
import { Saude } from "./saude";

type Aba = "fila" | "historico" | "filtro" | "destinos" | "saude";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "fila", rotulo: "Fila" },
  { id: "historico", rotulo: "Histórico" },
  { id: "filtro", rotulo: "Filtro inteligente" },
  { id: "destinos", rotulo: "Destinatários" },
  { id: "saude", rotulo: "Saúde" },
];

function Entrar({ s }: { s: Sessao }) {
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  if (s.carregando) return null;
  if (s.email)
    return (
      <span className="flex items-center gap-2 text-sm text-suave">
        {s.email}
        <Botao tamanho="mini" variante="secundaria" onClick={() => void s.sair()}>
          Sair
        </Botao>
      </span>
    );
  if (!aberto)
    return (
      <Botao tamanho="mini" onClick={() => setAberto(true)}>
        Entrar
      </Botao>
    );
  async function enviar(e: FormEvent) {
    e.preventDefault();
    setErro(await s.entrar(email, senha));
  }
  return (
    <form onSubmit={(e) => void enviar(e)} className="flex flex-wrap items-center gap-2">
      <Entrada type="email" placeholder="E-mail" aria-label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
      <Entrada type="password" placeholder="Senha" aria-label="Senha" value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="current-password" />
      <Botao type="submit" tamanho="mini">
        Entrar
      </Botao>
      {erro && <span className="text-sm text-red-600">{erro}</span>}
    </form>
  );
}

/** Gestão de alertas (P-026): o que o robô gravou, o que vai para o WhatsApp e quem recebe. */
export function Gestao() {
  const sessao = useSessao();
  const [aba, setAba] = useState<Aba>("fila");
  const [hoje] = useState(() => diaLocal());
  const { alertas, config, erro, recarregar } = useGestaoDados(hoje);
  const logado = !!sessao.email;
  return (
    <div className="w-full space-y-4 px-4 pb-24 pt-5 md:px-8 md:pb-10 md:pt-7">
      <div className="flex flex-wrap items-center gap-3">
        <div role="tablist" aria-label="Gestão de alertas" className="flex w-fit flex-wrap gap-1 rounded-xl border border-borda bg-superficie p-1 shadow-sm">
          {ABAS.map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={a.id === aba}
              onClick={() => setAba(a.id)}
              className={cx("rounded-lg px-3 py-1.5 text-[13px] font-semibold", a.id === aba ? "bg-primaria text-white" : "text-suave hover:bg-superficie-2 hover:text-texto")}
            >
              {a.rotulo}
            </button>
          ))}
        </div>
        <span className="md:ml-auto">
          <Entrar s={sessao} />
        </span>
      </div>
      {erro && (
        <Aviso tipo="erro">
          Não deu para ler os alertas ({erro}). Se for a primeira vez, rode o SQL <code>supabase/alertas.sql</code> no Supabase PRODUTIVIDADE.
        </Aviso>
      )}
      {aba === "fila" && <Fila alertas={alertas} hoje={hoje} email={sessao.email} aoMudar={recarregar} />}
      {aba === "historico" && <Historico alertas={alertas} hoje={hoje} />}
      {aba === "filtro" && (config ? <Filtro key={JSON.stringify(config)} alertas={alertas} config={config} hoje={hoje} logado={logado} aoSalvar={recarregar} /> : !erro && <p>Carregando…</p>)}
      {aba === "destinos" && <Destinos logado={logado} />}
      {aba === "saude" && <Saude alertas={alertas} logado={logado} />}
    </div>
  );
}
