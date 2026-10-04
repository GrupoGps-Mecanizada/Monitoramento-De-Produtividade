import { corDoTom } from "../cores";
import { idadeCurta } from "../dominio/formato";
import { TIPOS_EQUIP, nomeEquip } from "../dominio/equipamentos";
import { CATEGORIAS, FRESCOR, categoria, frescor, motor2Ligado } from "../dominio/veiculo";
import type { Veiculo } from "../tipos";

const ENTIDADES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
/** Escapa texto que vai dentro do HTML de marcadores e dicas do Leaflet. */
export const esc = (s: unknown) => String(s ?? "").replace(/[&<>"']/g, (c) => ENTIDADES[c]);

/** HTML do marcador (Leaflet divIcon): cor do status, seta na direção quando anda ao vivo, ⚙ com o motor 2º ligado e idade da posição. */
export function htmlMarcador(v: Veiculo, sel: boolean, semSinalMin: number, agora: number): string {
  const cat = categoria(v);
  const fr = frescor(v, semSinalMin, agora);
  const seta = cat === "ligado" && fr === "vivo" ? `<span class="seta" style="transform:rotate(${Number(v.direcao) || 0}deg)">▲</span>` : '<span class="seta">●</span>';
  const m2 = motor2Ligado(v) ? '<span class="m2" title="Motor secundário ligado">⚙</span>' : "";
  const titulo = `${nomeEquip(v)}${v.equip ? ` (${TIPOS_EQUIP[v.equip.tipo].rotulo})` : ""} · ${v.status}${v.motor2 ? ` · motor 2º ${v.motor2.status}` : ""} · ${FRESCOR[fr].rotulo}`;
  const classe = `mk${fr === "semsinal" ? " semsinal" : ""}${sel ? " sel" : ""}`;
  const sigla = v.equip ? `<b class="sg">${TIPOS_EQUIP[v.equip.tipo].sigla}</b>` : "";
  return `<div class="${classe}" style="--c:${corDoTom(CATEGORIAS[cat].tom)}" title="${esc(titulo)}">${seta}${sigla}${esc(nomeEquip(v))}${m2} <small>${idadeCurta(v.posicao_em, agora)}</small></div>`;
}

/** Rótulo em pílula (início e fim da rota). */
export const htmlRotulo = (texto: string, cor: string) => `<div class="mk" style="--c:${cor}">${esc(texto)}</div>`;
