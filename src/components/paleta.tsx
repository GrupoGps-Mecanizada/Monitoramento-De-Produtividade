"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { buscar, guardarRecente, lerRecentes, norm, sugestoes } from "@/lib/busca";
import { corDoTom } from "@/lib/cores";
import { lerCercas } from "@/lib/dados/leituras";
import { useEventos } from "@/lib/dados/use-eventos";
import { useRetrato } from "@/lib/dados/use-retrato";
import { TIPOS_EQUIP, nomeEquip } from "@/lib/dominio/equipamentos";
import { chaveEvento, textoEvento, veiculoDoEvento } from "@/lib/dominio/eventos";
import { diaLocal, hora } from "@/lib/dominio/formato";
import { CATEGORIAS, categoria, semMotor2 } from "@/lib/dominio/veiculo";
import { MENU, telaAtiva } from "@/lib/menu";
import { pedirNavegacao } from "@/lib/navegacao";
import { useTema } from "@/lib/tema";
import type { Cerca, Evento, Veiculo } from "@/lib/tipos";
import { CAMINHOS } from "./icones";
import { cx } from "./ui";

/** Busca geral (Ctrl K, ⌘K ou "/"): veículos, áreas/ruas/cercas, eventos de hoje, telas e tema. */
let aberta = false;
const ouvintes = new Set<() => void>();
const emitir = () => ouvintes.forEach((f) => f());
const assinar = (f: () => void) => {
  ouvintes.add(f);
  return () => void ouvintes.delete(f);
};
export function abrirPaleta() {
  aberta = true;
  emitir();
}
const fecharPaleta = () => {
  aberta = false;
  emitir();
};

/** Montada uma vez na casca. Os dados só são lidos com a janela aberta. */
export function Paleta() {
  const ok = useSyncExternalStore(assinar, () => aberta, () => false);
  useEffect(() => {
    const tecla = (e: KeyboardEvent) => {
      const digitando = (e.target as HTMLElement | null)?.closest?.("input, textarea, select, [contenteditable]");
      if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !digitando)) {
        e.preventDefault();
        if (aberta) fecharPaleta();
        else abrirPaleta();
      }
    };
    window.addEventListener("keydown", tecla);
    return () => window.removeEventListener("keydown", tecla);
  }, []);
  return ok ? <Janela /> : null;
}

interface Item {
  chave: string;
  rotulo: string;
  sub: string;
  cor?: string;
  icone?: string;
  executar: () => void;
  extra?: { rotulo: string; executar: () => void };
}
const TIPO_CERCA = { area: "Área", via: "Rua / via", planta: "Planta" } as const;

