import type { Veiculo } from "../tipos";

/** Caminhão no formato que a maquete 3D (public/usina/maquete.html, projeto Usina Virtual) entende. */
export interface CaminhaoMaquete {
  placa: string;
  vaga: string;
  grupo: string;
  status: string;
  area: string;
  lat: number;
  lng: number;
  dir: number;
  em: string | null;
}

/**
 * Retrato ao vivo → frota da maquete. O motor secundário (placa + 2) vai dentro do caminhão e não vira outro
 * caminhão; veículo sem coordenada fica de fora; sem sinal vira "Sem comunicação" (a maquete pinta de laranja).
 */
export function frotaParaMaquete(veiculos: Veiculo[]): CaminhaoMaquete[] {
  return veiculos
    .filter((v) => !v.motor2_de && v.lat != null && v.lng != null)
    .map((v) => ({
      placa: v.placa,
      vaga: v.vaga,
      grupo: v.grupo,
      status: v.sem_sinal ? "Sem comunicação" : v.status,
      area: v.area,
      lat: v.lat as number,
      lng: v.lng as number,
      dir: v.direcao || 0,
      em: v.posicao_em,
    }));
}
