import { expect, test } from "@playwright/test";
import { hoje, matrizBanco, prepararDados } from "./apoio";

test("Equipamentos: matriz sem login, com os botões de editar", async ({ page, isMobile }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/equipamentos/");
  await expect(page.getByText("Matriz de equipamentos")).toBeVisible();
  await expect(page.getByRole("button", { name: /Desmobilizado\s*1/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /Novo equipamento/ })).toBeVisible();
  await expect(page.getByText(/Entrar para editar|fora da matriz/)).toHaveCount(0);
  if (isMobile) {
    // celular: cartões; o toque abre o equipamento para editar
    await page.getByRole("button", { name: /EGC-2985/ }).click();
    const painel = page.getByRole("dialog");
    await expect(painel.getByLabel("Supervisor")).toHaveValue("1");
    await expect(painel.getByRole("button", { name: "Salvar mudanças" })).toBeVisible();
  } else {
    // computador: a planilha (mesmo formato do SST)
    await expect(page.getByText("43 linhas")).toBeVisible();
    await expect(page.getByRole("button", { name: "Excel" })).toBeVisible({ timeout: 45_000 });
  }
  expect(gravacoes).toEqual([]);
});

test("Equipamentos: cadastra equipamento novo (placa repetida não entra)", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/equipamentos/");
  await page.getByRole("button", { name: /Novo equipamento/ }).click();
  const painel = page.getByRole("dialog");
  await expect(painel.getByLabel(/Código/)).toHaveCount(0);
  await painel.getByLabel("Placa").fill("egc2985");
  await painel.getByRole("button", { name: "Cadastrar" }).click();
  await expect(painel).toContainText("A placa EGC-2985 já está na matriz");
  await painel.getByLabel("Placa").fill("abc1d23");
  await painel.getByLabel("Supervisor").selectOption({ label: "ISRAEL" });
  await painel.getByLabel("Regime").selectOption({ label: "4X4 - A" });
  await painel.getByRole("tab", { name: "Em manutenção" }).click();
  await painel.getByRole("button", { name: "Cadastrar" }).click();
  await expect(painel).toHaveCount(0);
  expect(gravacoes).toHaveLength(1);
  expect(gravacoes[0]).toContain("POST /rest/v1/frota_equipamento");
  expect(JSON.parse(gravacoes[0].slice(gravacoes[0].indexOf("{")))).toEqual({
    tipo: "ap", codigo: null, status: "EM_MANUTENCAO", supervisor_id: 2, regime_id: 2, observacao: null, placa: "ABC-1D23", numero: null, ordem: 15,
  });
});

test("Matriz manda no Monitoramento: desmobilizado some, em manutenção aparece marcado", async ({ page }) => {
  const matriz = matrizBanco().map((c) =>
    c.placa === "EGC-2984" ? { ...c, status: "DESMOBILIZADO" as const } : c.placa === "DSY-6472" ? { ...c, status: "EM_MANUTENCAO" as const } : c,
  );
  await prepararDados(page, { matriz });
  await page.goto("/frota/");
  await expect(page.getByRole("link", { name: /EGC-2985/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /EGC-2984/ })).toHaveCount(0);
  // na Timeline o veículo é escolhido no funil
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  await page.getByRole("searchbox", { name: "Veículo" }).fill("DSY");
  // a busca de veículo carrega a matriz e o retrato: sob a bateria inteira passa de 5 s
  await expect(page.getByRole("option", { name: /DSY-6472.*manutenção/ })).toBeVisible({ timeout: 15_000 });
});
