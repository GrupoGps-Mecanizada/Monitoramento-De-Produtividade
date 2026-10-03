import { existsSync, readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { montarApontamento } from "../src/lib/dominio/apontamento";

// Amostras do coletor antigo em JS, gravadas por coletor/scripts/gravar-amostras.mjs (Tarefa 5; o script sai do
// repositório junto com o JS, mas fica no histórico do git). Têm dados reais e ficam fora do git: sem elas
// (CI), este bloco é pulado e valem os testes sintéticos de src/lib/dominio.
const PASTA = new URL("./__amostras__/", import.meta.url);
const arquivos = existsSync(PASTA) ? readdirSync(PASTA) : [];
const ler = (nome: string) => JSON.parse(readFileSync(new URL(nome, PASTA), "utf-8"));
// o banco guarda JSON: compara como JSON (campos undefined somem, NaN vira null)
const json = (v: unknown) => JSON.parse(JSON.stringify(v));

describe.skipIf(!arquivos.length)("paridade com o coletor em JS", () => {
  for (const nome of arquivos.filter((n) => n.startsWith("apontamento-"))) {
    it(`apontamento igual: ${nome}`, () => {
      const a = ler(nome);
      expect(json(montarApontamento(a.pontos, a.cercas, a.pontosMotor2))).toStrictEqual(a.saida);
    });
  }
});
