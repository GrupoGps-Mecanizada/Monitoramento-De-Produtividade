import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const alerta = (o: Record<string, unknown>) => ({
  id: 1, chave: "k1", regra: "saida_tarde", veiculo_id: "10", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: hoje(), ini: 29400, fim: null, ref: 27900,
  local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", detalhe: "saiu 08:10 · limite 07:45", situacao: "aberto", nota: 65, destino: "whatsapp", avaliacao: null, contagem: 3, visto_por: null, visto_em: null,
  resolvido_em: null, resolvido_por: null, ultimo_aviso_em: null, detectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  motivos: [{ texto: "Peso da regra", pontos: 35 }, { texto: "Passou de 15 min", pontos: 30 }],
  contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

test("Gestão de alertas: só o que vai ou não para o WhatsApp; frases e assistente de 2 perguntas; sem marcar nem destinatários", async ({ page }) => {
  const alertas = [alerta({}), alerta({ id: 2, chave: "k2", regra: "ocioso", placa: "EAM3257", supervisor: "Donizete", nota: 30, destino: "resumo", situacao: "resolvido", detalhe: "40 min", motivos: [{ texto: "Peso da regra", pontos: 30 }] })];
  const gravacoes = await prepararDados(page, { alertas });
  await page.goto("/gestao-alertas/");
  await expect(page.getByRole("tab", { name: "Alertas", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: "Destinatários" })).toHaveCount(0);
  await expect(page.getByRole("tab", { name: /^Vão para o WhatsApp/ })).toHaveAttribute("aria-selected", "true");
  const lista = page.getByRole("region", { name: "Lista de alertas" });
  await expect(lista).toContainText("EGC2985");
  await expect(lista).not.toContainText("EAM3257");
  await expect(lista.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("tab", { name: /^Não enviados/ }).click();
  await expect(lista).toContainText("EAM3257");
  await expect(lista).toContainText("Não envia");
  await page.getByRole("tab", { name: /^Todos/ }).click();
  // + Filtro: escolhe o supervisor e vira pílula removível
  await page.getByRole("button", { name: "Adicionar filtro" }).click();
  await page.getByRole("menuitem", { name: /Junior Pereira/ }).click();
  await expect(lista).not.toContainText("EAM3257");
  await page.getByRole("button", { name: "Tirar filtro: Junior Pereira" }).click();
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-lista.png" });
  // detalhe ao lado: envia ou não, sem botões de marcar
  await lista.getByRole("button", { name: "EAM3257" }).click();
  const detalhe = page.getByRole("complementary", { name: "EAM3257 · Ociosidade" });
  await expect(detalhe).toContainText("Não vai para o WhatsApp");
  await expect(detalhe.getByRole("button", { name: "Resolver" })).toHaveCount(0);
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-detalhe.png" });
  await detalhe.getByRole("button", { name: "Fechar" }).click();
  // regras em frases: envia ou não envia
  await page.getByRole("tab", { name: "Filtro inteligente" }).click();
  const regras = page.getByRole("region", { name: "Alertas" });
  await expect(regras).toContainText("Saída tarde do Pátio, mais de 15 min de atraso");
  await expect(regras).toContainText("envia no WhatsApp");
  await expect(regras).not.toContainText("supervisor");
  await page.getByRole("button", { name: "+ Novo alerta" }).click();
  const novo = page.getByRole("complementary", { name: "Novo alerta" });
  await novo.getByRole("radio", { name: /Ociosidade/ }).click();
  await expect(novo).toContainText("Ociosidade por mais de 30 min");
  await expect(novo).not.toContainText("Avisar quem");
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-novo.png" });
  await novo.getByRole("button", { name: "Cancelar" }).click();
  expect(gravacoes).toEqual([]);
});
