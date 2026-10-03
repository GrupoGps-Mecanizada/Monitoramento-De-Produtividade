import { Aviso } from "./ui";

/** Esqueleto exibido enquanto os dados chegam (a tela aparece na hora). */
export function Carregando({ linhas = 8, titulo = true }: { linhas?: number; titulo?: boolean }) {
  return (
    <div className="animate-pulse" aria-busy="true" aria-label="Carregando">
      {titulo && <div className="mb-5 h-8 w-72 rounded-lg bg-borda" />}
      <div className="rounded-xl border border-borda bg-superficie p-5 shadow-sm">
        {Array.from({ length: linhas }, (_, i) => (
          <div key={i} className="mb-3 flex gap-3">
            <div className="h-6 w-56 rounded bg-borda/70" />
            <div className="h-6 flex-1 rounded bg-borda/50" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ErroTela({ mensagem }: { mensagem: string }) {
  return <Aviso tipo="erro">Não foi possível carregar: {mensagem}</Aviso>;
}
