# Alertas da frota no WhatsApp — desenho

Data: 15/10/2026 · Pedido P-026 · Aprovado na conversa pelo dono em 15/10/2026.
Pesquisas: cofre `6 - Pesquisas da Web/2026-10-15 Boas práticas de alertas da frota.md` e `2026-10-15 Servidor para o WhatsApp dos alertas.md`.

## 1. Objetivo

Transformar as **Exceções do dia** (hoje só aparecem na tela) em **alertas guardados, sem duplicado, geridos numa tela e avisados no WhatsApp**, mais a **estrutura do resumo diário** (o conteúdo final do relatório o dono define depois).

Sucesso = um supervisor recebe **uma** mensagem por problema real, no máximo um lembrete a cada 2 h, nada de alerta velho ou repetido, e o gestor vê e trata tudo na tela.

## 2. O que o dono pediu e o que é suposição

| Pedido do dono | Suposição deste desenho (corrigir se errado) |
|---|---|
| Saída tarde e retorno cedo ao Pátio | Usa os horários de `regras-frota.ts` (ADM, 16 h, 24 h/4X4) e a tolerância de 5 min já existentes |
| Equipamento desligado há mais de 1 h | Mesma regra 9 das Exceções (fora do Pátio e oficinas, no expediente). **Sem sinal não é desligado:** se o rastreador perdeu o sinal no período, o alerta vira "Sem sinal" |
| Sem apontamento | **Não vira regra nova** (decisão do dono, 15/10/2026: usar só o que as Exceções já calculam). O apontamento entra como **justificativa** no filtro inteligente (seção 7A) |
| Gestão extremamente inteligente do que vai para o WhatsApp | Filtro inteligente com nota 0–100 (seção 7A), aprovado em 15/10/2026 |
| Área de gestão, sem duplicado, excelência | Seções 6, 7 e 9 |
| Rodar local até ter servidor | Só o **envio** roda no PC; detecção, banco e tela ficam na nuvem (seção 4) |

## 3. Fora do escopo agora

- Conteúdo final do resumo diário (fica um modelo simples e editável).
- WhatsApp oficial da Meta (pago). Fica para quando vender.
- Regras novas: nenhuma. Todas as regras das Exceções (`REGRAS` em `excecoes.ts`) entram no banco; quem decide se vão ao WhatsApp é o filtro (7A). Começam ligadas para WhatsApp só saída tarde, chegada cedo e desligado; as outras começam em "só resumo".
- Aprendizado automático (máquina decidindo sozinha): fora. O sistema **sugere** mudanças; quem muda é o gestor.

## 4. Como as peças se encaixam

```
GAUSS ─▶ coletor (GitHub Actions, a cada 5/10 min, já existe)
            └─ NOVO: detector de alertas ─▶ Supabase: alertas + alerta_envios (fila)
                                                     ▲            │
                       site /alertas (gestão) ───────┘            ▼
                                              enviador (PC hoje, servidor depois)
                                                     └─▶ Evolution API (local) ─▶ WhatsApp
```

- **Detector** (nuvem): roda dentro do coletor, logo depois de `coletarMotor` (timeline de motor + tablet a cada 10 min). Chama a mesma `excecoesDoDia` da tela (uma regra só, sem cópia) e grava no banco.
- **Enviador** (PC): programa pequeno em `enviador/` (TypeScript + tsx, como o coletor). Lê a fila, monta a mensagem e chama a Evolution API. Iniciado por um `.bat` e pelo Agendador de Tarefas do Windows ao ligar o PC.
- **Mudança para servidor depois:** copiar a pasta `enviador/` e a Evolution para o servidor. Nada muda no banco nem no site.

## 5. Banco (Supabase PRODUTIVIDADE) — `supabase/alertas.sql`

| Tabela | Para quê | Campos principais |
|---|---|---|
| `alerta_regra` | Configuração de cada regra | `regra` (pk: os valores de `REGRAS`), `ativa`, `peso` (0–60, gravidade base), `faixas` (jsonb: lista `{acima_min, pontos}`), `justificativas` (jsonb: família de apontamento → pontos a tirar), `espera_min` (padrão 10), `lembrete_min` (padrão 120), `escalar_min` (null = não escala) |
| `alerta_politica` | Linha única com os cortes do filtro | `corte_whatsapp` (padrão 60), `corte_resumo` (padrão 30), `corte_coordenador` (padrão 85), `max_por_hora` (padrão 6 por pessoa), `modo_teste` (padrão **true**: tudo vai só para o destino marcado como teste), `resumo_hora` (padrão 07:00) |
| `alerta_destino` | Quem recebe | `nome`, `telefone` ou `grupo_id`, `tipo` (grupo / supervisor / coordenador), `supervisor_id` (liga à `frota_supervisor`), `regras` (lista; vazio = todas), `nao_perturbe_ini/fim`, `resumo_diario`, `ativo` |
| `alerta_silencio` | Silenciar equipamento ou regra | `veiculo_id` ou `regra`, `motivo`, `ate` (data de volta), `criado_em` |
| `alertas` | Um registro por ocorrência | `chave` **unique** (`regra|veiculo|dia|turno`), `regra`, `veiculo_id`, `placa`, `vaga`, `supervisor_id`, `dia`, `ini`, `fim`, `local`, `detalhe`, `situacao` (aberto / visto / resolvido / silenciado), `nota` (0–100), `motivos` (jsonb: de onde veio cada ponto), `destino` (whatsapp / resumo / tela), `avaliacao` (null / problema / nao_era_problema), `contagem`, `visto_por`, `visto_em`, `resolvido_em`, `ultimo_aviso_em` |
| `alerta_envios` | Fila do WhatsApp | `id`, `destino_id`, `tipo` (alerta / lembrete / escala / resumo), `alertas` (ids), `texto`, `status` (pendente / enviado / descartado / erro), `tentativas`, `erro`, `criado_em`, `enviado_em` |