function Janela() {
  const router = useRouter();
  const caminho = usePathname();
  const { retrato } = useRetrato();
  const [hoje] = useState(() => diaLocal());
  const { eventos } = useEventos(hoje);
  const [cercas, setCercas] = useState<Cerca[]>([]);
  useEffect(() => {
    lerCercas().then(setCercas, () => undefined);
  }, []);
  const [tema, alternarTema] = useTema();
  const [q, setQ] = useState("");
  const [ativo, setAtivo] = useState(0);
  const [recentes] = useState(lerRecentes);
  const dialogo = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    dialogo.current?.showModal();
  }, []);

  const destino = telaAtiva(caminho, "/timeline") ? "timeline" : "mapa";
  const dados = { veiculos: semMotor2(retrato?.veiculos ?? []), cercas, eventos };
  const termo = q.trim();

  const sair = () => {
    guardarRecente(q);
    fecharPaleta();
  };
  const irVeiculo = (id: string, para: "mapa" | "timeline") => {
    sair();
    if (para === "timeline") router.push(`/timeline/?v=${encodeURIComponent(id)}&dia=${hoje}`);
    else if (!pedirNavegacao({ tipo: "veiculo", id })) router.push(`/#v=${encodeURIComponent(id)}`);
  };
  const irCerca = (nome: string) => {
    sair();
    if (!pedirNavegacao({ tipo: "cerca", nome })) router.push(`/#cerca=${encodeURIComponent(nome)}`);
  };

  const itemVeiculo = (v: Veiculo): Item => {
    const outro = destino === "mapa" ? "timeline" : "mapa";
    return {
      chave: `v:${v.id}`,
      rotulo: v.motor2 ? `${nomeEquip(v)} · ⚙ ${v.motor2.placa}` : nomeEquip(v),
      sub: [v.equip ? TIPOS_EQUIP[v.equip.tipo].rotulo : "", v.motor2 ? `${v.status} · ⚙ 2º ${v.motor2.status}` : v.status, v.vaga || "sem vaga", v.area || v.via || "fora de cerca", v.motorista].filter(Boolean).join(" · "),
      cor: corDoTom(CATEGORIAS[categoria(v)].tom),
      executar: () => irVeiculo(v.id, destino),
      extra: { rotulo: outro === "timeline" ? "Timeline" : "Mapa", executar: () => irVeiculo(v.id, outro) },
    };
  };
  const itemCerca = (c: Cerca, ocupacao: Map<string, number>): Item => {
    const n = ocupacao.get(c.name) ?? 0;
    return { chave: `c:${c.name}`, rotulo: c.name, sub: `${TIPO_CERCA[c.tipo]}${n ? ` · ${n} veículo${n > 1 ? "s" : ""} agora` : ""}`, cor: c.color, executar: () => irCerca(c.name) };
  };
  const itemEvento = (e: Evento): Item => {
    const t = textoEvento(e);
    return {
      chave: `e:${chaveEvento(e)}`,
      rotulo: `${t.quem}${t.motor2 ? " ⚙ motor 2º" : ""} · ${hora(e.t)}`,
      sub: `${t.acao} ${t.alvo}${t.extra}`.trim(),
      cor: "var(--neu-dot)",
      executar: () => irVeiculo(veiculoDoEvento(e), destino),
    };
  };
  const telas: Item[] = MENU.map((m) => ({
    chave: `t:${m.href}`,
    rotulo: m.rotulo,
    sub: "tela",
    icone: CAMINHOS[m.icone],
    executar: () => {
      fecharPaleta();
      router.push(m.href);
    },
  }));
  const acoes: Item[] = [
    {
      chave: "a:tema",
      rotulo: tema === "escuro" ? "Tema claro" : "Tema escuro",
      sub: "aparência",
      icone: CAMINHOS.tema,
      executar: () => {
        alternarTema();
        fecharPaleta();
      },
    },
  ];
  const casa = (i: Item) => norm(`${i.rotulo} ${i.sub}`).includes(norm(termo));

  let grupos: { nome: string; itens: Item[] }[];
  if (!termo) {
    const s = sugestoes(dados);
    grupos = [
      { nome: "Ligados agora", itens: s.ligados.slice(0, 8).map(itemVeiculo) },
      { nome: "Áreas com mais veículos", itens: s.areas.map((c) => itemCerca(c, s.ocupacao)) },
      { nome: "Telas", itens: telas },
      { nome: "Ações", itens: acoes },
    ];
  } else {
    const r = buscar(dados, termo);
    grupos = [
      { nome: "Veículos", itens: r.veiculos.slice(0, 20).map(itemVeiculo) },
      { nome: "Áreas, ruas e cercas", itens: r.cercas.slice(0, 15).map((c) => itemCerca(c, r.ocupacao)) },
      { nome: "Eventos de hoje", itens: r.eventos.slice(0, 12).map(itemEvento) },
      { nome: "Telas", itens: telas.filter(casa) },
      { nome: "Ações", itens: acoes.filter(casa) },
    ];
  }
  grupos = grupos.filter((g) => g.itens.length);
  const plano = grupos.flatMap((g) => g.itens);
  const sel = Math.min(ativo, Math.max(0, plano.length - 1));

  return (
    <dialog
      ref={dialogo}
      aria-label="Buscar"
      onClose={fecharPaleta}
      onClick={(e) => e.target === e.currentTarget && dialogo.current?.close()}
      className="m-0 mx-auto mt-[72px] w-[min(640px,calc(100vw-24px))] max-w-none overflow-hidden rounded-xl border border-borda bg-superficie p-0 text-texto shadow-2xl backdrop:bg-black/40"
    >
      <div className="flex h-[58px] items-center gap-3 border-b border-borda px-4">
        <svg viewBox="0 0 24 24" className="h-[18px] w-[18px] text-suave" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <path d={CAMINHOS.busca} />
        </svg>
        <input
          autoFocus
          type="search"
          enterKeyHint="search"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setAtivo(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setAtivo(Math.min(plano.length - 1, sel + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setAtivo(Math.max(0, sel - 1));
            } else if (e.key === "Enter" && plano[sel]) {
              e.preventDefault();
              plano[sel].executar();
            }
          }}
          placeholder="Placa, motorista, vaga, área, rua…"
          aria-label="Buscar veículo, área, rua ou evento"
          className="h-full flex-1 bg-transparent text-base"
          style={{ border: 0, boxShadow: "none" }}
        />
        <kbd className="hidden rounded border border-borda px-1.5 py-0.5 text-[11px] text-suave md:inline">Esc</kbd>
      </div>
      {!termo && recentes.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-b border-borda px-4 py-2.5">
          {recentes.map((r) => (
            <button key={r} type="button" onClick={() => setQ(r)} className="rounded-full border border-borda bg-superficie-2 px-2.5 py-0.5 text-xs text-suave hover:text-texto">
              {r}
            </button>
          ))}
        </div>
      )}
      <div className="max-h-[min(420px,60dvh)] space-y-0.5 overflow-y-auto p-2" role="listbox" aria-label="Resultados">
        {(() => {
          let i = -1;
          return grupos.map((g) => (
            <div key={g.nome}>
              <p className="flex justify-between px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-suave">
                <span>{g.nome}</span>
                <span>{g.itens.length}</span>
              </p>
              {g.itens.map((it) => {
                i++;
                const meu = i;
                return (
                  <div
                    key={it.chave}
                    role="option"
                    aria-selected={meu === sel}
                    onMouseEnter={() => setAtivo(meu)}
                    onClick={it.executar}
                    className={cx("flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-2.5 py-1.5", meu === sel && "bg-superficie-2")}
                  >
                    {it.icone ? (
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md border border-borda bg-superficie-2 text-suave">
                        <svg viewBox="0 0 24 24" className="h-[15px] w-[15px]" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <path d={it.icone} />
                        </svg>
                      </span>
                    ) : (
                      <span aria-hidden className="mx-2.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: it.cor }} />
                    )}
                    <span className="min-w-0 flex-1 leading-snug">
                      <span className="block truncate font-medium">{it.rotulo}</span>
                      <span className="block truncate text-xs text-suave">{it.sub}</span>
                    </span>
                    {it.extra && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          it.extra!.executar();
                        }}
                        className="shrink-0 rounded-md border border-borda px-2 py-1 text-xs font-semibold text-link hover:bg-superficie"
                      >
                        {it.extra.rotulo}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ));
        })()}
        {!plano.length && <p className="px-4 py-9 text-center text-suave">Nada encontrado para “{q}”.</p>}
        {!termo && <p className="px-3 pb-2 pt-3 text-xs text-suave">Busque por placa (com ou sem hífen), motor secundário, motorista, vaga, área, rua ou evento.</p>}
      </div>
    </dialog>
  );
}
