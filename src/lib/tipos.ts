/**
 * Formatos dos dados do Monitoramento, usados pelo site e pelo coletor (coletor/ importa este arquivo por
 * caminho relativo: ele não importa nada). Tirados do código do coletor e do que está gravado no Supabase
 * PRODUTIVIDADE (tabelas loc_*).
 */

export type LatLng = [number, number];
/** Tom de cor da identidade "Campo" (tokens --ok-dot, --warn-dot... em globals.css); mov = --serie-1, motor2 = --motor2. */
export type Tom = "ok" | "warn" | "bad" | "na" | "neu" | "reg" | "mov" | "motor2";

export type CategoriaVeiculo = "ligado" | "parado" | "desligado" | "manut" | "semcom" | "outro";
export type Frescor = "vivo" | "atrasado" | "semsinal";
export type EstadoTrecho = "movimento" | "parado_ligado" | "desligado" | "parado" | "sem_sinal";
export type TipoCerca = "planta" | "via" | "area";
/** Tipo de equipamento da frota (planilha "LOCAÇÃO - GPS"; src/lib/dominio/equipamentos.ts). Não confundir com
 * CategoriaVeiculo (ligado/desligado...). */
export type TipoEquip = "ap" | "av" | "hv" | "uv" | "pg" | "as";
export interface Equip {
  tipo: TipoEquip;
  /** como a planilha escreve: "EGC-2985", "Aspirador 05" */
  nome: string;
  /** posição na planilha dentro do tipo (aspirador: o número) */
  ordem: number;
}

/** Cerca (geofence) como vem do GAUSS. */
export interface CercaGauss {
  code: number;
  name: string;
  layer: number;
  color: string;
  polygon: LatLng[];
}
/** Cerca com o tipo calculado pelo coletor (loc_kv.cercas). */
export interface Cerca extends CercaGauss {
  tipo: TipoCerca;
}

/** Estado de um veículo guardado pelo coletor (loc_kv.estado) a cada leitura. */
export interface EstadoVeiculo {
  id: string;
  placa: string;
  vaga: string;
  grupo: string;
  motorista: string;
  endereco: string;
  demora: string;
  direcao: number;
  status: string;
  status_cod: number;
  /** null = o monitoramento começou com o veículo já nesse status (não se sabe desde quando) */
  status_desde: string | null;
  /** coordenada vazia do GAUSS vira NaN, que o JSON grava como null */
  lat: number | null;
  lng: number | null;
  posicao_em: string | null;
  area: string;
  area_desde: string | null;
  via: string;
  sem_sinal: boolean;
}

export interface Motor2Resumo {
  id: string;
  placa: string;
  status: string;
  status_cod: number;
  status_desde: string | null;
  posicao_em: string | null;
  sem_sinal: boolean;
}

/** Veículo no retrato: o motor secundário vai dentro do caminhão (motor2) e também aparece sozinho, marcado com motor2_de. */
export interface Veiculo extends EstadoVeiculo {
  motor2?: Motor2Resumo;
  motor2_de?: string;
  /** equipamento da frota (o motor 2º recebe o do caminhão); ausente em retrato gravado antes do filtro */
  equip?: Equip;
}

export interface CargaGauss {
  dia: string;
  requisicoes: number;
  logins: number;
  erros: number;
}

/** loc_kv.snapshot: o que a página mostra. */
export interface Retrato {
  lido_em: string | null;
  erro: { em: string; msg: string } | null;
  intervalo_s: number;
  sem_sinal_min: number;
  gauss?: CargaGauss & { desde: string; pausadoAte: string | null };
  veiculos: Veiculo[];
  /** placas de grupos da frota (Alta Pressão, Vácuo, Brook...) que NÃO estão na lista: equipamento novo? */
  fora_da_lista?: string[];
}

export type TipoEvento = "entrada" | "saida" | "status" | "sinal_perdido" | "sinal_retomado";
interface EventoBase {
  t: string;
  id: string;
  placa: string;
  vaga: string;
  /** evento do motor secundário: aparece no caminhão principal */
  motor2?: true;
  principal_id?: string;
  principal?: string;
}
/** loc_eventos.dados */
export type Evento = EventoBase &
  (
    | { tipo: "entrada"; area: string; lat: number | null; lng: number | null }
    | { tipo: "saida"; area: string; desde: string | null; permanencia_min: number | null }
    | { tipo: "status"; de: string; para: string; area: string; duracao_min: number | null }
    | { tipo: "sinal_perdido"; ultima_posicao: string | null; area: string }
    | { tipo: "sinal_retomado"; area: string; sem_sinal_min: number | null }
  );

/** Ponto da rota do GAUSS (loc_historico.pontos): t em horário local "AAAA-MM-DD HH:MM:SS". */
export interface PontoRota {
  t: string;
  lat: number;
  lng: number;
  vel: number;
  rpm: number;
}

interface TrechoBase {
  inicio: string;
  fim: string;
  duracao_min: number;
  motor2_min?: number;
}
export interface TrechoMovimento extends TrechoBase {
  estado: "movimento";
  de: string;
  para: string;
  percurso: string[];
  km: number;
  vel_max: number;
}
export interface TrechoParado extends TrechoBase {
  estado: Exclude<EstadoTrecho, "movimento">;
  local: string;
  lat?: number | null;
  lng?: number | null;
}
export type Trecho = TrechoMovimento | TrechoParado;

export interface ResumoDia {
  primeiro: string;
  ultimo: string;
  pontos: number;
  km: number;
  vel_max: number;
  movimento_min: number;
  parado_ligado_min: number;
  desligado_min: number;
  parado_min: number;
  sem_sinal_min: number;
  motor2_ligado_min: number | null;
  areas: { area: string; min: number }[];
}

/** Ponto leve para o mapa: [lat, lng, hora "HH:MM:SS", km/h, estado, motor 2º ligado (1/0; null = sem motor 2º)]. */
export type PontoMapa = [number, number, string, number, EstadoTrecho, 0 | 1 | null];

export interface Apontamento {
  temRpm: boolean;
  /** ausentes quando o dia não tem pontos */
  rpm_travado?: number | null;
  motor2_rpm_travado?: number | null;
  trechos: Trecho[];
  resumo: ResumoDia | null;
  pontos: PontoMapa[];
  motor2: { intervalos: [string, string][]; id?: string; placa?: string } | null;
}

export type FonteHistorico = "cache" | "incremental" | "gauss";
/** loc_historico.resultado (+ aviso que a página acrescenta). */
export interface Historico extends Apontamento {
  id: string;
  dia: string;
  fonte: FonteHistorico;
  baixado_em: string;
  motor2_erro: string | null;
  aviso?: string;
}

export type StatusPedido = "pendente" | "processando" | "pronto" | "erro";
