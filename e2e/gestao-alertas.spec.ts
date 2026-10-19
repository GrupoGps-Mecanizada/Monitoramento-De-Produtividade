import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const alerta = (o: Record<string, unknown>) => ({
  id: 1, chave: "k1", regra: "saida_tarde", veiculo_id: "10", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: hoje(), ini: 29400, fim: null, ref: 27900,
  local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", detalhe: "saiu 08:10 · limite 07:45", situacao: "aberto", nota: 65, destino: "whatsapp", avaliacao: null, contagem: 3, visto_por: null, visto_em: null,
  resolvido_em: null, resolvido_por: null, ultimo_aviso_em: null, detectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  motivos: [{ texto: "Peso da regra", pontos: 35 }, { texto: "Passou de 15 min", pontos: 30 }],
  contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

test("Gestão de alertas: visões com contagem, números em linha, + Filtro, tabela e detalhe ao lado; sem clicar em ação nada grava", async ({ page }) => {
  const alertas = [alerta({}), alerta({ id: 2, chave: "k2", regra: "ocioso", placa: "EAM3257", supervisor: "Donizete", nota: 30, destino: "resumo", situacao: "resolvido", detalhe: "40 min", motivos: [{ texto: "Peso da regra", pontos: 30 }] })];
  const gravacoes = await prepararDados(page, { alertas });
  await page.goto("/gestao-alertas/");
  await expect(page.getByRole("tab", { name: "Alertas", exact: true })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Na fila/ })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tab", { name: /^Na fila/ })).toContainText("1");
  const lista = page.getByRole("region", { name: "Lista de alertas" });
  await expect(lista).toContainText("EGC2985");
  await expect(lista).not.toContainText("EAM3257");
  // a visão Resolvidos troca a lista
  await page.getByRole("tab", { name: /^Resolvidos/ }).click();
  await expect(lista).toContainText("EAM3257");
  await expect(lista).not.toContainText("EGC2985");
  await page.getByRole("tab", { name: /^Todos/ }).click();
  // + Filtro: escolhe o supervisor e vira pílula removível
  await page.getByRole("button", { name: "Adicionar filtro" }).click();
  await page.getByRole("menuitem", { name: /Junior Pereira/ }).click();
  await expect(lista).not.toContainText("EAM3257");
  await page.getByRole("button", { name: "Tirar filtro: Junior Pereira" }).click();
  await expect(lista).toContainText("EAM3257");
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-lista.png" });
  // detalhe ao lado: o porquê da nota e as ações (sem login: só o dono gere)
  await lista.getByRole("button", { name: "EGC2985" }).click();
  const detalhe = page.getByRole("complementary", { name: "EGC2985 · Saída tarde do Pátio" });
  await expect(detalhe).toContainText("Passou de 15 min");
  await expect(detalhe.getByRole("button", { name: "Resolver" })).toBeEnabled();
  await expect(page.getByRole("button", { name: "Entrar" })).toHaveCount(0);
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-detalhe.png" });
  await detalhe.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("tab", { name: "Filtro inteligente" }).click();
  await expect(page.getByRole("region", { name: "Simulador" })).toContainText("2 alertas");
  // alertas em frases e o assistente de 3 perguntas
  const alertasCfg = page.getByRole("region", { name: "Alertas" });
  await expect(alertasCfg).toContainText("Saída tarde do Pátio, mais de 15 min de atraso");
  await expect(alertasCfg).toContainText("WhatsApp para o supervisor da vaga");
  await page.getByRole("button", { name: "+ Novo alerta" }).click();
  const novo = page.getByRole("complementary", { name: "Novo alerta" });
  await novo.getByRole("radio", { name: /Ociosidade/ }).click();
  await novo.getByRole("radio", { name: /resumo diário/ }).check();
  await expect(novo).toContainText("Ociosidade por mais de 30 min");
  await expect(novo.getByRole("button", { name: "Criar alerta" })).toBeEnabled();
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-novo.png" });
  await novo.getByRole("button", { name: "Cancelar" }).click();
  // ajuste fino (pesos): simular antes de salvar e desfazer
  await page.getByRole("button", { name: /Ajuste fino/ }).click();
  await page.getByRole("checkbox", { name: "Ligar Saída tarde do Pátio" }).uncheck();
  await expect(page.getByRole("region", { name: "Simulador" })).toContainText("antes 1");
  await expect(page.getByRole("region", { name: "Salvar" })).toContainText("1 mudança não salva");
  await page.getByRole("button", { name: "Desfazer" }).click();
  await expect(page.getByRole("region", { name: "Salvar" })).toContainText("Nenhuma mudança");
  await page.getByRole("button", { name: /Voltar ao modo simples/ }).click();
  if (process.env.FOTO) await page.screenshot({ path: process.env.FOTO + "-filtro.png" });
  await page.getByRole("tab", { name: "Destinatários" }).click();
  await expect(page.getByText("Ninguém cadastrado ainda")).toBeVisible();
  expect(gravacoes).toEqual([]);
});
