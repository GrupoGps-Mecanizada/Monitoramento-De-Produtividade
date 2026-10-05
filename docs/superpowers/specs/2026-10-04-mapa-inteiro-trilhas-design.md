# Mapa inteiro, trilhas e balões (Localização e Timeline) — desenho

> 04/10/2026 · branch `historia-e-frota` (antes de publicar) · base: as 10 tarefas de "história e frota" já feitas

## Objetivo

No computador, as duas telas de mapa usam uma coluna lateral fixa (380 px na Localização e 400 px na Timeline) que empilha tudo. O mapa fica espremido, a faixa do dia fica pequena e o dia vira uma lista comprida. O dono acha a visualização ruim e pediu algo "mais inteligente e preciso", com trilhas dos acontecimentos, uma aba horizontal e balões (popups).

**Ideia única para as duas telas:**
- O mapa ocupa a tela inteira.
- Uma **barra fina no topo** com filtros e números.
- **Trilhas horizontais embaixo**, sobre uma régua de horário.
- **Balões** que mostram o detalhe só quando a pessoa aponta ou clica.

**Sucesso =**
- No computador não existe mais coluna lateral em nenhuma das duas telas.
- Tudo o que a lateral fazia continua acessível em no máximo 1 clique.
- Na Timeline, o dia inteiro aparece numa régua da largura da tela.
- Na Localização, os acontecimentos de hoje aparecem numa faixa horizontal.
- O celular continua como está (gaveta de baixo).
- Nenhuma requisição nova ao GAUSS e nenhuma mudança no coletor nem no banco.
- `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` passam.

## Decisões

| Tema | Decisão |
|---|---|
| Alcance | Só computador (`!celular`). O celular mantém a gaveta e a pílula atuais |
| Peças comuns | Régua, trilha e balão viram componentes compartilhados em `src/components/trilhas/`, usados pelas duas telas |
| Balão | Componente próprio (sem biblioteca nova): abre ao passar o mouse (prévia) ou ao clicar (fixo); fecha com Esc ou clique fora; se ajusta para não sair da tela |
| Detalhe do equipamento (Localização) | **Cartão flutuante** no canto superior direito do mapa, e não um balão preso ao marcador. Motivo: o agrupamento de marcadores (cluster) e o movimento ao vivo fariam o balão pular ou sumir. O marcador escolhido ganha destaque |
| Régua da Timeline | Abre mostrando do 1º ao último registro do dia (arredondado para a hora cheia), com botão "Dia inteiro (0–24h)" e "Ampliar o foco" quando há um período arrastado |
| Altura das trilhas | Painel de baixo com 3 estados: recolhido (só o player e uma trilha fina), normal e alto; troca pelo botão ou puxando a borda; a preferência fica no navegador |
| Lista de capítulos e apontamento | Saem da tela principal e vão para a janela "Apontamento" (abas: Capítulos · Trechos · Tempo por área), que mantém o CSV |
| Faixa de acontecimentos (Localização) | Uma trilha por grupo (Entradas, Saídas, Status, Sinal). Eventos próximos (mesma janela de 10 min na escala atual) viram uma bolinha com número. A "abertura do dia" não aparece (não é alerta) |
| Lógica nova | Funções puras e testadas em `src/lib/dominio/trilhas.ts` (janela da régua, posição em %, agrupamento de eventos próximos) |

## Timeline (computador)

```
┌───────────────────────────────────────────────────────────────────────┐
│ [EAM-3257 ▾] [Hoje ▾] [Ver]   18,4 km · 6h10 lig. · 2h05 par. lig. … │  ← barra do topo
│                                                                       │
│                         MAPA (tela inteira)          [12:41 EAM-3257] │
│                                                                       │
├───────────────────────────────────────────────────────────────────────┤
│ EAM-3257 Alta Pressão · ▶ 1x · ⏭ Próximo capítulo · [Apontamento] ═══ │  ← cabeçalho do painel
│        06h     08h     10h     12h     14h     16h     18h            │  ← régua
│ Capítulos  [1]────[2]──────[3]─────────[4]───[5]                      │
│ Onde estava ▇▇pátio▇▇|▇▇▇ Baia de Resíduos ▇▇▇|▇ vias ▇|▇▇▇▇          │
│ Motor       ████ ░░░░ ████████ ▒▒ ██████                              │
│ ⚙ Bomba          ▬▬▬        ▬▬▬▬                                      │
│                          │ ← linha do player (arrasta)                │
└───────────────────────────────────────────────────────────────────────┘
```

- **Barra do topo:**
  - Seletor de veículo e dia, e o botão "Ver" (o mesmo formulário de hoje, em linha).
  - Os números do dia em pílulas (os mesmos de `itensResumo`).
  - Botão "Resumo do dia" com balão: vaga, aviso do histórico, aviso de RPM travado e os destaques.
  - Selo "RPM travado" visível quando for o caso.
