import { expect, test } from "@playwright/test";
import { cronoFolhas, prepararDados } from "./apoio";

test("Cronoanálise: turno, raio-x e horas por colaborador", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/cronoanalise/");
  // filtros separados: data, letra, turno, vaga, tipo e supervisor; com um turno só, ele abre direto (sem o seletor de turno)
  for (const f of ["Data", "Letra", "Turno", "Vaga", "Tipo", "Supervisor"]) await expect(page.getByLabel(f, { exact: true })).toBeVisible();
  await expect(page.getByLabel("Supervisor", { exact: true })).toContainText("Supervisor Teste");
  await expect(page.getByLabel("Turno da cronoanálise")).toHaveCount(0);
  await expect(page.getByText("Raio-x do turno")).toBeVisible();
  await expect(page.getByText("João Teste").first()).toBeVisible();
  // a seção de conferência saiu a pedido do dono (14/10/2026)
  await expect(page.getByText(/Conferência: folha/)).toHaveCount(0);
  await expect(page.getByText("Apontamentos dos colaboradores")).toBeVisible();
  await expect(page.getByText("Hidrojateamento – Pistola").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Cronoanálise: rodinha do mouse aproxima o raio-x e mostra os nomes nas caixas; afastar volta ao turno inteiro", async ({ page }, info) => {
  test.skip(info.project.name === "celular", "rodinha do mouse só no computador");
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  const caixa = page.locator("span[title^='32 · Hidrojateamento']");
  await expect(caixa).toHaveText("");
  // aproxima no ponto da caixa (08:20–08:40)
  const r = (await caixa.boundingBox())!;
  await page.mouse.move(r.x + r.width / 2, r.y + r.height / 2);
  for (let i = 0; i < 8; i++) await page.mouse.wheel(0, -100);
  await expect(page.getByLabel("Janela visível")).toBeVisible();
  await expect(caixa).toContainText("Hidrojateamento");
  if (process.env.FOTO_ZOOM) await page.screenshot({ path: process.env.FOTO_ZOOM, fullPage: false });
  for (let i = 0; i < 20; i++) await page.mouse.wheel(0, 100);
  await expect(caixa).toHaveText("");
  await expect(page.getByLabel("Janela visível")).toHaveCount(0);
});

test("Cronoanálise: sem botões nem barra de zoom e sem textos de ajuda; arrastar anda no tempo", async ({ page }, info) => {
  await prepararDados(page);
  await page.goto("/cronoanalise/");
  await expect(page.getByText("Raio-x do turno")).toBeVisible();
  for (const b of ["Aproximar", "Afastar", "Turno inteiro", "Voltar no tempo", "Avançar no tempo"]) await expect(page.getByRole("button", { name: b })).toHaveCount(0);
  await expect(page.getByLabel("Zoom do raio-x")).toHaveCount(0);
  await expect(page.getByRole("slider")).toHaveCount(0);
  await expect(page.getByText(/Passe o mouse|Rodinha do mouse|Aproxime para ler/)).toHaveCount(0);
  // arrastar para a esquerda anda para a frente no tempo (só no computador: no celular o dedo rola a página)
  if (info.project.name !== "celular") {
    const faixa = (await page.getByLabel("Faixas do raio-x").boundingBox())!;
    await page.mouse.move(faixa.x + faixa.width * 0.6, faixa.y + 40);
    for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -100);
    const janela = page.getByLabel("Janela visível");
    await expect(janela).toBeVisible();
    const antes = await janela.textContent();
    await page.mouse.down();
    await page.mouse.move(faixa.x + faixa.width * 0.3, faixa.y + 40, { steps: 8 });
    await page.mouse.up();
    await expect(janela).not.toHaveText(antes!);
  }
});

test("Cronoanálise: filtros em cascata; letra e supervisor vêm da escala quando a folha não traz", async ({ page }) => {
  // 2º turno: ontem à noite, Vácuo AV-02, sem letra e sem supervisor na folha
  const d = new Date(Date.now() - 86400000);
  const ontem = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const noite = { data: ontem, turno: null, horario: "19–07", area: "Área Teste", nome: "Ana Noite", papel: "Motorista", placa: "EGC2993", vaga: "AV-02", equip: "Vácuo",
    hi: "20:00", hf: "21:00", cod: 32, descricao: "Hidrojateamento – Pistola", cls: "Produzindo", obs: null, supervisor: null, kit: null };
  await prepararDados(page, { crono: [...cronoFolhas(), noite] });
  await page.goto("/cronoanalise/");
  // dois turnos com os filtros vazios: aparece o seletor do turno
  await expect(page.getByLabel("Turno da cronoanálise")).toBeVisible();
  await page.getByLabel("Tipo", { exact: true }).selectOption("AV");
  await expect(page.getByText("Ana Noite").first()).toBeVisible();
  await expect(page.getByLabel("Turno da cronoanálise")).toHaveCount(0);
  // a letra veio da escala e o supervisor, da letra (nunca vazio)
  await expect(page.getByLabel("Letra", { exact: true }).locator("option")).toHaveText(["Todas as letras", /^Letra [ABCD]$/]);
  await expect(page.getByLabel("Supervisor", { exact: true })).toContainText(/Ozias|Matusalem|Israel|Fabio/);
  // a vaga só oferece o que existe com o tipo escolhido
  await expect(page.getByLabel("Vaga", { exact: true }).locator("option")).toHaveText(["Todas as vagas", "AV-02"]);
});
