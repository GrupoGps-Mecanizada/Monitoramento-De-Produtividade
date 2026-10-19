# CHANGELOG · Monitoramento de Localização

## Parte Diária no coletor · 18/10/2026
- O coletor passa a buscar a **Parte Diária** (Logística Inbound > Imp. Detalhes Solicitação do GAUSS): para cada vaga, o horário programado, local/origem, endereço, onde se apresentar, atividade, material, destino, gerência e as perguntas de segurança (altura, andaime, confinado, gás).
- Mesmo caminho da tela, só leitura e travado (`conferirChamada`): hoje a cada 30 min, ontem uma vez depois da virada e, na primeira vez, os últimos 10 dias, um dia por execução. Falhou: espera 30 min.
- **Sem nomes e sem telefones** (solicitante, beneficiário, responsável e o texto livre ficam de fora). Tabela `parte_diaria` sem leitura pública por enquanto (SQL `supabase/2026-10-18_parte-diaria.sql`).

## Dia da frota só por vaga, no desenho da Gestão de alertas · 17/10/2026
- Saiu a visão **Por equipamento**: o Dia da frota é só **por vaga** (as 22 vagas, espelho da timeline do GAUSS).
- Desenho da Gestão de alertas: página toda branca, **abas em cascata** (Todas · Alta Pressão · Auto Vácuo · Hiper Vácuo → as vagas do tipo, AP-01, AP-02...), o dia numa pílula, números em linha ("22 vagas · 9 ligadas agora · 7 desligadas · 6 sem caminhão · todas iguais ao GAUSS").
- Escolhendo a vaga (pela aba ou clicando no nome), aparece a **tabela dos trechos** (início, fim, duração, status, caminhão) sem grade; o caminhão abre a Timeline dele.

## Gestão de alertas · 16/10/2026
- Tela nova **Gestão de alertas** (menu Ao vivo): Fila com nota e "Por que essa nota?", ações (Visto, Resolver, Silenciar, Era/Não era problema), Histórico de 90 dias, Filtro inteligente com simulador dos últimos 7 dias e sugestões, Destinatários e Saúde.
- Visual minimalista escolhido pelo dono: abas de texto, visões com contagem, números numa linha, "+ Filtro" em pílulas, tabela sem grade, detalhe ao lado e página toda branca.
- Ver não pede login; agir, salvar o filtro e ver telefones pede e-mail e senha (Supabase Auth, cadastro aberto desligado). Permissões por coluna em `supabase/alertas.sql`.

## Alertas guardados com nota · 16/10/2026
- Etapa 1 do P-026: cada exceção do dia vira um alerta único na tabela `alertas` (SQL `supabase/alertas.sql`), com nota 0–100, os motivos e o destino (WhatsApp, resumo ou só tela). Regras puras em `src/lib/dominio/alertas/`; detector no coletor a cada 10 min (`coletor/alertas.ts`). Ainda sem tela de gestão e sem WhatsApp.

## Só as vagas que a Mecanizada opera · 16/10/2026
- A lista do GAUSS tem 58 vagas da GPS; o coletor buscava todas (pesava no GAUSS e no tempo da execução) e o Dia da frota mostrava vagas que a Mecanizada não opera (AP 11 a 14, AV 09 a 11, Pipa, Mini Carregadeira, Moto Bomba...).
- Agora valem só as **22 vagas do dono** (tela do GAUSS dele, 16/10/2026; as demais da GPS estão desativadas): Alta Pressão 01 (24 h), 02–06, 07 (16 h), 08 (24 h), 09 e 10; Auto Vácuo 01 (24 h), 02–06, 07 (16 h), 08 (24 h); Hiper Vácuo 01–04. Aspiradores e Brooks não entram. Um lugar só: `src/lib/dominio/vagas-oficiais.ts` (coletor, reprocessamento e tela).

## Coletor: timeline de motor não trava mais na virada do dia · 16/10/2026
- Desde 00:05 de 16/10 toda execução passava de 8 min e era cancelada: na virada do dia cada vaga busca ontem e hoje (19 vagas × 2 no GAUSS) e o progresso só era gravado no fim, então cada execução recomeçava do zero.
- Agora a timeline tem 3 min por execução (`ORCAMENTO_MOTOR_MS`): passou disso, grava o que fez e a próxima execução (5 min depois) continua com as vagas que faltam, sem esperar o ciclo de 10 min.
- Teste novo: `coletor/motor-orcamento.test.ts` (virada do dia com GAUSS lento).

