import { expect, test } from "@playwright/test";
import { prepararDados } from "./apoio";

// Portal SGE de mentira no mesmo endereço: guarda o que o Monitoramento chamou e abre o sistema numa moldura.
const PORTAL = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width"><script>
  window.chamadas = [];
  window.SGEPortal = {
    registrarBarra: () => chamadas.push("registrarBarra"),
    inicio: () => chamadas.push("inicio"),
    sair: () => chamadas.push("sair"),
    entrar: () => chamadas.push("entrar"),
    abrir: () => chamadas.push("abrir"),
  };
</script><iframe src="/frota/" style="width:100%;height:95vh;border:0;display:block"></iframe>`;

test("Dentro do Portal SGE: barra se apresenta, logo volta ao início do portal e Sair sai do portal", async ({ page }) => {
  await prepararDados(page);
  await page.route("**/portal-de-teste.html", (r) => r.fulfill({ contentType: "text/html", body: PORTAL }));
  await page.goto("/portal-de-teste.html");
  const sistema = page.frameLocator("iframe");
  const chamadas = () => page.evaluate(() => (window as unknown as { chamadas: string[] }).chamadas);

  await expect(sistema.getByRole("button", { name: "Sair" }).first()).toBeVisible();
  await expect.poll(chamadas).toContain("registrarBarra");

  await sistema.getByRole("button", { name: "Sair" }).first().click();
  await expect.poll(chamadas).toContain("sair");

  const logo = test.info().project.name === "celular" ? sistema.getByRole("button", { name: "Início do portal" }) : sistema.getByRole("link", { name: /Monitoramento/ }).first();
  await logo.click();
  await expect.poll(chamadas).toContain("inicio");
  expect(await chamadas()).not.toContain("entrar"); // sem login próprio: nunca pede para entrar
  expect(page.frames()[1].url()).toMatch(/\/frota\/$/); // a logo não navegou dentro da moldura
});

test("Fora do portal nada muda: sem botão Sair", async ({ page }) => {
  await prepararDados(page);
  await page.goto("/frota/");
  await expect(page.getByRole("heading", { name: /Alta Pressão/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sair" })).toHaveCount(0);
});
