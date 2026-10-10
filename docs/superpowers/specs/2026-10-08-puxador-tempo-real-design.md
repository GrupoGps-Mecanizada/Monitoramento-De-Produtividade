# Puxador em tempo real (híbrido) — desenho (08/10/2026)

## Objetivo

Alimentar a Análise e a fase 2 do rastreamento inteligente **sem o PC**, em tempo real, com a carga mínima no
GAUSS (decisão do dono: "híbrido").

- **De dia, tempo real, zero consulta a mais:** o coletor já lê a posição da frota inteira numa requisição a cada
  ~5 min. Essas posições passam a ser guardadas, e as **paradas de hoje** são recalculadas a cada 10 min.
- **De madrugada, exato:** depois que o dia fecha, baixa a rota completa de ontem de cada equipamento (~45
  consultas, uma por vez, poucas por ciclo), recalcula as paradas exatas (substituem as aproximadas), registra os
  **excessos de velocidade** e guarda a rota crua no **R2** (opcional, 30 dias).

## Banco (`supabase/tempo-real.sql`, o dono roda no SQL Editor)

- `analise_paradas` ganha `fonte text` (`ao_vivo` | `rota`, padrão `rota`).
- `loc_posicoes` (`veiculo_id`, `t` timestamptz, `dia`, `lat`, `lng`; chave `veiculo_id, t`): uma linha por
  equipamento da frota por ciclo (~12 mil/dia). Só o coletor lê e grava (sem leitura pública). Limpeza: guarda
  hoje e ontem.
- `analise_excessos` (`dia`, `veiculo_id`, `ini`, `fim` em segundos do dia, `vel_max`, `lat`, `lng`; única em
  `dia, veiculo_id, ini`): leitura pública. Limpeza de 30 dias junto com a de `analise_paradas`.

## Regras (puras, testadas, em `src/lib/dominio/paradas.ts`)

- **Paradas da rota** (madrugada): a mesma regra do `classificar.js` — abaixo de 5 km/h por 3 min ou mais;
  buraco de mais de 10 min sem ponto corta a parada; posição = mediana.
- **Paradas das posições** (tempo real): leituras seguidas a menos de 80 m da 1ª leitura da parada; vale com 2
  leituras ou mais (≥ ~5 min). Início = 1ª leitura, fim = última leitura no lugar.
- **Enriquecer**: cerca = a menor que contém o ponto; minutos de cada status do motor (timeline do GAUSS, sem
  sobreposição); apontamentos do tablet que cobrem a parada.
- **Excessos de velocidade** (madrugada): pontos seguidos acima de 30 km/h **dentro da PLANTA USIMINAS** viram um
  excesso (início, fim, velocidade máxima, posição do pico).

## Coletor

- **Cada ciclo:** grava as posições da frota em `loc_posicoes` (motor 2º não entra).
- **A cada 10 min:** paradas de hoje de toda a frota → apaga as `ao_vivo` de hoje e grava as novas.
- **Madrugada (02:30–06:00, depois que o dia fecha):** até 6 equipamentos por ciclo; para cada um: rota de ontem →
  paradas exatas (`fonte = rota`, substituem as do veículo no dia) → excessos → R2 (se configurado). Progresso em
  `loc_kv` ("noturno"); equipamento que falhar tenta no ciclo seguinte.
- Falha nessas partes nunca derruba o ciclo (posições, eventos e pedidos de histórico seguem).
- **R2:** `coletor/r2.ts`, liga só com os segredos `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`,
  `R2_BUCKET`; grava `rotas/AAAA-MM-DD/<veiculo>.json.gz`. A regra de apagar após 30 dias é do próprio bucket
  (configurada pelo dono no Cloudflare). Assinatura com `aws4fetch` (dependência pequena do coletor).

## Site

- **Análise:** nada muda na tela; hoje passa a aparecer e se atualiza (relê a cada 10 min quando o período inclui
  hoje).
- **Exceções do dia:** regra 10, **"Velocidade acima de 30 km/h"** (alerta), lida de `analise_excessos` — aparece
  a partir do dia seguinte (precisa da rota completa).

## Carga no GAUSS

De dia: nenhuma requisição a mais. De madrugada: ~45 a 60 (uma por equipamento, mais páginas em dias longos),
espalhadas em ~8 ciclos.

## Testes

Unidade: paradas da rota (paridade com o `classificar.js`), paradas das posições, enriquecer, excessos (dentro e
fora da usina), escolha dos equipamentos da madrugada (janela, dia fechado, progresso), R2 desligado sem segredos.
e2e: regra 10 na Exceções com dados sintéticos. O coletor não roda no PC (regra do dono): a validação real é no
Actions depois de publicar.
