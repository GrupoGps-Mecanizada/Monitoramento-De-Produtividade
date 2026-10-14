# Cronoanálise × telemetria (etapa 3 da Análise)

Data: 14/10/2026 · Aprovado pelo dono no chat: **página nova** "Cronoanálise" e **com os nomes** dos colaboradores.
Ramo: `cronoanalise` (sobre `analise-visual`).

## Por quê
O dono quer ver, de forma inteligente, o que a cronoanálise (folhas preenchidas na área, sistema Cronoanálise) diz
ao lado do que o GAUSS registra (motor ligado, parado ligado, desligado, motor secundário) e do que foi apontado no
tablet, e os apontamentos de cada colaborador.

## Fontes (todas no Supabase PRODUTIVIDADE; só leitura)
| Tabela | O que é | Chave de ligação |
|---|---|---|
| `crono_registros` | uma linha por atividade de uma pessoa (hi, hf, código, classificação) | data + turno + placa |
| `timeline_motor_vaga` | status de motor do GAUSS | código do veículo (vem do retrato pela placa) |
| `demoras_categorizadas` | apontamentos do tablet | placa (com ou sem hífen) |

- Turno de noite (horário 19h/18:40): hora antes de 12:00 é do dia seguinte. Janela padrão 06:40–18:40 / 18:40–06:40,
  esticada se a folha tiver hora fora dela.
- Produtivo do GAUSS: regra do tipo (`produtividade.ts`): Alta Pressão = motor 2º; Alto Vácuo = parado ligado.

## Tela `/cronoanalise`
1. **Escolha do turno**: dia · dia/noite · letra · supervisor · vaga (placa). Padrão: o mais recente.
2. **Raio-x do turno**: linhas do tempo alinhadas: Motor (cores do GAUSS), Tablet, uma linha por colaborador
   (Produzindo, Improdutivo necessário, Improdutivo, Sem código).
3. **Conferência**: % de concordância (equipe produzindo × motor produtivo, minuto a minuto), horas de cada fonte e
   frases automáticas onde não bate: produzindo na folha com motor parado; bomba ligada sem ninguém produzindo;
   apontamento do tablet diferente da folha.
4. **Colaboradores**: horas por classificação e principais atividades de cada pessoa do turno, e o ranking das
   atividades de todos os turnos lançados.

Regras puras em `src/lib/dominio/cronoanalise.ts` (com testes); leitura em `src/lib/dados/cronoanalise.ts`.

## Fora deste trabalho
- Login (o site é público; os nomes aparecem por decisão do dono).
- Comparar por letra/supervisor ao longo de semanas (quando houver mais folhas lançadas).
