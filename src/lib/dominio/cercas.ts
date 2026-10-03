import type { TipoCerca } from "../tipos";

// Ruas/avenidas também são cercas no GAUSS. Para entrada/saída só contam as áreas de verdade (pátios,
// oficinas, baias...): rua é trânsito e geraria um evento a cada esquina. Plantas (layer 3) cobrem a usina inteira.
const VIA = /^(RUA|R\.|AV\b|AV\.|AVENIDA|PN-|CANCELA)/i;

export function tipoCerca(c: { layer: number; name: string }): TipoCerca {
  if (c.layer === 3) return "planta";
  if (VIA.test(c.name)) return "via";
  return "area";
}
