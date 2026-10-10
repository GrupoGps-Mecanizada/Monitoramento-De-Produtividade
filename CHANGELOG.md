# CHANGELOG · Monitoramento de Localização

## Portal SGE · 10/10/2026
- **Dentro do Portal SGE (sge-portal.pages.dev) fica só a barra do Monitoramento:** a barra se apresenta ao portal (`SGEPortal.registrarBarra`) e a do portal some; a logo volta ao início do portal e aparece o botão **Sair**, que sai de todos os sistemas. Fora do portal (github.io direto) nada muda. Código em `src/lib/portal.ts` (mesmo contrato do SST e da Barra Universal do sge-core); teste em `e2e/portal.spec.ts`. Feito também no ramo `portal-sge` (a partir do `main`) para publicar sozinho.

## v1.1.0 · 05/10/2026 (aguardando o banco para publicar)
- **Matriz de equipamentos ligada ao banco** (Supabase PRODUTIVIDADE, `supabase/equipamentos.sql`): a lista da frota saiu do código. Coletor, mapa, Dia da frota, Timeline, Alertas e busca usam a matriz.
- Status por equipamento: **Ativo**, **Em manutenção** (continua no sistema, com selo) e **Desmobilizado** (sai do sistema). Supervisor e regime por equipamento, com listas editáveis.
- Tela nova **Equipamentos** (menu, depois da Timeline): planilha na tela inteira, no mesmo formato do SST - Mecanizada (filtro no cabeçalho, Ctrl+F, Excel e Imprimir como está na tela). Colunas: Tipo, Placa/Equipamento, Status, Supervisor, Regime, Observação, Atualizado em. Dois cliques abrem o equipamento; **+ Novo equipamento**; histórico de mudanças. No celular, cartões.
- Sem login (decisão do dono): qualquer um cadastra e altera; ninguém apaga (`supabase/equipamentos-sem-login.sql`).
- Carga inicial: as 42 da planilha "PLACAS VEICULOS.xlsx" de 05/10/2026 (entra o FMD-2200 no Hiper Vácuo); o Ultravac OWU-1596, que não está na planilha, fica como Desmobilizado.
- **Timeline repaginada (foco no mapa):** sai o painel de trilhas. Mapa na tela toda; em cima, o cartão do horário e o funil; embaixo, só a linha fina do dia (cores do motor, clique/arraste leva ao horário) e ◀ ▶ ▶. Velocidade, acelerar paradas, seguir caminhão, resumo do dia, apontamento/CSV e satélite/mapa foram para o funil. Igual no computador e no celular.
- **Análise no jeito da Timeline (08/10/2026):** mapa na tela toda com fundo preto; em cima, o cartão "Produtivo · 30 dias" e o funil, que reúne medida (Produtivo, Parado ligado sem produzir, Tempo parado, Visitas, Tipo de local, Apontamento), período, filtros e "Ir para". Embaixo do funil, o botão de lista abre Áreas | Resumo; clicar numa área no mapa abre o detalhe dela. O fundo do mapa troca entre preto e branco no funil (fica guardado neste navegador).
- Barra superior: abaixo de 1280px o menu mostra só os ícones; leitura ao vivo e busca encolhem até 1600/1700px (com 5 telas o menu encavalava).
