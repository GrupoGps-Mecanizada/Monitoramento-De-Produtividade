import { textoEvento } from "@/lib/dominio/eventos";
import type { Evento } from "@/lib/tipos";

/** "EOF5208 ⚙ motor 2º entrou em PATIO · ficou 15 min" com placa e alvo em negrito. */
export function EventoTexto({ e }: { e: Evento }) {
  const t = textoEvento(e);
  return (
    <>
      <b>{t.quem}</b>
      {t.motor2 && <span className="text-motor2"> ⚙ motor 2º</span>} {t.acao} <b>{t.alvo}</b>
      {t.extra}
    </>
  );
}
