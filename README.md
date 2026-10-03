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
| `src/app/page.tsx` + `_localizacao/` | Localização: painel (veículos, áreas, eventos), detalhe com histórico, gaveta no celular |
| `src/app/timeline/` | Timeline com player (`?v=<id ou placa>&dia=AAAA-MM-DD`) |
| `src/app/alertas/` | Alertas por tipo e hora, detalhe em gaveta (`?placa=`) |
| `src/components/` | Barra "Campo", busca Ctrl K, gaveta, folha do celular, mapa (`mapa/`), histórico (`historico/`) |
| `src/lib/tipos.ts` | Formatos dos dados (site **e** coletor) |
| `src/lib/dominio/` | Regras puras com testes: categoria/frescor, eventos, frota (motor 2º), geometria, apontamento, leitura do GAUSS |
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

## Pendências e estado atual (02/10/2026)

| # | Pendência | Onde / como |
|---|---|---|
| 1 | Publicar a repaginação: merge da branch `repaginacao-campo` e trocar a fonte do Pages para "GitHub Actions" | Quando o dono pedir |
