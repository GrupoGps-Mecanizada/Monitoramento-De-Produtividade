import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Análise: painel com placar, mapa e gráficos que se filtram", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const placar = page.getByRole("region", { name: "Placar" });
  const lugares = page.getByRole("region", { name: "Lugares" });
  const servicos = page.getByRole("region", { name: "Por serviço" });
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  // sem funil, lista, "Ir para" nem troca de fundo
  await expect(page.getByRole("button", { name: "Filtros da análise" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Áreas e resumo" })).toHaveCount(0);
  // placar: produtivo só do caminhão de Alta Pressão (motor 2º); o Pátio da base e a placa de fora da frota não entram
  await expect(placar).toContainText("1h30");
  await expect(placar).toContainText("38%");
  await expect(placar).toContainText("5h00");
  // lugares: PATIO (2 paradas da frota) em primeiro; "Longe da região" no fim
  await expect(lugares.getByRole("button").first()).toHaveAccessibleName(/^PATIO, 2h00/);
  await expect(page.getByText("PÁTIO DO TRANSPORTE RODOVIÁRIO", { exact: true })).toHaveCount(0);
  await expect(lugares.getByRole("button", { name: /Longe da região/ })).toBeVisible();
  // serviço: vira etiqueta e filtra placar e lugares; o gráfico de serviços continua com todos e marca o escolhido
  await servicos.getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await expect(lugares).toContainText("OFICINA");
  await expect(placar).toContainText("1h00");
  await expect(servicos.getByRole("button", { name: /^Aguardando Área/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(filtrando).toHaveCount(0);
  // hora do dia: só a parada que começou às 14h (PATIO)
  await page.getByRole("region", { name: "Hora do dia" }).getByRole("button", { name: /^14h,/ }).click();
  await expect(placar).toContainText("1h00");
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await filtrando.getByRole("button", { name: "Tirar filtro: 14h" }).click();
  // lugar pelo ranking; "Longe da região" troca o lugar escolhido
  await lugares.getByRole("button", { name: /^PATIO/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: PATIO" })).toBeVisible();
  await expect(placar).toContainText("2h00");
  await lugares.getByRole("button", { name: /Longe da região/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  await expect(placar).toContainText("1h00");
  // filtro do topo esvazia o recorte: a etiqueta continua e os gráficos avisam, sem quebrar
  await page.getByLabel("Tipo").selectOption("as");
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  await expect(servicos).toContainText("Nada neste filtro.");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  // aspirador não tem regra de produtividade: "—", nunca 0%
  await expect(placar.getByText("—").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});


test("Análise: sem histórico enviado, avisa em vez de quebrar", async ({ page }) => {
  await prepararDados(page, { analise: [] });
  await page.goto("/analise/");
  await expect(page.getByText("O histórico ainda não foi enviado")).toBeVisible();
});

test("Análise: tabela ainda não criada, avisa em português (também no celular)", async ({ page }) => {
  await prepararDados(page, { analiseSemTabela: true });
  await page.goto("/analise/");
  await expect(page.getByText("A tabela da análise ainda não foi criada")).toBeVisible();
  await expect(page.getByText("schema cache")).toHaveCount(0);
});
