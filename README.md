# Monitoramento de Localização · Grupo GPS · Mecanizada

Mapa ao vivo da frota (ALTA PRESSÃO / AUTO VÁCUO / HIPER VÁCUO / aspiradores) na Usiminas Ipatinga, trajeto do dia com reprodução (player) e apontamento por veículo, e alertas de entrada/saída de área, status e sinal. Os dados vêm da tela "Localização" do GAUSS FLEET, que **não tem API pública**: o coletor usa as mesmas chamadas da página, com cuidado para não sobrecarregar o servidor.

- **No ar:** https://grupogps-mecanizada.github.io/Monitoramento-De-Produtividade/ (GitHub Pages, site estático, público)
- **Banco:** Supabase **PRODUTIVIDADE** (`mfsyrsegkvjmefcdaegh`), tabelas `loc_*`
- **Estrutura e visual:** os mesmos do sistema **SST - Mecanizada** (Next.js + TypeScript + Tailwind, identidade "Campo")

> Para quem continuar o trabalho: leia primeiro os **Pontos de atenção do dono**.

---

## Pontos de atenção do dono (leia antes de mudar qualquer coisa)

1. **Cautela com o GAUSS.** Carga mínima: uma requisição por vez, sessão reaproveitada, cadastro e cercas em cache, histórico só quando alguém pede, dia encerrado baixado uma vez. Nunca rodar duas coletas ao mesmo tempo (ex.: a versão antiga de `_arquivo` junto com esta).
2. **O coletor só roda a partir da `main`** (GitHub Actions). Não rode o `coletor/run.ts` no seu computador com as credenciais.
3. **A página é pública** (decisão de 01/10/2026): só lê e cria pedido de histórico. A chave secreta do Supabase fica só nos segredos do repositório.
4. **Visual igual ao SST:** cantos arredondados, camadas com sombra, sem títulos grandes, poucos botões, textos que se explicam. Cor nunca sozinha (sempre com rótulo). Mudança de cor vale para os dois sistemas (`src/app/globals.css`).
5. **Regras da frota:** motor secundário = placa + `2` (EOF5208 → EOF52082), vai junto do caminhão. **Sem RPM** (decisão do dono, 07/10/2026): motor ligado/desligado e motor 2º vêm só da **timeline de motor do GAUSS** (`timeline_motor_vaga`); do rastreador o site usa só o GPS (andando, parado, lugar). O RPM é apagado na entrada do site (`semRpm` em `src/lib/dominio/historico.ts`).
6. **Publicar só quando o dono pedir.** Antes: `npm run lint && npm run typecheck && npm test && npm run build` e `npm run e2e`.
7. Explique em português simples, com o que mudou, o que foi testado e o que falta.
8. **Só a frota da Mecanizada aparece, e quem manda é a matriz de equipamentos** (tela **Equipamentos**; tabela `frota_equipamento` no Supabase, criada por `supabase/equipamentos.sql` com as 42 da planilha "PLACAS VEICULOS.xlsx" de 05/10/2026). Não há mais lista no código: equipamento novo, devolvido ou em manutenção muda na tela, sem publicar. Status: **Ativo** e **Em manutenção** aparecem no sistema (manutenção com selo); **Desmobilizado** sai do mapa, da Timeline, do Dia da frota e dos alertas. Cada equipamento tem supervisor e regime (listas `frota_supervisor` e `frota_regime`). O coletor lê a matriz a cada ciclo; o site, na hora (Realtime). Aspiradores são reconhecidos pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"). Placas de grupos da frota que não estão na matriz ficam em `fora_da_lista` (só no banco; a tela não mostra).
9. **Editar a matriz não pede login** (decisão do dono, 05/10/2026): qualquer pessoa com o endereço do site cadastra e altera equipamentos, supervisores e regimes (`supabase/equipamentos-sem-login.sql`). Ninguém apaga: tirar um equipamento = status Desmobilizado. Cada mudança fica no histórico (data e o que mudou; sem login não há "quem").
10. **Produtividade** (regra do dono, 07 e 08/10/2026, em `src/lib/dominio/produtividade.ts`): Alta Pressão = **motor 2º ligado**; Alto Vácuo = **parado ligado**; exceção: o **DSY6472** (Alta Pressão) = parado ligado. **Hiper Vácuo, Brook e Aspiradores: sem regra** (o GAUSS não registra motor 2º do Hiper Vácuo). **Na base não conta:** o produtivo dentro do Pátio do Transporte e da Garagem aparece à parte como "motor ligado na base"; a **Baia de Resíduos conta** (é serviço). Onde estava: na Timeline, pelos trechos parados; no Dia da frota, pelas entradas e saídas de área (`loc_eventos`). A mesma regra vale no `automation/historico/classificar.js` (lá também os pontos sem cerca de pernoite contam como base). Aparece no Dia da frota e no funil da Timeline.
11. **Timeline de motor e tablet a cada 10 min pelo coletor** (`coletor/motor-vaga.ts`): uma vaga por requisição, só as vagas da frota, vaga desligada sem mudança é pulada por até 1 h, tablet = 1 requisição, lista de vagas do GAUSS (inclui Brook e Aspiradores) lida 1 vez por dia. **A extração do PC (`automation/`) não deve rodar junto** (o GAUSS seria consultado em dobro).
12. **Mapa de análise** (`/analise`, decisão do dono, 08/10/2026): painel no formato de apuração — medida e período em cima (filtros numa linha que empurra a tela, **nada cobre o mapa**), resumo à esquerda (totais, dia a dia, por tipo), **o mapa da região** no meio (todas as plantas a até 50 km da "PLANTA USIMINAS": Poço Redondo, Aterro Controlado, oficinas de fora, pneus, Harsco...; sem imagem de satélite; abre na Usiminas, com "Ir para" cada planta e os nomes das principais áreas escritos no mapa) e as áreas à direita (clicar troca a coluna pelo detalhe). O resumo e a lista **recolhem** (a tela lembra). O **Pátio do Transporte Rodoviário (a base) fica fora** de tudo; o que fica a mais de 50 km vira uma linha "Longe da região". Cada área pintada pela medida (produtivo, parado ligado sem produzir, tempo parado, visitas, tipo de local, apontamento), filtros (período, tipo, supervisor, regime, hora, dia da semana), ranking e "quem atende". Lê a tabela `analise_paradas` (`supabase/analise.sql`): **só fatos** (uma linha por parada), **no máximo 30 dias** (limpeza diária pelo pg_cron); as regras ficam em `src/lib/dominio/analise.ts`. Hoje é alimentada pelo PC (`automation/Enviar Historico ao Site.bat`, sem consultar o GAUSS). **Próximo passo:** o coletor baixar toda madrugada as rotas de ontem e guardar as cruas no R2 (bucket novo), gravando o resumo na mesma tabela.
13. **Exceções do dia** (aba padrão de Alertas, decisão do dono, 08/10/2026; questionário "Rastreamento Inteligente da Frota"): só o que fugiu das regras — saída tarde e chegada cedo ao Pátio pelos horários de cada regime (ADM, 16 horas, 24 horas/4X4), ida ao Pátio no meio do expediente, Oficina da Servitec, Oficina Centro, Auto/Hiper Vácuo na bica, restaurante acima de 1 h, ociosidade de 30 min e motor desligado 1 h. Horários, cercas e limites ficam **só** em `src/lib/dominio/regras-frota.ts`; o cálculo (`excecoes.ts`, com testes) usa eventos de área, timeline de motor e tablet da véspera e do dia (só Supabase). Regime: matriz → nome da vaga ("24 HS"/"16 HS") → ADM presumido (marcado na tela). Fase 2: médias (bica, almoço, Poço Redondo, Aterro), ciclos, velocidade e rotas.
14. **Puxador em tempo real (híbrido)** (decisão do dono, 08/10/2026; `coletor/tempo-real.ts`): **de dia, nenhuma requisição a mais** — o coletor guarda a posição da frota que já lê a cada ciclo (`loc_posicoes`, só hoje e ontem) e a cada 10 min regrava as paradas de hoje em `analise_paradas` (`fonte = ao_vivo`); a Análise relê a cada 10 min. **De madrugada (02:30–06:00)**, até 6 equipamentos por ciclo (~45 requisições no total, uma por vez): rota completa de ontem → paradas exatas (`fonte = rota`, substituem as ao vivo), excessos de velocidade acima de 30 km/h dentro da PLANTA USIMINAS (`analise_excessos`, regra 10 da Exceções do dia) e a rota crua no **R2** (`coletor/r2.ts`, só com os segredos `R2_*`; sem eles, pula). Regras puras em `src/lib/dominio/paradas.ts` (sem pacotes externos: o coletor instala só supabase-js, tsx e aws4fetch). Precisa do `supabase/tempo-real.sql`.

