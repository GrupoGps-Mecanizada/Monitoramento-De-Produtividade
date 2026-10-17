"use client";

import { useState, type FormEvent } from "react";
import { Aviso, Botao, Entrada } from "@/components/ui";
import { useGestaoDados } from "@/lib/dados/alertas";
import { diaLocal } from "@/lib/dominio/formato";
import { useSessao, type Sessao } from "@/lib/supabase/sessao";
import { AbasTexto } from "./comum";
import { Destinos } from "./destinos";
import { Filtro } from "./filtro";
import { PainelAlertas } from "./painel-alertas";
import { Saude } from "./saude";

type Aba = "alertas" | "filtro" | "destinos" | "saude";
const ABAS: { id: Aba; rotulo: string }[] = [
  { id: "alertas", rotulo: "Alertas" },
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
      <Botao tamanho="mini" variante="secundaria" onClick={() => setAberto(true)}>
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
  const [aba, setAba] = useState<Aba>("alertas");
  const [hoje] = useState(() => diaLocal());
  const logado = !!sessao.email;
  const { alertas, config, erro, recarregar } = useGestaoDados(hoje, logado);
  return (
    // página toda branca, separada só por linhas finas e espaço (estilo A, escolhido pelo dono em 16/10/2026)
    <div className="min-h-[calc(100dvh-64px)] w-full bg-superficie pb-24 md:pb-12">
      <header className="border-b border-borda">
        <div className="flex w-full flex-wrap items-end gap-3 px-4 pt-3 md:px-8">
          <AbasTexto<Aba> grande semLinha rotulo="Gestão de alertas" valor={aba} mudar={setAba} abas={ABAS} />
          <span className="ml-auto pb-2">
            <Entrar s={sessao} />
          </span>
        </div>
      </header>
      <div className="w-full px-4 pt-6 md:px-8 md:pt-8">
        <div className="space-y-6">
      {erro && (
        <Aviso tipo="erro">
          Não deu para ler os alertas ({erro}). Se for a primeira vez, rode o SQL <code>supabase/alertas.sql</code> no Supabase PRODUTIVIDADE.
        </Aviso>
      )}
      {aba === "alertas" && <PainelAlertas alertas={alertas} hoje={hoje} email={sessao.email} aoMudar={recarregar} />}
      {aba === "filtro" && (config ? <Filtro alertas={alertas} config={config} hoje={hoje} logado={logado} aoSalvar={recarregar} /> : !erro && <p>Carregando…</p>)}
      {aba === "destinos" && <Destinos logado={logado} />}
      {aba === "saude" && <Saude alertas={alertas} logado={logado} />}
        </div>
      </div>
    </div>
  );
}