Regras do banco:
- **Sem duplicado garantido pelo banco:** `alertas.chave` é única; o detector faz `upsert ... on conflict (chave)`, que só atualiza `fim`, `detalhe` e `contagem`. Rodar o detector 2 vezes não cria nada novo.
- **Supervisor pela vaga do dia** (view `vaga_do_dia`), nunca pela placa (regra do dono).
- Limpeza: `alertas` e `alerta_envios` com mais de **90 dias** saem na `limpezaDiaria` do coletor.
- **Segurança:** telefones são dado pessoal. `alerta_destino` **não é lida pela chave pública**; só por usuário logado e pelo enviador (chave de serviço, guardada só no PC/servidor). As demais tabelas: leitura pública (como o resto do site), escrita só logado ou serviço.

## 6. Ciclo de vida de um alerta

```
(problema detectado e durou ≥ espera_min)  ─▶ ABERTO ─▶ aviso no WhatsApp
ABERTO ─(alguém clica "Visto" na tela)─▶ VISTO (para lembretes e escala)
ABERTO/VISTO ─(o problema acabou: fim preenchido)─▶ RESOLVIDO (automático)
qualquer ─(silêncio do equipamento ou regra)─▶ SILENCIADO (continua na tela)
```

- **Resolvido não reabre.** O mesmo problema mais tarde (outro turno) tem outra chave = alerta novo.
- **Espera antes de avisar** (`espera_min`, padrão 10 min): evita alarme falso de um ciclo só.
- **Lembrete:** alerta ainda aberto e não visto recebe 1 lembrete a cada `lembrete_min` (padrão 2 h).
- **Escala:** se `escalar_min` estiver definido e ninguém marcou "Visto", vai também para o coordenador.
- Saída tarde e chegada cedo são instantes (não "duram"): nascem e se resolvem no mesmo momento; avisam uma vez.

## 7A. Filtro inteligente — quem decide o que vai para o WhatsApp

Cada alerta recebe uma **nota de 0 a 100**, calculada por uma função pura `notaDoAlerta()` (com testes), e a nota decide o destino:

| Nota | Destino |
|---|---|
| ≥ `corte_whatsapp` (60) | WhatsApp na hora para o supervisor da vaga; ≥ `corte_coordenador` (85) também para o coordenador |
| ≥ `corte_resumo` (30) | Só no resumo diário |
| abaixo | Só na tela |

**Composição da nota** (cada parte fica gravada em `motivos`, e a tela mostra "por que essa nota"):
1. **Peso da regra** (`alerta_regra.peso`): gravidade base. Padrões: desligado 40, saída tarde 35, chegada cedo 35, ida ao Pátio 30, restaurante 25, ociosidade 25, bica 20, velocidade 30, oficinas 0 ("atenção").
2. **Tamanho do problema** (`faixas`): pontos pelo quanto passou do limite. Ex. saída tarde: +0 até 15 min, +30 de 15 a 30 min, +55 acima de 30 min. Desligado: +25 até 2 h, +45 até 3 h, +60 acima.
3. **Repetição:** mesma regra na mesma **vaga** nos últimos 7 dias: +10 na 2ª vez, +20 da 3ª em diante.
4. **Justificativa no tablet:** havendo apontamento no período, tira os pontos da família (`justificativas`). Padrões: Manutenção e clima −40, Preparação e bloqueio −30, Aguardando −25, Pausas e pessoas −25, Logística −15. Usa `familias.ts` (já existe).
5. **Sem sinal:** rastreador sem sinal em mais da metade do período: −40 e o texto do alerta diz "sem sinal".
6. **Regime presumido** (ADM sem pista na matriz): −10.

Limites: a nota fica entre 0 e 100. A nota é **recalculada a cada ciclo** enquanto o alerta está aberto (o desligado que cresce de 1 h para 3 h pode subir de "resumo" para "WhatsApp"); o WhatsApp sai **uma vez** quando cruza o corte, nunca de novo pela mesma chave (só lembrete, seção 6).