## Coletor: menos log no Supabase · 16/10/2026
- O log do Supabase (1 GB/mês no plano grátis) chegou a 0,99 GB antes de fechar o mês. O coletor roda a cada 5 min e cada requisição vira uma linha de log.
- As chaves do `loc_kv` que o ciclo lê (sessão, estado, cadastro, cercas, controles) vêm **numa requisição só** no início (`kvCarregar`), em vez de uma por chave (~13). Carga, retrato e sessão são gravados juntos no fim (3 → 1).
- A conferência das 3 tabelas do tempo real fica anotada no `loc_kv` (`tempo_real_pronto`): não testa as tabelas a cada execução.
- Nada muda na tela nem no que é coletado. SQL de reserva para pausar/religar o coletor: `supabase/2026-10-16_pausar-coletor.sql` e `supabase/2026-10-16_religar-coletor.sql`.
## Timeline por vaga fiel ao GAUSS + reprocessamento · 15/10/2026 (não publicado; ramo `timeline-por-vaga`)
- **Correção dos dados (causa do "apropriado no GAUSS e não no sistema"):** cada trecho da timeline de motor passa a guardar o **caminhão daquele trecho** (`vehicle_data` do GAUSS). Antes ia o caminhão que estava na vaga na hora da busca, e o dia inteiro da vaga caía num caminhão só (ex.: 15/10, AP-01 teve PUB2F80 e EAM-3253). Vale para tudo que lê `timeline_motor_vaga`: Dia da frota, Timeline, Cronoanálise, Medição, Análise (paradas) e a view `vaga_do_dia`.
- **Todas as vagas da GPS** da lista do GAUSS são buscadas (antes, só as que a planilha dizia ter caminhão). A regra da vaga quieta usa o caminhão que o GAUSS diz estar na vaga.
- **Troca do dia inteiro** a cada busca (função `substituir_timeline_vaga`, numa transação): trecho que o GAUSS corrigiu depois não sobra. Apontamento do tablet apagado no GAUSS sai do banco também.
- **Reprocessamento** de 01/10 a 14/10, aos poucos (12 vagas por ciclo): timeline → tablet → paradas da Análise (estas só no Supabase, sem consultar o GAUSS). Liga e reinicia pela linha `reprocesso` do `loc_kv`.
- **Dia da frota "Por vaga (igual ao GAUSS)"** (padrão): uma linha por vaga na ordem do GAUSS, mesmas cores e rótulos ("15/10 08:15 ~ 15/10 10:20"), régua 00–23, caminhões da vaga no dia, troca de caminhão marcada, clique no trecho abre a Timeline do caminhão. A visão antiga continua em "Por equipamento".
- **Conferência com o GAUSS:** `timeline_conferencia` guarda o que o GAUSS mandou em cada vaga-dia; a tela marca "✓ igual ao GAUSS" ou avisa a diferença. Também avisa caminhão apropriado em duas vagas ao mesmo tempo no próprio GAUSS (15/10: DSY6475 em AP-09 e AP-10).
- SQL: `supabase/2026-10-15_timeline-por-vaga.sql` (rodar antes de publicar).

## Análise: supervisor pela vaga · 15/10/2026 (não publicado; ramo `crono-telemetria-placa`)
- O supervisor passa a ser o **da vaga em que o caminhão estava naquele dia**, não o da placa (os caminhões rodam entre as vagas). Regra do segundo cérebro: Junior Pereira (AP 02–06, 09, 10), Donizete (AV 02–06, Hipervácuo 01 e 02), Genésio (aspiradores, Brooks, Hipervácuo 03 e 04); vagas 24 h (AP/AV 01 e 08) pelo supervisor da letra do 4x4 no horário da parada; AP/AV 07 (16 h) sem supervisor.
- A vaga de cada dia vem da view nova `vaga_do_dia` (SQL `supabase/2026-10-15_vaga-do-dia.sql`). Sem a view, vale o supervisor da matriz.

