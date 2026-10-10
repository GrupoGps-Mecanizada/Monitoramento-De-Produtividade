import { Suspense } from "react";
import { AbasAlertas } from "./_componentes/abas";

// ?placa= é lido no navegador (site estático): precisa de Suspense
export default function Pagina() {
  return (
    <Suspense>
      <AbasAlertas />
    </Suspense>
  );
}