**Ferramentas de ajuste na tela:**
- **Simulador:** ao mudar pesos, faixas ou cortes, a tela recalcula os alertas dos últimos 7 dias com a nova configuração e mostra "teriam saído X mensagens (hoje: Y)", por regra e por supervisor, **antes de salvar**. Roda no navegador com as mesmas funções puras.
- **Botão "Não era problema" / "Era problema"** em cada alerta (grava `avaliacao`).
- **Sugestões:** com 10 ou mais avaliações de uma regra em 30 dias, se 60% ou mais foram "não era problema", a tela sugere "mandar só no resumo" ou "subir a faixa". O gestor aceita ou ignora; nada muda sozinho.
- **Modo teste** (ligado no começo): tudo o que iria para o WhatsApp vai só para o destino marcado como teste (o dono), com o nome de quem receberia.

## 7. Montagem e envio das mensagens

1. A cada ciclo, o detector cria, para cada destinatário, **uma** linha na fila com **todos** os alertas novos dele com destino WhatsApp (agrupados), respeitando silêncios, regras escolhidas pelo destinatário e `max_por_hora` (o excedente vai junto na próxima mensagem).
2. **Não perturbe:** linha criada dentro do horário de não perturbe só é enviada no fim dele.
3. **PC desligado:** quando o enviador volta, ele **descarta** (status `descartado`) mensagens de alertas que já foram resolvidos e **junta** o restante numa mensagem só por destinatário. Resumo diário sempre sai.
4. **Cuidados com o número (não oficial):** número exclusivo; pausa aleatória de 3 a 8 s entre envios; no máximo 30 mensagens por hora (o resto espera); texto com variação natural; 3 tentativas com erro registrado.
5. Modelo da mensagem (exemplo):

```
🚨 Alertas da frota · 15/10 08:12
Supervisor: Fulano

• AP-02 · ABC1D23 — Saída tarde do Pátio
  saiu 08:05 · limite 07:20
• AV-05 · XYZ9K87 — Motor desligado 1 h 10 min
  Área: ALTO-FORNO 3 · desde 06:58

Ver na tela: <link /alertas>
```

## 8. Resumo diário (estrutura pronta)

- Gerado pelo detector no **primeiro ciclo após o horário configurado** (padrão 07:00), referente ao dia anterior, para quem tem `resumo_diario = true`. Chave única `resumo|dia|destino` (não duplica).
- Conteúdo inicial (ajustável depois): total por regra, as 5 placas com mais alertas e os alertas ainda abertos. O texto sai de uma função pura `montarResumo()` com testes, para trocar o conteúdo sem mexer no resto.

## 9. Tela de gestão — `/alertas` (aba nova "Gestão", além das Exceções do dia)

- **Fila:** alertas abertos e vistos, filtros por regra, supervisor, situação e dia; botões **Visto**, **Resolver** e **Silenciar** (motivo + data de volta).
- **Histórico:** 90 dias, com quando foi avisado e para quem.
- **Filtro inteligente:** pesos, faixas, justificativas, cortes, limite por hora, modo teste, com o **simulador** e as **sugestões** (seção 7A). Cada alerta mostra a nota e o "por quê".
- **Destinatários:** nome, telefone ou grupo, supervisor, regras, não perturbe, resumo diário.
- **Saúde do envio:** última vez que o enviador falou com o banco, mensagens pendentes e com erro. Se o enviador sumiu há mais de 30 min, a tela avisa ("PC/servidor do WhatsApp desligado").
- **Login:** as abas Regras, Destinatários e as ações pedem login (Supabase Auth, e-mail e senha, plano grátis). Ver alertas continua sem login, como o resto do site.

## 10. Erros e casos difíceis

- Coletor falhou num ciclo: o próximo recalcula o dia todo; a chave única impede duplicar.
- Sem sinal no período: alerta "Sem sinal" no lugar de "desligado" (evento `sinal_perdido` de `loc_eventos`).
- Equipamento Desmobilizado ou Em manutenção: não gera alerta.
- Regime presumido (ADM sem pista na matriz): alerta sai marcado "(regime presumido)".
- Evolution fora do ar ou número desconectado: envio fica em erro, a tela mostra em "Saúde do envio".

## 11. Testes

- Funções puras com Vitest (padrão do repositório): chave do alerta, espera, `notaDoAlerta` (cada parte: peso, faixa, repetição, justificativa, sem sinal, presumido, limites 0–100), destino pelos cortes, simulador, sugestões, sem sinal × desligado, agrupamento por destinatário, não perturbe, descarte de resolvidos, `montarResumo`.
- Detector: rodar 2 vezes com os mesmos dados = mesma quantidade de alertas (teste de não duplicar).
- Enviador: modo `--teste` que só imprime as mensagens, sem enviar.
- Ponta a ponta manual: um alerta de teste chegando num grupo de teste antes de ligar os grupos reais.

## 12. Ordem de entrega

1. Banco (`alertas.sql`) + filtro (`notaDoAlerta`) + detector gravando alertas com nota (sem WhatsApp) — dá para conferir na tela.
2. Tela de gestão (fila, histórico, filtro com simulador e sugestões, destinatários, login).
3. Enviador local + Evolution + grupo de teste.
4. Resumo diário.
5. Ligar para os supervisores.
