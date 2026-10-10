import { expect, test } from "@playwright/test";
import { eventos, hoje, prepararDados } from "./apoio";

const minutosAtras = (m: number) => new Date(Date.now() - m * 60000).toISOString();

test("Exceções do dia: resumo por regra, lista por equipamento e por regra, link para a Timeline", async ({ page }) => {
  const extra = [
    { t: minutosAtras(50), id: "10", placa: "EGC2985", vaga: "", tipo: "entrada", area: "OFICINA CENTRO", lat: -19.48, lng: -42.53 },
    { t: minutosAtras(40), id: "10", placa: "EGC2985", vaga: "", tipo: "saida", area: "OFICINA CENTRO", desde: minutosAtras(50), permanencia_min: 10 },
  ];
  const excessos = [{ dia: hoje(), veiculo_id: "10", ini: 3600, fim: 3660, vel_max: 52, lat: -19.48, lng: -42.53 }];
  const gravacoes = await prepararDados(page, { eventos: [...eventos(), ...extra], excessos });
  await page.goto("/alertas/");
  await expect(page.getByRole("tab", { name: "Exceções do dia" })).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("button", { name: /Oficina de fora/ })).toContainText("1");
  // regra 10: excesso de velocidade registrado pela madrugada
  await expect(page.getByRole("button", { name: /Velocidade acima de 30 km\/h/ })).toContainText("1");
  const lista = page.getByRole("region", { name: "Exceções", exact: true });
  await expect(lista).toContainText("EGC-2985");
  await expect(lista).toContainText("OFICINA CENTRO");
  await page.getByRole("tab", { name: "Por regra" }).click();
  await expect(lista.getByRole("heading", { name: /Oficina de fora/ })).toBeVisible();
  await lista.getByRole("link", { name: /Timeline/ }).first().click();
  await expect(page).toHaveURL(/\/timeline\/\?v=10&dia=/);
  expect(gravacoes).toEqual([]);
});
