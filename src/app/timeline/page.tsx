import { Suspense } from "react";
import { Timeline } from "./_componentes/timeline";

// useSearchParams num site estático precisa de Suspense: os parâmetros são lidos no navegador
export default function Pagina() {
  return (
    <Suspense>
      <Timeline />
    </Suspense>
  );
}
