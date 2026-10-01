# Monitoramento de Localização — GrupoGPS · Usiminas

Mapa ao vivo da frota (ALTA PRESSÃO / AUTO VÁCUO / HIPER VÁCUO / aspiradores), histórico de trajeto com reprodução (play) e apontamento por veículo, e alertas de entrada/saída de área, status e sinal. Os dados vêm da tela "Localização" do GAUSS FLEET.

## Como funciona

```
GitHub Actions (a cada ~5 min)            Supabase PRODUTIVIDADE            GitHub Pages (esta página)
coletor/run.js  ── consulta o GAUSS        loc_kv (retrato, cercas)   ◀── lê (chave publishable)
                ── grava ──────────────▶   loc_eventos                      atualiza sozinha (Realtime)
                ◀─ atende pedidos ──────   loc_pedidos   ◀── "Ver histórico" pede
                ── grava ──────────────▶   loc_historico (cache da rota + apontamento)
```

- **Página** (`index.html`, `timeline.html`, `alertas.html`): estática, só lê do Supabase. `api-supabase.js` atende as chamadas `/api/...` que as páginas faziam ao servidor local.
- **Coletor** (`coletor/`): roda no GitHub Actions (`.github/workflows/coletor.yml`). Uma requisição traz a posição da frota inteira; cadastro e cercas ficam em cache; histórico só é buscado quando alguém pede e dia encerrado é baixado uma única vez.
- **Banco**: `supabase/schema.sql` (tabelas `loc_*`, RLS e Realtime). A página pode ler e criar pedido de histórico; só o coletor (chave secreta) escreve.

## Configuração (uma vez)

1. **Banco:** cole `supabase/schema.sql` no SQL Editor do projeto PRODUTIVIDADE e rode.
2. **Segredos do repositório** (Settings → Secrets and variables → Actions → New repository secret):
   - `GAUSSFLEET_USERNAME`, `GAUSSFLEET_PASSWORD` — login do GAUSS
   - `SUPABASE_URL` — `https://mfsyrsegkvjmefcdaegh.supabase.co`
   - `SUPABASE_SECRET_KEY` — chave secreta do Supabase (nunca colocar no código)
3. **Pages:** Settings → Pages → Deploy from a branch → `main` / `(root)`.
4. **Primeira coleta:** Actions → "Coletor de localização" → Run workflow.

## Regras da frota

- Placas têm 7 caracteres. O **motor secundário** de um caminhão aparece no GAUSS como outro veículo com a mesma placa + `2` (EOF5208 → EOF52082). Ele não conta como caminhão: vai junto do principal (`coletor/frota.js`).
- RPM que não muda o dia inteiro é sensor travado: o apontamento não afirma motor ligado/desligado nesse caso.

## Cuidados

- O GitHub desativa workflows agendados de repositórios públicos sem atividade por 60 dias — se o mapa parar de atualizar, confira em Actions se o workflow está ativo.
- O cron do GitHub não é pontual: atrasos de alguns minutos são normais. A página avisa quando a última leitura passa de 15 min.