## Como funciona

```
Supabase (pg_cron a cada 5 min e a cada pedido de histórico)
   └─ dispara ─▶ GitHub Actions: coletor/run.ts consulta o GAUSS ─▶ grava no Supabase (loc_*)
                                                                     │
                     site (GitHub Pages) lê do Supabase ◀────────────┘  e atualiza sozinho (Realtime)
```

## Como rodar

```bash
npm install
cp .env.example .env.local     # valores públicos
npm run dev                    # http://localhost:3000
npm run lint && npm run typecheck && npm test && npm run build
npm run e2e                    # testes de navegador (dados sintéticos, nada é gravado)
```

**Publicar:** merge na `main` → o workflow `pages.yml` gera e publica `out/` (Settings → Pages → Source: **GitHub Actions**).

## Arquitetura

| Caminho | O que é |
|---|---|
| `src/app/page.tsx` + `_localizacao/` | Localização. No computador: mapa inteiro; no topo, os tipos (o clique filtra e abre a lista num balão), os contadores, as Áreas e o sino de Alertas; cartão do equipamento no canto. No celular: a gaveta |
| `src/app/frota/` | Dia da frota: uma faixa por equipamento no dia com o status de motor da timeline do GAUSS e o tempo produtivo de cada um, por tipo |
| `src/app/analise/` | Mapa de análise: áreas pintadas pela medida, filtros, ranking e painel "quem atende" (`analise_paradas`, 30 dias) |
| `src/app/timeline/` | Timeline (`?v=<id ou placa>&dia=AAAA-MM-DD`), igual no computador e no celular: mapa na tela toda; em cima, o cartão do horário (placa · hora · status · lugar) e o funil (veículo, dia, velocidade, resumo do dia, apontamento com CSV, camada do mapa e cores); embaixo, só a linha fina do dia com as cores do motor e ◀ ▶ ▶ (decisão do dono, 05/10/2026: sem painel de trilhas) |
| `src/app/alertas/` | Alertas por tipo e hora, detalhe em gaveta (`?placa=`) |
| `src/components/` | Barra "Campo", busca Ctrl K, gaveta, folha do celular, mapa (`mapa/`), histórico (`historico/`), balão (`trilhas/`) |
| `src/lib/tipos.ts` | Formatos dos dados (site **e** coletor) |
| `src/lib/dominio/` | Regras puras com testes: frota própria pela matriz (`equipamentos.ts`, `frota-propria.ts`, `matriz.ts`; dados de teste em `matriz-exemplo.ts`), capítulos do dia, Dia da frota, categoria/frescor, eventos, motor 2º, geometria, apontamento, leitura do GAUSS |
| `src/lib/dados/` | Leituras do Supabase validadas (zod), retrato ao vivo, pedido de histórico |
| `coletor/` | Coletor em TypeScript (`tsx`), usa `src/lib/dominio` |
| `supabase/` | `schema.sql` (tabelas, RLS, Realtime) e `disparo.sql` (pg_cron + token no Vault) |
| `e2e/` | Playwright (computador e celular, só leitura) |

