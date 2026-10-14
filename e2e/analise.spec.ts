import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

test("Análise: painel com mapa e gráficos que se filtram, período no topo ao lado das abas", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await page.getByRole("tablist", { name: "Assunto" }).getByRole("tab", { name: "Apontamentos" }).click();
  const lugares = page.getByRole("region", { name: "Lugares" });
  const servicos = page.getByRole("region", { name: "Por serviço" });
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  // sem funil, lista, "Ir para" nem troca de fundo
  await expect(page.getByRole("button", { name: "Filtros da análise" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Áreas e resumo" })).toHaveCount(0);
  // sem placar (Produtivo, % Produtivo, Parado, Serviços)
  await expect(page.getByRole("region", { name: "Placar" })).toHaveCount(0);
  // período no topo, ao lado de Paradas | Disponibilidade; some na Disponibilidade (segue o boletim oficial)
  const periodo = page.getByRole("tablist", { name: "Período" });
  await expect(periodo.getByRole("tab", { name: "30 dias" })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("tablist", { name: "Análise" }).getByRole("tab", { name: "Disponibilidade" }).click();
  await expect(periodo).toHaveCount(0);
  await page.getByRole("tablist", { name: "Análise" }).getByRole("tab", { name: "Paradas" }).click();
  await expect(periodo).toBeVisible();
  // uma linha só: abas, período e filtros (no computador; no celular a linha quebra)
  if (test.info().project.name !== "celular") {
    const abas = (await page.getByRole("tablist", { name: "Análise" }).boundingBox())!;
    for (const nome of ["Tipo", "Supervisor", "Regime"]) {
      const b = (await page.getByLabel(nome, { exact: true }).boundingBox())!;
      expect(Math.abs(b.y + b.height / 2 - (abas.y + abas.height / 2))).toBeLessThan(8);
    }
  }
  // lugares: PATIO (2 paradas da frota) em primeiro; "Longe da região" no fim
  await expect(lugares.getByRole("button").first()).toHaveAccessibleName(/^PATIO, 2h00/);
  await expect(page.getByText("PÁTIO DO TRANSPORTE RODOVIÁRIO", { exact: true })).toHaveCount(0);
  await expect(lugares.getByRole("button", { name: /Longe da região/ })).toBeVisible();
  // serviço: vira etiqueta e filtra os lugares; o gráfico de serviços continua com todos e marca o escolhido
  await servicos.getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await expect(lugares).toContainText("OFICINA");
  await expect(servicos.getByRole("button", { name: /^Aguardando Área/ })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(filtrando).toHaveCount(0);
  // hora do dia: só a parada que começou às 14h (PATIO)
  await page.getByRole("region", { name: "Quando para" }).getByRole("button", { name: /14h, 1h00/ }).click();
  await expect(lugares.getByRole("button")).toHaveCount(1);
  await filtrando.getByRole("button", { name: "Tirar filtro: 14h" }).click();
  // lugar pelo ranking; "Longe da região" troca o lugar escolhido
  await lugares.getByRole("button", { name: /^PATIO/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: PATIO" })).toBeVisible();
  await lugares.getByRole("button", { name: /Longe da região/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  // filtro do topo esvazia o recorte: a etiqueta continua e os gráficos avisam, sem quebrar
  await page.getByLabel("Tipo").selectOption("as");
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Longe da região" })).toBeVisible();
  await expect(servicos).toContainText("Nada neste filtro.");
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  expect(gravacoes).toEqual([]);
});


test("Análise: satélite normal com as cercas nas cores delas, área clicável; Mata CDP fora", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  // sem mapa de calor e sem preto em volta: as cercas com a cor do GAUSS
  await expect(page.locator(".mapa-analise .area-cerca")).toHaveCount(2);
  await expect(page.locator(".mapa-analise .area-cerca").first()).toHaveAttribute("stroke", /^#/);
  await expect(page.locator(".mapa-analise .leaflet-heatmap-layer")).toHaveCount(0);
  await expect(page.locator(".mapa-analise .mascara-analise")).toHaveCount(0);
  await expect(page.locator('.mapa-analise img.leaflet-tile[src*="World_Imagery"]').first()).toBeAttached();
  const lugares = page.getByRole("region", { name: "Lugares" });
  await expect(lugares.getByRole("button").first()).toBeVisible();
  await expect(lugares).not.toContainText("MATA CDP");
  // clicar na cerca filtra
  await page.getByRole("button", { name: "OFICINA", exact: true }).click();
  await expect(page.getByRole("group", { name: "Filtrando" }).getByRole("button", { name: "Tirar filtro: OFICINA" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Análise: Status do motor (padrão) e Motor secundário com números, frases e gráficos", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const assunto = page.getByRole("tablist", { name: "Assunto" });
  await expect(assunto.getByRole("tab", { name: "Status do motor" })).toHaveAttribute("aria-selected", "true");
  // 5 paradas da frota (OFICINA, PATIO x2, ATERRO, longe): 5h00 paradas; todo o tempo com dado de motor está ligado
  const numeros = page.getByRole("region", { name: "Números" });
  await expect(numeros).toContainText("5h00");
  await expect(numeros).toContainText("100%");
  await expect(numeros).toContainText("Parado ligado");
  await expect(page.getByRole("list", { name: "Frases automáticas" })).toContainText("Tempo parado: 5h00 em 5 paradas.");
  // escolher um status: placas pesam só ele; clicar de novo volta
  const porStatus = page.getByRole("region", { name: "Por status" });
  // cada status na cor da Timeline: a barra do status e a parte dele na barra da placa
  await expect(porStatus.getByRole("button", { name: /^Parado ligado/ }).locator("span > span").last()).toHaveAttribute("style", /--warn-dot/);
  await expect(page.getByRole("region", { name: "Placas" }).locator('[title^="Parado ligado:"]').first()).toHaveAttribute("style", /--warn-dot/);
  await porStatus.getByRole("button", { name: /^Motor 2º ligado/ }).click();
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button").first()).toHaveAccessibleName(/^EGC2985, Motor 2º ligado 1h30 de/);
  await porStatus.getByRole("button", { name: /^Motor 2º ligado/ }).click();
  await expect(page.getByRole("region", { name: "Placas" }).getByRole("button")).toHaveCount(2);
  // status escolhido que some com um filtro não fica preso: volta a pesar o tempo parado
  await porStatus.getByRole("button", { name: /^Motor 2º ligado/ }).click();
  await page.getByLabel("Tipo").selectOption("as");
  await expect(page.getByRole("region", { name: "Placas" })).toContainText("ASP12");
  await page.getByLabel("Tipo").selectOption("");
  // serviço escolhido em Apontamentos sai ao trocar de assunto
  await assunto.getByRole("tab", { name: "Apontamentos" }).click();
  // o apontamento leva a cor da família (Aguardando = laranja)
  await expect(page.getByRole("region", { name: "Por serviço" }).getByRole("button", { name: /^Aguardando Área/ }).locator("span > span").last()).toHaveAttribute("style", /--serie-2/);
  await page.getByRole("region", { name: "Por serviço" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await assunto.getByRole("tab", { name: "Motor secundário" }).click();
  await expect(page.getByRole("group", { name: "Filtrando" })).toHaveCount(0);
  // motor 2º: só o Alta Pressão (bomba 40 + 30 + 20 min = 1h30)
  await expect(page.getByRole("region", { name: "Números" })).toContainText("1h30");
  await expect(page.getByRole("region", { name: "Números" })).toContainText("EGC2985");
  // a bomba no ciano do motor 2º
  await expect(page.getByRole("region", { name: "Lugares" }).getByRole("button").first().locator("span > span").last()).toHaveAttribute("style", /--motor2/);
  await expect(page.getByRole("region", { name: "Lugares" }).getByRole("button").first()).toHaveAccessibleName(/^OFICINA/);
  // filtro de tipo que esvazia: "—" e aviso, sem quebrar
  await page.getByLabel("Tipo").selectOption("as");
  await expect(page.getByRole("region", { name: "Números" })).toContainText("—");
  await expect(page.getByText("Nada neste filtro.").first()).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Análise: ocultar e mostrar os gráficos; o mapa ocupa a tela e a escolha fica guardada", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const mapa = page.locator(".mapa-analise");
  await expect(page.getByRole("tablist", { name: "Assunto" })).toBeVisible();
  const antes = (await mapa.boundingBox())!.width;
  await page.getByRole("button", { name: "Ocultar gráficos" }).click();
  await expect(page.getByRole("tablist", { name: "Assunto" })).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Números" })).toHaveCount(0);
  // no computador o mapa ganha a largura da coluna (no celular ele já ocupa a largura toda)
  if (test.info().project.name !== "celular") await expect.poll(async () => (await mapa.boundingBox())!.width).toBeGreaterThan(antes + 100);
  // clicar na cerca continua filtrando com os gráficos ocultos
  await page.getByRole("button", { name: "OFICINA", exact: true }).click();
  await expect(page.getByRole("group", { name: "Filtrando" }).getByRole("button", { name: "Tirar filtro: OFICINA" })).toBeVisible();
  // a escolha fica guardada neste navegador
  await page.reload();
  await expect(page.getByRole("button", { name: "Mostrar gráficos" })).toBeVisible();
  await expect(page.getByRole("tablist", { name: "Assunto" })).toHaveCount(0);
  await page.getByRole("button", { name: "Mostrar gráficos" }).click();
  await expect(page.getByRole("tablist", { name: "Assunto" })).toBeVisible();
  expect(gravacoes).toEqual([]);
});

test("Análise: cor do mapa por tempo parado com as horas nas cercas; grade 'Quando para' filtra hora e dia", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  const cor = page.getByRole("tablist", { name: "Cor do mapa" });
  await expect(cor.getByRole("tab", { name: "Da cerca" })).toHaveAttribute("aria-selected", "true");
  await expect(page.locator('[aria-label="Legenda do tempo parado"]')).toHaveCount(0);
  await cor.getByRole("tab", { name: "Tempo parado" }).click();
  // a legenda fica só no computador (no celular ela tamparia o mapa)
  if (test.info().project.name !== "celular") await expect(page.locator('[aria-label="Legenda do tempo parado"]')).toBeVisible();
  else await expect(page.locator('[aria-label="Legenda do tempo parado"]')).toBeAttached();
  await expect(page.locator(".mapa-analise .rotulo-horas").first()).toBeAttached();
  // grade: o quadradinho das 14h (PATIO) vira duas etiquetas: hora e dia; clicar de novo desfaz
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  const quadro = page.getByRole("region", { name: "Quando para" }).getByRole("button", { name: /14h, 1h00/ });
  await quadro.click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: 14h" })).toBeVisible();
  await expect(filtrando.getByRole("button", { name: /^Tirar filtro: (dom|seg|ter|qua|qui|sex|sáb)$/ })).toBeVisible();
  await quadro.click();
  await expect(filtrando).toHaveCount(0);
  // a escolha da cor fica guardada
  await page.reload();
  await expect(page.getByRole("tablist", { name: "Cor do mapa" }).getByRole("tab", { name: "Tempo parado" })).toHaveAttribute("aria-selected", "true");
  // filtro que esvazia: a grade avisa
  await page.getByLabel("Tipo").selectOption("hv");
  await expect(page.getByRole("region", { name: "Quando para" })).toContainText("Nada neste filtro.");
  expect(gravacoes).toEqual([]);
});

test("Análise: subabas por família com frases, apontamentos, quem mais para e tendência", async ({ page }) => {
  const gravacoes = await prepararDados(page);
  await page.goto("/analise/");
  await page.getByRole("tablist", { name: "Assunto" }).getByRole("tab", { name: "Apontamentos" }).click();
  const familias = page.getByRole("tablist", { name: "Família" });
  const filtrando = page.getByRole("group", { name: "Filtrando" });
  // Visão geral é a padrão: o painel de sempre
  await expect(familias.getByRole("tab", { name: "Visão geral" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("region", { name: "Lugares" })).toBeVisible();
  // serviço escolhido na Visão geral sai ao trocar de família
  await page.getByRole("region", { name: "Por serviço" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await familias.getByRole("tab", { name: "Aguardando" }).click();
  await expect(filtrando).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Lugares" })).toHaveCount(0);
  // frases (30 dias: sem comparação); só o caminhão 10 na OFICINA às 8h
  const frases = page.getByRole("list", { name: "Frases automáticas" });
  await expect(frases).toContainText("Aguardando somou 1h00 em 1 parada.");
  await expect(frases).toContainText("A placa EGC2985 sozinha soma 100% do tempo.");
  await expect(frases).toContainText("O pico é das 8h às 10h.");
  await expect(frases).toContainText("Onde mais acontece: OFICINA, 1h00.");
  // por apontamento e placa viram etiquetas
  await page.getByRole("region", { name: "Por apontamento" }).getByRole("button", { name: /^Aguardando Área/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: Aguardando Área" })).toBeVisible();
  await page.getByRole("region", { name: "Placas" }).getByRole("button", { name: /^EGC2985/ }).click();
  await expect(filtrando.getByRole("button", { name: "Tirar filtro: EGC2985" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar tudo" }).click();
  await expect(page.getByRole("region", { name: "Supervisores" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Tendência por dia" }).getByRole("listitem")).toHaveCount(30);
  // família sem paradas: avisa em todas as seções, sem quebrar
  await familias.getByRole("tab", { name: "Pausas e pessoas" }).click();
  await expect(page.getByText("Nada neste filtro.").first()).toBeVisible();
  await expect(frases).toHaveCount(0);
  // sem apontamento: sem o gráfico "Por apontamento"
  await familias.getByRole("tab", { name: "Sem apontamento" }).click();
  await expect(page.getByRole("list", { name: "Frases automáticas" })).toContainText("Sem apontamento somou");
  await expect(page.getByRole("region", { name: "Por apontamento" })).toHaveCount(0);
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
