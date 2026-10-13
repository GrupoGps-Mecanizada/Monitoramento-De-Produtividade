# CHANGELOG · Monitoramento de Localização

## Análise mais limpa · 13/10/2026 (não publicado)
- **Saiu o placar** da aba Paradas (Produtivo, % Produtivo, Parado, Serviços), a pedido do dono.
- **O período (7, 15, 30 dias) subiu para o topo**, ao lado de "Paradas | Disponibilidade". Só aparece em Paradas: a Disponibilidade segue o período do boletim oficial.

## Medição oficial na Análise · 13/10/2026 (não publicado)
- **Aba Disponibilidade** na Análise (a aba Paradas continua sendo a padrão): os números **oficiais** dos boletins de medição GPS já fechados. Escolha do ciclo, selo Oficial, placar (DF da frota, horas indisponíveis, pior vaga), vagas da pior DF para a melhor com o motivo que mais pesou e, ao clicar, o detalhe: DF por dia, horas por motivo, motor secundário ligado (timeline de motor), placas, conferência eventos × boletim e cada indisponibilidade (placa, início, fim, motivo).
- **Coletor:** baixa cada boletim novo uma única vez (1 lista por dia, 1 boletim por ciclo), com uma trava que só deixa passar as 2 chamadas de leitura do Dashboard Medição.
- **Banco:** `supabase/medicao.sql` (4 tabelas `medicao_*`, leitura pública, grava só o coletor). Precisa rodar antes de publicar.
- Período em aberto, "agora" e o selo Parcial ficam para a Fase 2.

## Análise em painel · 10/10/2026 (não publicado)
- **A tela Análise virou um painel de apresentação** (computador/TV): filtros e placar em cima (produtivo, % produtivo, parado, serviços), mapa de bolhas à esquerda e 3 gráficos à direita (Lugares, Por serviço, Hora do dia), todos com o número exato escrito.
- **Um filtra o outro:** clicar numa bolha, num lugar, num serviço ou numa hora vira uma etiqueta no topo e filtra o resto; o × tira só aquela e "Limpar tudo" volta.
- **Saíram:** o funil, o botão de lista, as 6 medidas, o "Ir para", a troca de fundo preto/branco, os filtros de faixa do dia e dia da semana e o detalhe "quem atende" (pedido do dono: menos botões, dados precisos).
- Mapa: só os 3 serviços com mais paradas ganham cor (testadas para daltonismo); os outros ficam cinza.

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
