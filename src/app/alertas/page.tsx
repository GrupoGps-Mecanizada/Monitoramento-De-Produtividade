import { Suspense } from "react";
import { Alertas } from "./_componentes/alertas";

// ?placa= é lido no navegador (site estático): precisa de Suspense
export default function Pagina() {
  return (
    <Suspense>
      <Alertas />
    </Suspense>
  );
}