## Cronoanálise: motor pela placa quando o GAUSS não tem a vaga · 15/10/2026 (não publicado; ramo `crono-telemetria-placa`)
- Quando a vaga do GAUSS não tem o caminhão no turno (S/ VAGA, ex.: EAM3256 em 13/10) ou a folha não tem vaga com número, o motor vem **pela placa**: montado com os eventos do mapa ao vivo (`loc_eventos`: abertura do dia, troca de status, sinal perdido/retomado, motor 2º do caminhão). Nenhuma consulta nova ao GAUSS.
- A tela avisa quando o motor veio pela placa (menos preciso: leituras de minutos) e quando nem a vaga nem a placa têm dados.

## Sistema mais limpo · 14/10/2026 (não publicado)
- **Mapa com diferenciação** (pesquisa de 14/10/2026: Esri, ColorBrewer, Penn State): botão **Da cerca | Quanto parou | O que parou**. "Quanto parou" usa 5 tons sólidos da cor da aba (claro = pouco, escuro = muito); "O que parou" pinta cada área pela categoria que mais pesou (status em 6 grupos + cinza, família, ou apontamento da família), forte quando passa da metade, fraco quando venceu por pouco e cinza quando é misto; passar o mouse mostra a divisão. Nos dois modos o satélite fica cinza e escuro.
- **Filtros da Cronoanálise separados:** Data, Letra, Turno (dia/noite), Vaga, Tipo (AP/AV/HV/AS) e Supervisor, em cascata (cada um só oferece o que existe com os outros). Folha sem letra recebe a letra pela escala 4x4 e o supervisor pela letra (regra do segundo cérebro, 14/10/2026). O seletor do turno só aparece quando mais de um bate.
- **Menu em 3 categorias:** Ao vivo (Localização, Alertas), Análises (Análise, Dia da frota, Timeline, Cronoanálise) e Cadastros (Equipamentos). A categoria abre a lista das telas e mostra a tela aberta; no celular, a barra de baixo tem as 3 categorias e a busca.
- **Largura total:** Alertas, Exceções, Dia da frota, Cronoanálise e a faixa da Timeline usam a página de canto a canto.
- **Cronoanálise limpa:** saíram os botões de zoom (+, −, ◀ ▶, Turno inteiro): a rodinha do mouse aproxima e afasta e arrastar o raio-x anda no tempo; saíram os textos de ajuda e as explicações longas dos números.

## Cronoanálise sem a conferência · 14/10/2026
- Saiu a seção **"Conferência: folha × motor × tablet"** (percentuais e frases), a pedido do dono. Ficam o raio-x com zoom, os apontamentos dos colaboradores e o ranking das atividades.

## Cronoanálise: zoom no raio-x · 14/10/2026
- **Rodinha do mouse** sobre as faixas aproxima e afasta, no ponto do mouse. Shift + rodinha (ou o touchpad na horizontal) anda para os lados. Também há os botões − + ◀ ▶ e "Turno inteiro", que servem no celular.
- Aproximando, aparece o **nome dentro de cada caixa**, mesmo quando ela começa antes da parte visível, e a régua passa a marcar 30, 15 ou 5 minutos.
- A peça de zoom da Timeline (`zoom-roda.ts`) passou a aceitar outra régua (o turno de 12 h), sem mudar o comportamento na Timeline.

## Cronoanálise × telemetria · 14/10/2026 (não publicado; ramo `cronoanalise`)
- **Tela nova "Cronoanálise"** no menu (depois da Análise). Lê as folhas do sistema Cronoanálise (`crono_registros`) e cruza com a timeline de motor do GAUSS e com o tablet. Tudo vem do Supabase: nenhuma consulta nova ao GAUSS.
- **Escolha do turno:** dia, dia ou noite, letra (com o supervisor) e vaga. Abre no mais recente.
- **Raio-x do turno:** linhas do tempo alinhadas de 18:40 a 06:40 (ou de 06:40 a 18:40): Motor (cores do GAUSS), Tablet e uma linha por colaborador (Produzindo, Improdutivo necessário, Improdutivo, Sem código). Passar o mouse mostra a atividade, o horário e a observação da folha.
- **Conferência:** percentual de concordância entre a folha e o motor, minuto a minuto (Alta Pressão = motor 2º; Alto Vácuo = parado ligado), horas produzindo na folha, motor produtivo e quanto o tablet confere com a folha. Frases automáticas onde não bate: produzindo na folha com o motor parado, bomba ligada sem ninguém produzindo e apontamento do tablet diferente da folha.
- **Apontamentos dos colaboradores:** horas de cada pessoa por classificação e as principais atividades, mais o ranking das atividades que mais tomam tempo em todos os turnos lançados. Os nomes aparecem (decisão do dono, 14/10/2026).
- O motor é cruzado pela **vaga da folha** (a timeline do GAUSS é gravada por vaga, e o caminhão pode trocar de vaga).
- `montarStatusGauss` e `montarTablet` aceitam outra régua de tempo (o turno, que passa da meia-noite), sem mudar o resultado das outras telas.

