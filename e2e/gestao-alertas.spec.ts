import { expect, test } from "@playwright/test";
import { hoje, prepararDados } from "./apoio";

const alerta = (o: Record<string, unknown>) => ({
  id: 1, chave: "k1", regra: "saida_tarde", veiculo_id: "10", placa: "EGC2985", vaga: "ALTA PRESSÃO - GPS - 02", supervisor: "Junior Pereira", dia: hoje(), ini: 29400, fim: null, ref: 27900,
  local: "PÁTIO DO TRANSPORTE RODOVIÁRIO", detalhe: "saiu 08:10 · limite 07:45", situacao: "aberto", nota: 65, destino: "whatsapp", avaliacao: null, contagem: 3, visto_por: null, visto_em: null,
  resolvido_em: null, resolvido_por: null, ultimo_aviso_em: null, detectado_em: new Date().toISOString(), atualizado_em: new Date().toISOString(),
  motivos: [{ texto: "Peso da regra", pontos: 35 }, { texto: "Passou de 15 min", pontos: 30 }],
  contexto: { excessoMin: 25, repeticoes: 0, familias: [], fracaoSemSinal: 0, presumido: false }, ...o,
});

test("Gestão de alertas: fila com nota e motivos, histórico, simulador e destinatários protegidos; sem login nada grava", async ({ page }) => {
  const alertas = [alerta({}), alerta({ id: 2, chave: "k2", regra: "ocioso", nota: 30, destino: "resumo", situacao: "resolvido", detalhe: "40 min", motivos: [{ texto: "Peso da regra", pontos: 30 }] })];
  const gravacoes = await prepararDados(page, { alertas });
  await page.goto("/gestao-alertas/");
  await expect(page.getByRole("tab", { name: "Fila" })).toHaveAttribute("aria-selected", "true");
  const fila = page.getByRole("region", { name: "Fila de alertas" });
  await expect(fila).toContainText("EGC2985");
  await expect(fila).toContainText("Saída tarde do Pátio");
  // a ociosidade resolvida não está na lista da fila (o nome aparece só no filtro de regras)
  await expect(fila.getByRole("list")).not.toContainText("Ociosidade");
  await fila.getByText("Por que essa nota?").click();
  await expect(fila).toContainText("Passou de 15 min");
  await expect(fila.getByRole("button", { name: "Visto" })).toBeDisabled();
  await page.getByRole("tab", { name: "Histórico" }).click();
  await expect(page.getByRole("region", { name: "Histórico de alertas" })).toContainText("Ociosidade");
  // avaliar também no histórico (os alertas saem da fila logo), mas só com login
  await expect(page.getByRole("region", { name: "Histórico de alertas" }).getByRole("button", { name: "Não era problema" }).first()).toBeDisabled();
  await page.getByRole("tab", { name: "Filtro inteligente" }).click();
  await expect(page.getByRole("region", { name: "Simulador" })).toContainText("2 alertas");
  await expect(page.getByRole("button", { name: "Salvar" })).toBeDisabled();
  await page.getByRole("tab", { name: "Destinatários" }).click();
  await expect(page.getByText(/Entre para ver/)).toBeVisible();
  expect(gravacoes).toEqual([]);
});
