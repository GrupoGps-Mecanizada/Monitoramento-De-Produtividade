import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const alerta = (o: Record<string, unknown>) => ({
  id: 1, chave: "k1", regra: "saida_tarde", veiculo_id: "10", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: hoje(), ini: 29400, fim: null, ref: 27900,
  local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", detalhe: "saiu 08:10 · limite 07:45", situacao: "aberto", nota: 65, destino: "whatsapp", avaliacao: null, contagem: 3, visto_por: null, visto_em: null,
  resolvido_em: null, resolvido_por: null, ultimo_aviso_em: null, detectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  motivos: [{ texto: "Peso da regra", pontos: 35 }, { texto: "Passou de 15 min", pontos: 30 }],
  contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

test("Gestão de alertas: cartões que filtram, lista agrupada, gaveta com o porquê, simulador e destinatários protegidos; sem login nada grava", async ({ page }) => {
  const alertas = [alerta({}), alerta({ id: 2, chave: "k2", regra: "ocioso", placa: "EAM3257", nota: 30, destino: "resumo", situacao: "resolvido", detalhe: "40 min", motivos: [{ texto: "Peso da regra", pontos: 30 }] })];
  const gravacoes = await prepararDados(page, { alertas });
  await page.goto("/gestao-alertas/");
  await expect(page.getByRole("tab", { name: "Alertas" })).toHaveAttribute("aria-selected", "true");
  const resumo = page.getByRole("group", { name: "Resumo" });
  await expect(resumo.getByRole("button", { name: /Na fila/ })).toHaveAttribute("aria-pressed", "true");
  await expect(resumo.getByRole("button", { name: /Na fila/ })).toContainText("1");
  const lista = page.getByRole("region", { name: "Lista de alertas" });
  await expect(lista).toContainText("EGC2985");
  await expect(lista).toContainText("Junior Pereira");
  await expect(lista).not.toContainText("EAM3257");
  // o cartão Resolvidos filtra a lista
  await resumo.getByRole("button", { name: /Resolvidos/ }).click();
  await expect(lista).toContainText("EAM3257");
  await expect(lista).not.toContainText("EGC2985");
  await resumo.getByRole("button", { name: /Resolvidos/ }).click();
  // atalho e etiqueta
  await page.getByRole("button", { name: "Sem avaliação" }).click();
  await expect(page.getByRole("button", { name: "Tirar filtro: Sem avaliação" })).toBeVisible();
  await page.getByRole("button", { name: "Limpar" }).click();
  // gaveta: o porquê da nota e as ações pedem login
  await lista.getByRole("button", { name: /EGC2985/ }).click();
  const gaveta = page.getByRole("dialog", { name: "EGC2985 · Saída tarde do Pátio" });
  await expect(gaveta).toContainText("Passou de 15 min");
  await expect(gaveta).toContainText("Entre (botão no topo)");
  await gaveta.getByRole("button", { name: "Fechar" }).click();
  await page.getByRole("tab", { name: "Filtro inteligente" }).click();
  await expect(page.getByRole("region", { name: "Simulador" })).toContainText("2 alertas");
  await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await page.getByRole("tab", { name: "Destinatários" }).click();
  await expect(page.getByText(/Entre para ver/)).toBeVisible();
  expect(gravacoes).toEqual([]);
});