## Análise mais limpa · 13/10/2026 (não publicado)
- **Saiu o placar** da aba Paradas (Produtivo, % Produtivo, Parado, Serviços), a pedido do dono.
- **O período (7, 15, 30 dias) subiu para o topo**, ao lado de "Paradas | Disponibilidade". Só aparece em Paradas: a Disponibilidade segue o período do boletim oficial.
- **Subabas por família de apontamento** ao lado do mapa: Visão geral (o painel de sempre), Aguardando, Pausas e pessoas, Logística, Preparação e bloqueio, Manutenção e clima e Sem apontamento. A família escolhida filtra também o mapa.
- Em cada família: **frases automáticas** (total e comparação com o período anterior em 7 e 15 dias, placa que concentra o tempo, pico de 2 horas, lugar), **por apontamento**, **quem mais para** (placas e supervisores, com média por parada) e **tendência por dia**. Clicar numa placa vira filtro; num supervisor, preenche o filtro do topo.
- Aviso "Último dia com dados" quando o envio do histórico parou. Apontamento novo do tablet cai em Manutenção e clima com aviso.
- **Uma linha só** no topo: abas, período e filtros (também na Disponibilidade).
- **Mapa de satélite normal com as cercas nas cores do GAUSS** (como na Localização; plantas tracejadas), no lugar das bolhas. Passar o mouse numa cerca mostra nome e horas paradas; clicar filtra o resto. (O mapa de calor chegou a ser feito e saiu a pedido do dono.)
- **Mata CDP e USIPA** saem do mapa e das contas (como o Pátio da base).
- **Abas de assunto** ao lado do mapa: **Status do motor** (padrão: horas paradas, % com motor ligado, status que mais pesa; clicar num status faz placas, lugares e hora pesarem só ele), **Motor secundário** (bomba do Alta Pressão: horas, % do tempo, placa campeã, lugares, placas e hora) e **Apontamentos** (a Visão geral e as famílias de antes).
- **Visualização inteligente** (pesquisa de 14/10/2026): seletor **Cor do mapa** (Da cerca | Tempo parado: 5 tons de azul e as horas escritas nas cercas que mais pesam), grade **Quando para** (dia da semana × hora, clicável: filtra hora e dia) no lugar de "Hora do dia" e, em Status do motor, **barra por placa dividida por status** com o destaque e o total.
- **Cores por assunto** (pedido do dono, 14/10/2026): cada status do motor na cor da Timeline (verde ligado, amarelo parado ligado, ciano motor 2º, vermelho desligado, laranja manutenção, cinza sem dado), as barras por placa coloridas por status com legenda, cada apontamento na cor da família (Aguardando laranja, Pausas verde, Logística azul, Preparação âmbar, Manutenção rosa) e lugares/grade na cor do que está sendo medido (ciano na bomba, a cor do status escolhido, a da família).
- **Apontamentos no mesmo molde** das outras abas: cada família com números (horas, paradas, o que mais pesa), frases, por apontamento, placas e supervisores, lugares, grade Quando para e tendência por dia. Correções: sem comparação com o período anterior quando o histórico parou (antes inventava uma queda); o serviço escolhido acha as variações do nome do tablet; o supervisor escolhido continua na lista, marcado.
- **Mapa na cor da aba e painel limpo** (pedido do dono): o modo "Pelo tempo" do mapa mostra o mesmo dado e a mesma cor da aba aberta (tempo parado em azul, bomba em ciano, o status escolhido na cor dele, a família na cor dela), com a legenda dizendo o que mede. Saíram os cartões "O que os dados dizem" de todas as abas.
- **Ocultar gráficos:** botão no fim da linha de filtros; o mapa ocupa a tela inteira e as cercas continuam filtrando. A escolha fica guardada no navegador.

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
