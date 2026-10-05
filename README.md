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
5. **Regras da frota:** motor secundário = placa + `2` (EOF5208 → EOF52082), vai junto do caminhão; RPM que não muda o dia inteiro é sensor travado (não afirma ligado/desligado).
6. **Publicar só quando o dono pedir.** Antes: `npm run lint && npm run typecheck && npm test && npm run build` e `npm run e2e`.
7. Explique em português simples, com o que mudou, o que foi testado e o que falta.
8. **Só a frota da Mecanizada aparece** (`src/lib/dominio/equipamentos.ts`, planilha "LOCAÇÃO - GPS": 41 equipamentos e o Ultravac OWU-1596). Equipamento novo ou devolvido: edite a lista e publique. Aspiradores são reconhecidos pelo número da vaga ("ASPIRADOR INDUSTRIAL - GPS - 05"). Placas de grupos da frota que não estão na lista ficam em `loc_kv` → `snapshot` → `fora_da_lista`.
9. **"Trabalhando" ainda não está definido.** As telas falam só em ligado/desligado/parado ligado; quando a regra for decidida, ela entra em `classeTempo()` (`src/lib/dominio/capitulos.ts`).

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
| `src/app/frota/` | Dia da frota: uma faixa por equipamento no dia, por tipo (só eventos já gravados, precisão ~5 min) |
| `src/app/timeline/` | Timeline (`?v=<id ou placa>&dia=AAAA-MM-DD`). No computador: veículo, dia e números no topo; embaixo do mapa, as trilhas Capítulos · Onde estava · Motor · Bomba sobre uma régua. A régua abre nas horas com registro e tem "Dia inteiro" e "Ampliar o foco"; passar o mouse mostra o balão; a alça muda a altura; capítulos, trechos, tempo por área e CSV ficam na gaveta "Apontamento". No celular: player no rodapé |
| `src/app/alertas/` | Alertas por tipo e hora, detalhe em gaveta (`?placa=`) |
| `src/components/` | Barra "Campo", busca Ctrl K, gaveta, folha do celular, mapa (`mapa/`), histórico (`historico/`), balão, régua e alça das trilhas (`trilhas/`) |
| `src/lib/tipos.ts` | Formatos dos dados (site **e** coletor) |
| `src/lib/dominio/` | Regras puras com testes: frota própria e tipos (`equipamentos.ts`, `frota-propria.ts`), capítulos do dia, Dia da frota, categoria/frescor, eventos, motor 2º, geometria, apontamento, leitura do GAUSS |
| `src/lib/dados/` | Leituras do Supabase validadas (zod), retrato ao vivo, pedido de histórico |
| `coletor/` | Coletor em TypeScript (`tsx`), usa `src/lib/dominio` |
| `supabase/` | `schema.sql` (tabelas, RLS, Realtime) e `disparo.sql` (pg_cron + token no Vault) |
| `e2e/` | Playwright (computador e celular, só leitura) |

## Configuração (uma vez)

1. **Banco:** `supabase/schema.sql` no SQL Editor do PRODUTIVIDADE.
2. **Segredos do repositório:** `GAUSSFLEET_USERNAME`, `GAUSSFLEET_PASSWORD`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`.
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
