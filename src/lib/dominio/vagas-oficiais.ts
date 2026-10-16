// Vagas que o sistema usa (regra do dono no segundo cérebro: "Regimes, turnos e supervisores", 14/10/2026). A lista do
// GAUSS tem 58 vagas da GPS (16/10/2026: AP 11 a 14, AP 06 16 HS, AV 09 a 11, Pipa, Mini Carregadeira, Moto Bomba...);
// buscar todas estourava o tempo do coletor e enchia o Dia da frota de vagas que a Mecanizada não opera.
//   Alta Pressão: 01 (24 h), 02 a 06, 07 (16 h), 08 (24 h), 09 e 10
//   Auto Vácuo: 01 (24 h), 02 a 06, 07 (16 h), 08 (24 h)
//   Hiper Vácuo: 01 a 04 · todos os Aspiradores · Brooks

const normal = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const OFICIAIS = [
  /^ALTA PRESSAO - GPS - (01 - 24 HS|0[2-6]|07 - 16 HS|08 - 24 HS|09|10)$/,
  /^AUTO VACUO - GPS - (01 - 24 HS|0[2-6]|07 - 16 HS|08 - 24 HS)$/,
  /^HIPER VACUO - GPS - 0[1-4]$/,
  /^ASPIRADOR INDUSTRIAL - GPS - \d{2}$/,
  /^CAMINHAO BROOK - GPS - \d{2}$/,
];

/** A vaga (nome do GAUSS) é uma das que a Mecanizada opera. */
export const vagaOficial = (nome: string) => OFICIAIS.some((r) => r.test(normal(nome)));
