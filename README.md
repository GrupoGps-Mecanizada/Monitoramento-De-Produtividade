# Monitoramento De Produtividade

Painel de timeline (Telemetria + Apontamentos) por equipamento — ALTA PRESSÃO / AUTO VÁCUO / HIPER VÁCUO.

Página estática (`index.html`), sem backend próprio: lê os dados direto do Supabase (via chave pública de leitura, protegida por Row Level Security) e atualiza sozinha a cada minuto. Publicada via GitHub Pages.

A extração dos dados do GAUSS FLEET para o Supabase roda separadamente, em um script agendado.
