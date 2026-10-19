// Etapa 3 dos alertas (P-026): o que mandar e o texto da mensagem. Tudo puro (o enviar.ts só lê, manda e marca).
// Pedido do dono (19/10/2026): só importa mandar ou não no WhatsApp, numa mensagem só juntando os alertas novos.
import { ROTULO_REGRA, type RegraExcecao } from "../src/lib/dominio/excecoes";
import { lerVaga } from "../src/lib/dominio/supervisor-vaga";

export interface AlertaEnvio {
  id: number;
  regra: string;
  placa: string;
  vaga: string;
  supervisor: string | null;
  dia: string;
  /** segundos do dia */
  ini: number;
  local: string | null;
  detalhe: string;
  destino: string;
  situacao: string;
  ultimo_aviso_em: string | null;
}

/** Mais que isso numa mensagem fica difícil de ler: o resto vai resumido. */
export const MAX_ITENS = 12;

/** Os que vão para o WhatsApp, de hoje, ainda não avisados e que não acabaram (PC desligado: alerta velho não sai). */
export const paraEnviar = (alertas: AlertaEnvio[], hoje: string) =>
  alertas
    .filter((a) => a.destino === "whatsapp" && !a.ultimo_aviso_em && a.dia === hoje && a.situacao !== "resolvido" && a.situacao !== "silenciado")
    .sort((p, q) => p.ini - q.ini || p.id - q.id);

const SIGLA = { ap: "AP", av: "AV", hv: "HV" } as const;
/** "AUTO VÁCUO - GPS - 05" -> "AV 05" */
function vagaCurta(vaga: string): string {
  const v = lerVaga(vaga);
  return v?.tipo && v.tipo in SIGLA ? `${SIGLA[v.tipo as keyof typeof SIGLA]} ${String(v.num).padStart(2, "0")}` : vaga;
}
const hhmm = (seg: number) => `${String(Math.floor(seg / 3600)).padStart(2, "0")}:${String(Math.floor((seg % 3600) / 60)).padStart(2, "0")}`;
const quando = (d: Date) => {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d)
      .map((x) => [x.type, x.value]),
  );
  return `${p.day}/${p.month} ${p.hour}:${p.minute}`;
};

/** Uma mensagem só (negrito do WhatsApp entre asteriscos). */
export function montarMensagem(alertas: AlertaEnvio[], agora: Date): string {
  const itens = alertas.slice(0, MAX_ITENS).map((a) => {
    const vaga = a.vaga ? ` (${vagaCurta(a.vaga)})` : "";
    const regra = ROTULO_REGRA[a.regra as RegraExcecao] ?? a.regra;
    const linha2 = [a.detalhe, hhmm(a.ini), a.local, a.supervisor].filter(Boolean).join(" · ");
    return `• *${a.placa}*${vaga} · ${regra}\n  ${linha2}`;
  });
  const resto = alertas.length - MAX_ITENS;
  return [`🚨 *Alertas da frota* · ${quando(agora)}`, "", itens.join("\n"), ...(resto > 0 ? ["", `+${resto} outros: veja na Gestão de alertas`] : [])].join("\n");
}
