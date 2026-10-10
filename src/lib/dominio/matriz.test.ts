import { describe, expect, it } from "vitest";
import { contarStatus, linhasMatriz } from "./matriz";
import { matrizExemplo } from "./matriz-exemplo";

describe("matriz na tela Equipamentos", () => {
  const MATRIZ = matrizExemplo();
  it("em ordem de tipo e posição", () => {
    expect(linhasMatriz([...MATRIZ].reverse()).slice(0, 2).map((x) => x.placa)).toEqual(["CZC-0453", "DSY-6472"]);
  });
  it("conta por status", () => {
    expect(contarStatus(MATRIZ)).toEqual({ ATIVO: 42, EM_MANUTENCAO: 0, DESMOBILIZADO: 1 });
  });
});
