// Colunas da tabela `alertas` que a Gestão lê. visto_por (e-mail do gestor) só para quem entrou: o banco não deixa
// a chave pública ler essa coluna (supabase/alertas.sql), e pedir uma coluna proibida derruba a consulta inteira.
const PUBLICAS =
  "id, chave, regra, veiculo_id, placa, vaga, supervisor, dia, ini, fim, ref, local, detalhe, situacao, nota, motivos, contexto, destino, avaliacao, contagem, visto_em, resolvido_em, resolvido_por, ultimo_aviso_em, detectado_em, atualizado_em";

export const colunasAlertas = (logado: boolean) => (logado ? `${PUBLICAS}, visto_por` : PUBLICAS);
