import { expect, test } from "@playwright/test";
import { medicao, prepararDados } from "./apoio";

test("Análise › Disponibilidade: ranking pela pior DF e detalhe da vaga com o oficial", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(page.getByText("Oficial", { exact: true })).toBeVisible();
  await expect(page.getByRole("combobox", { name: "Ciclo da medição" })).toContainText("GPS 2026-10");
  if (test.info().project.name !== "celular") {
    const abas = (await page.getByRole("tablist", { name: "Análise" }).boundingBox())!;
    const ciclo = (await page.getByRole("combobox", { name: "Ciclo da medição" }).boundingBox())!;
    expect(Math.abs(ciclo.y + ciclo.height / 2 - (abas.y + abas.height / 2))).toBeLessThan(8);
  }
  // placar: (144 − 7,92) ÷ 144 = 94,50%; 7,92 h = 7h55; pior vaga = AP 01
  const placar = page.getByRole("region", { name: "Placar da disponibilidade" });
  await expect(placar).toContainText("94,50%");
  await expect(placar).toContainText("7h55");
  await expect(placar).toContainText("ALTA PRESSÃO - GPS - 01 - 24 HS");
  // vagas da pior para a melhor, com o motivo que mais pesou
  const vagas = page.getByRole("region", { name: "Vagas" });
  await expect(vagas.getByRole("button").first()).toHaveAccessibleName(/^ALTA PRESSÃO - GPS - 01 - 24 HS, DF 90,00%, 7h12 indisponível, mais: Ausência de operador/);
  await vagas.getByRole("button").first().click();
  const detalhe = page.getByRole("region", { name: "Detalhe: ALTA PRESSÃO - GPS - 01 - 24 HS" });
  await expect(detalhe.getByRole("region", { name: "DF por dia" }).getByRole("listitem")).toHaveCount(3);
  await expect(detalhe.getByRole("region", { name: "Por motivo" })).toContainText("Ausência de operador");
  await expect(detalhe.getByRole("region", { name: "Eventos" })).toContainText("EGC2985");
  await expect(detalhe.getByRole("region", { name: "Eventos" })).toContainText("Área de manutenção - OFICINA GPS/SERVITEC");
  // motor 2º: 08:10–08:20 de hoje na timeline de motor
  await expect(detalhe.getByRole("region", { name: "Motor secundário ligado" })).toContainText("0h10");
  // eventos somam 7h00; o boletim diz 7h12
  await expect(detalhe.getByRole("region", { name: "Conferência" })).toContainText("diferença 0h12");
  expect(gravacoes).toEqual([]);
});

test("Análise › Disponibilidade: avisa quando o SQL não foi rodado", async ({ page }) => {
  await prepararDados(page, { medicaoSemTabela: true });
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  // o Next também põe um role="alert" vazio na página (anúncio de rota): filtra pelo texto
  await expect(page.getByRole("alert").filter({ hasText: "rode supabase/medicao.sql" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Análise" })).toBeVisible();
});

test("Análise › Disponibilidade: nenhum boletim baixado ainda", async ({ page }) => {
  await prepararDados(page, { medicao: { ...medicao(), boletins: [] } });
  await page.goto("/analise/");
  await page.getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(page.getByText("Nenhum boletim baixado ainda")).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Análise" })).toBeVisible();
});