## Configuração (uma vez)

1. **Banco:** `supabase/schema.sql`, depois `supabase/equipamentos.sql` e `supabase/equipamentos-sem-login.sql` no SQL Editor do PRODUTIVIDADE (o coletor não roda sem a matriz). Para a tela Análise: `supabase/analise.sql` e depois `supabase/tempo-real.sql`.
2. **Segredos do repositório:** `GAUSSFLEET_USERNAME`, `GAUSSFLEET_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`. Opcionais (rota crua no R2): `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` — no bucket, uma regra de ciclo de vida apagando objetos com mais de 30 dias.
3. **Pages:** Settings → Pages → Source: **GitHub Actions**.
4. **Disparo:** token fine-grained (só este repositório, Actions: Read and write) e `supabase/disparo.sql` no SQL Editor com o token na linha 12, **sem salvar o token no arquivo**.

## Cuidados

- O token do GitHub no Vault do Supabase **vence**: nesse dia o mapa para de atualizar — gere outro e rode `supabase/disparo.sql` de novo.
- O disparo não é pontual: atrasos de alguns minutos são normais. O indicador da barra fica amarelo depois de 3 ciclos sem leitura.
- `coletor/paridade.test.ts` compara o coletor com amostras do coletor antigo em JS (`coletor/__amostras__/`, fora do git por ter dados reais). O script que as gerou está no histórico do git (`coletor/scripts/gravar-amostras.mjs`).
- O Dia da frota parte da "abertura do dia" que o coletor grava no 1º ciclo após a meia-noite. Dia sem abertura usa o primeiro status; sem nenhum evento, a faixa fica "sem registro" (nunca é inventada).

## Pendências e estado atual (04/10/2026)

| # | Pendência | Onde / como |
|---|---|---|
| 1 | Publicar a etapa "história e frota": merge da branch `historia-e-frota` na `main` (publica o site e o coletor novo) | Quando o dono pedir |
| 2 | Definir a regra de "trabalhando" (parado ligado em área de serviço? bomba ligada?) | `classeTempo()` em `src/lib/dominio/capitulos.ts` |