- **Painel de baixo:**
  - Cabeçalho: placa, tipo, player, "Próximo capítulo" e "Apontamento".
  - Régua com as trilhas **Capítulos**, **Onde estava**, **Motor** e **⚙ Bomba** (esta só quando houver motor 2º).
  - Vale tudo o que a faixa do dia já faz:
    - um toque leva ao horário;
    - arrastar escolhe o foco;
    - as setas andam 5 min;
    - Esc limpa o foco.
- **Balões nas trilhas:** ao passar o mouse sobre um bloco aparece o balão do bloco.
  - Capítulo: número, lugar, de–até, duração e tempo ligado/desligado.
  - Onde estava: lugar, de–até e duração.
  - Motor: estado, de–até e duração.
  - Clicar: no capítulo → `irCapitulo`; nas outras trilhas vale o que a faixa já faz (um toque vai ao horário exato, arrastar escolhe o foco).
- **No mapa:** o horário do player (já existe) continua em cima. O cartão de trecho do canto direito sai, porque o balão substitui.
- **Janela "Apontamento":** mostra os capítulos, os trechos, o tempo por área e o "Exportar CSV". O conteúdo é o mesmo de hoje, só muda de lugar.
- **Estados** ("Selecione um veículo", "carregando", "erro", "sem dados", "veículo não encontrado") aparecem centralizados sobre o mapa.

## Localização (computador)

```
┌───────────────────────────────────────────────────────────────────────┐
│ [AP 14][AV 11][HV 3][UV 1][PG 3][AS 10] │ ●Lig 18 ●Desl 20 ●S/sinal 3 ●Manut 1 │ [Áreas] [🔔 7] │
│                                                       ┌─────────────┐ │
│                  MAPA (tela inteira)                  │ EOF-5208    │ │
│                                                       │ Ligado há…  │ │
│                                                       │ Ver o dia ▸ │ │
│                                                       └─────────────┘ │
├───────────────────────────────────────────────────────────────────────┤
│ Acontecimentos de hoje  [Hoje ▾]                                  ═══ │
│ Entradas  ·   ●    ●3      ●          ●                               │
│ Saídas      ●    ●     ●2       ●                                     │
│ Status    ●  ●5     ●       ●                                         │
│ Sinal          ⚠            ⚠                                         │
│        06h     08h     10h     12h     14h     16h     18h            │
└───────────────────────────────────────────────────────────────────────┘
```

- **Barra do topo:**
  - **Tipos** (AP · AV · HV · UV · PG · AS, com quantidade): um clique filtra o mapa por aquele tipo e abre o balão com a lista do tipo (sigla, placa, situação, há quanto tempo). Clicar num item abre o equipamento. Um novo clique no tipo ativo tira o filtro.
  - **Contadores** (Ligados, Desligados, Sem sinal, Manutenção, os mesmos de `RESUMO_TOPO`): filtram o mapa, como hoje.
  - **Áreas:** balão com a lista de áreas (a aba de hoje); clicar foca a área no mapa.
  - **🔔 Alertas:** número de hoje; o balão traz a lista de alertas com os filtros por grupo e a busca (a aba de hoje).
- **Cartão do equipamento:** o conteúdo do `Detalhe` atual (frase de estado, vaga, posição, motorista, bomba, "Mais", "Ver o dia ▸") num cartão flutuante, com Centralizar e Fechar. Abre pelo marcador, pela lista do tipo, pela faixa, pelos alertas e pela busca Ctrl K.
- **Faixa de acontecimentos (embaixo, pode ser recolhida):**
  - O seletor de dia é o mesmo de hoje.
  - Respeita o filtro de tipo.
  - Passar o mouse numa bolinha mostra o balão com o(s) acontecimento(s): o mesmo texto da lista de alertas.
  - Clicar num acontecimento abre o cartão do equipamento.
- **A barra fina de siglas (`BarraTipos`) e a lateral (`Painel` em `aside`) saem do computador.** O `Painel` continua servindo a gaveta do celular.

## O que não muda

- Celular: gaveta, pílula, `ResumoCelular` e o player no rodapé.
- Telas Dia da frota e Alertas.
- Coletor, banco, consultas e a frequência de leitura.
- Regras de domínio (capítulos, motor 2º, RPM travado, frota própria).

## Testes

- **Unidade (`trilhas.ts`):**
  - Janela da régua: dia com registros, dia vazio e o limite de 24h.
  - Posição e largura em % dentro da janela, cortando o que fica fora dela.
  - Agrupamento de eventos próximos: contagem, ordem e o filtro de tipo.
- **Navegador (dados sintéticos de `e2e/apoio.ts`, sem gravar nada):**
  - Localização: não há coluna lateral; clicar em "AP" filtra o mapa e abre a lista; clicar num item abre o cartão; o sino abre os alertas; a faixa mostra os acontecimentos e o balão aparece.
  - Timeline: as trilhas aparecem; passar o mouse num capítulo mostra o balão; clicar leva o player; "Apontamento" abre a janela com o CSV.
  - Os testes de celular continuam valendo sem mudança.
