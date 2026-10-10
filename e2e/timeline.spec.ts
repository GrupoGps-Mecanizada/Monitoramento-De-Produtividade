import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

test("Timeline: mapa na tela toda, cartão do horário, linha do dia e ◀ ▶ ▶", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const play = page.getByRole("button", { name: "Reproduzir" });
  await expect(play).toBeVisible();
  await expect(page.getByRole("button", { name: "Deslocamento anterior" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Próximo deslocamento" })).toBeVisible();
  // sem o painel de trilhas: só a linha fina do dia
  await expect(page.getByRole("region", { name: "Timeline do veículo" })).toHaveCount(0);
  const cartao = page.getByRole("button", { name: "Agora no mapa" });
  await expect(cartao).toContainText("EGC-2985");
  // clicar na linha leva o caminhão ao horário (08:10:30, parado ligado no PATIO)
  const linha = page.getByRole("slider", { name: "Linha do dia" });
  const b = (await linha.boundingBox())!;
  await page.mouse.click(b.x + (b.width * (8 * 3600 + 10 * 60 + 30)) / 86400, b.y + b.height / 2);
  await expect(cartao).toContainText("08:10");
  // motor pela timeline do GAUSS (sem RPM)
  await expect(cartao).toContainText("Motor 2º ligado");
  await expect(cartao).toContainText("PATIO");
  await play.click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Timeline: o funil guarda veículo, dia, reprodução, resumo e o apontamento", async ({ page }) => {
  await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  const funil = page.getByRole("dialog", { name: "Timeline" });
  await expect(funil.getByRole("searchbox", { name: "Veículo" })).toBeVisible();
  await expect(funil.getByLabel("Velocidade")).toBeVisible();
  await expect(funil).toContainText("JOSÉ DA SILVA");
  await expect(funil.getByRole("tab", { name: "Satélite" })).toHaveAttribute("aria-selected", "true");
  await funil.getByRole("tab", { name: "Mapa" }).click();
  await expect(funil.getByRole("tab", { name: "Mapa" })).toHaveAttribute("aria-selected", "true");
  await funil.getByRole("button", { name: /Apontamento/ }).click();
  const gaveta = page.getByRole("dialog", { name: /Apontamento/ });
  await expect(gaveta.getByRole("list", { name: "Capítulos do dia" })).toBeVisible();
  await expect(gaveta.getByRole("button", { name: /Exportar CSV/ })).toBeVisible();
});

test("Timeline: status do GAUSS e apontamento do tablet no cartão e no funil", async ({ page }) => {
  await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const linha = page.getByRole("slider", { name: "Linha do dia" });
  const b = (await linha.boundingBox())!;
  // 08:30: GAUSS diz parado ligado e o tablet tem a refeição apontada
  await page.mouse.click(b.x + (b.width * (8 * 3600 + 30 * 60)) / 86400, b.y + b.height / 2);
  const cartao = page.getByRole("button", { name: "Agora no mapa" });
  await expect(cartao).toContainText("Parado ligado");
  await expect(cartao).toContainText("Refeição Motorista");
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  const funil = page.getByRole("dialog", { name: "Timeline" });
  await expect(funil.getByRole("list", { name: "Status do GAUSS no dia" })).toContainText("Motor 2º ligado");
  await expect(funil.getByRole("list", { name: "Apontamentos do tablet" })).toContainText("08:25–08:35");
});

test("Timeline: o motor vem só do GAUSS (sem RPM)", async ({ page }) => {
  await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const linha = page.getByRole("slider", { name: "Linha do dia" });
  const b = (await linha.boundingBox())!;
  // 08:36: o RPM diz parado ligado, o GAUSS diz desligado → vale o GAUSS
  await page.mouse.click(b.x + (b.width * (8 * 3600 + 36 * 60 + 30)) / 86400, b.y + b.height / 2);
  const cartao = page.getByRole("button", { name: "Agora no mapa" });
  await expect(cartao).toContainText("08:36");
  await expect(cartao).toContainText("Motor desligado");
  await expect(cartao).not.toContainText("Parado ligado");
  // no funil: produtivo pela regra da Alta Pressão (motor 2º ligado: 08:10–08:20)
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  await expect(page.getByRole("dialog", { name: "Timeline" })).toContainText("10 min produtivo (motor 2º ligado)");
});

test("Timeline: rodinha do mouse aproxima e afasta a faixa", async ({ page, isMobile }) => {
  test.skip(isMobile, "celular não tem rodinha");
  await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  const linha = page.getByRole("slider", { name: "Linha do dia" });
  const b = (await linha.boundingBox())!;
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.wheel(0, -400);
  await expect(page.getByText(/^Zoom /)).toBeVisible();
  await page.getByRole("button", { name: "Dia inteiro" }).click();
  await expect(page.getByText(/^Zoom /)).toHaveCount(0);
  // clássica: a rodinha sobre as trilhas muda o "De … até"
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  await page.getByRole("dialog", { name: "Timeline" }).getByRole("tab", { name: /clássica/ }).click();
  await page.keyboard.press("Escape");
  const trilhas = page.getByTestId("trilha-motor");
  await expect(trilhas).toBeVisible();
  const de = page.getByLabel("Mostrar a partir de");
  await expect(de).toHaveValue("8");
  const t = (await trilhas.boundingBox())!;
  await page.mouse.move(t.x + t.width / 2, t.y + t.height / 2);
  await page.mouse.wheel(0, 400);
  await page.mouse.wheel(0, 400);
  await expect(de).not.toHaveValue("8");
});

test("Timeline: troca para a clássica (mesmo filtro, painel de trilhas embaixo) e volta", async ({ page, isMobile }) => {
  const gravacoes = await prepararDados(page);
  await page.goto(`/timeline/?v=10&dia=${hoje()}`);
  await expect(page.getByRole("button", { name: "Reproduzir" })).toBeVisible();
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  const funil = page.getByRole("dialog", { name: "Timeline" });
  await funil.getByRole("tab", { name: /clássica/ }).click();
  await funil.getByRole("button", { name: "Fechar" }).first().click();
  // o filtro continua o mesmo; embaixo, as trilhas (computador) ou a faixa do dia (celular)
  await expect(page.getByRole("button", { name: "Agora no mapa" })).toContainText("EGC-2985");
  if (isMobile) await expect(page.getByRole("slider", { name: "Faixa do dia" })).toBeVisible();
  else {
    await expect(page.getByRole("region", { name: "Timeline do veículo" })).toBeVisible();
    await expect(page.getByTestId("trilha-motor")).toContainText("Motor ligado");
    await expect(page.getByTestId("trilha-tablet")).toBeVisible();
  }
  await page.getByRole("button", { name: "Veículo, dia e opções" }).click();
  await page.getByRole("dialog", { name: "Timeline" }).getByRole("tab", { name: /nova/ }).click();
  await expect(page.getByRole("slider", { name: "Linha do dia" })).toBeAttached();
  expect(gravacoes).toEqual([]);
});

test("Timeline: sem veículo no endereço, o funil já abre", async ({ page }) => {
  await prepararDados(page);
  await page.goto("/timeline/");
  await expect(page.getByRole("dialog", { name: "Timeline" }).getByRole("button", { name: "Ver timeline" })).toBeVisible();
});

test("Timeline: link com o motor secundário abre o caminhão", async ({ page }) => {
  await prepararDados(page);
  await page.goto(`/timeline/?v=EGC29852&dia=${hoje()}`);
  await expect(page.getByRole("button", { name: "Agora no mapa" })).toContainText("EGC-2985");
});
