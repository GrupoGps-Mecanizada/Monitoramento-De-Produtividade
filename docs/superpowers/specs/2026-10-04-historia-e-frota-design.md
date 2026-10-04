# História do dia, Dia da frota e frota própria — desenho

> 04/10/2026 · branch `historia-e-frota` · base: `main` (repaginação "Campo" publicada em 03/10/2026)

## Objetivo

Hoje o sistema mostra dados demais e não conta o que aconteceu. A Timeline do EAM3257 em 01/10 vira 68 trechos: a barra colorida fica ilegível e o mapa fica cheio de bolinhas. Os quatro públicos (gestão, supervisor, fiscal/cliente e manutenção) precisam responder às suas perguntas em segundos:

- **Supervisor:** onde está cada equipamento e se está ligado agora → **Localização**.
- **Gestão:** como foi o dia da frota inteira → **Dia da frota** (tela nova).
- **Fiscal/cliente:** onde o equipamento esteve, a que horas e por quanto tempo → **Timeline** contando a história do dia, com o apontamento completo preservado.
- **Manutenção:** sem sinal e em manutenção → números no topo da Localização e as cores do Dia da frota.

**Sucesso =**
- Só os 42 equipamentos da frota, mais o Ultravac, aparecem, organizados em 6 tipos.
- O painel da Localização recolhe.
- A Timeline mostra faixa e capítulos (o dia de 68 trechos vira cerca de 20 capítulos).
- O Dia da frota mostra todos os equipamentos num olhar.
- Nenhuma requisição nova ao GAUSS.
- `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e` passam.

## Decisões (combinadas em 03 e 04/10/2026)

| Tema | Decisão |
|---|---|
| Frota | Só a lista do dono (14 AP, 11 AV, 3 HV, 3 Brook, 10 aspiradores) e o Ultravac OWU1596; o resto do GAUSS é ignorado |
| Onde filtrar | No coletor (retrato e eventos), e o site aplica a mesma regra para os dados antigos |
| Ultravac | Tipo próprio "Ultravac" (no GAUSS está em Hiper Vácuo) |
| Timeline | Opção "B avançada": faixa do dia com duas trilhas (onde estava / motor) e capítulos numerados ligados ao mapa e ao player |
| Dia da frota | Tela nova, montada só com os eventos já gravados (precisão de ~5 min); zero carga extra no GAUSS |
| Localização | Painel retrátil (barra fina com siglas), aba Tipos, detalhe com frase grande e 4 dados, agrupamento de marcadores |
| "Trabalhando" | **Regra adiada pelo dono.** Nada na tela afirma "trabalhou"; o código deixa um único ponto para a regra entrar depois |
| Lista da frota | Escrita no código (`src/lib/dominio/equipamentos.ts`); mudança = editar e publicar |

## Fora do escopo

- A regra de "trabalhando" ou "ocioso" (o dono vai definir).
- Baixar o trajeto completo dos 42 todo dia (opções B/C da pesquisa), porque gera carga no GAUSS.
- Editar a lista da frota pela tela ou pelo banco.
- Mudanças de cor da identidade "Campo".

## Referências que orientaram o desenho

- **Google Maps Linha do tempo, Arc Timeline, GeoPulse:** o dia como sequência de *permanências* (lugar e duração) e *deslocamentos*, com as paradas curtas absorvidas.
- **Geotab Trips History (julho/2026):** paradas com o mesmo número no mapa, na lista e na barra do player; retiraram do mapa linhas que "confundiam mais do que ajudavam".
- **Motive Vehicle History:** linha do tempo de paradas e viagens com totais do dia no topo.
- **Grafana state timeline:** uma faixa por item, colorida pelo estado, para ver muitos itens ao mesmo tempo.
- **Trackunit:** destacar os extremos que pedem ação, como parado ligado longo ou equipamento sem uso.

---

## Parte 1 — Frota própria e tipos de equipamento

### `src/lib/dominio/equipamentos.ts` (puro, com testes)

A lista, na ordem da planilha do dono:

| Tipo (`TipoEquip`) | Sigla | Rótulo | Equipamentos |
|---|---|---|---|
| `ap` | AP | Alta Pressão | CZC-0453, DSY-6472, DSY-6474, DSY-6475, EAM-3253, EAM-3255, EAM-3256, EAM-3262, EGC-2978, EGC-2983, EGC-2985, EGC-2989, EZS-8764, PUB-2F80 |
| `av` | AV | Alto Vácuo | ALY-5322, ANF-2676, CUB-0763, DSY-6473, DSY-6577, DYB-7210, EAM-3251, EAM-3257, EGC-2993, FSA-3D71, HJS-1097 |
| `hv` | HV | Hiper Vácuo | DSY-6471, EGC-1875, FHD-9264 |
| `uv` | UV | Ultravac | OWU-1596 |
| `pg` | PG | Poliguindaste (Brook) | DSY-6477, EGC-2984, EPN-2463 |
| `as` | AS | Aspiradores | Aspirador 01 … Aspirador 10 |

Identificação de um veículo do GAUSS (`identificarEquip(v: {placa, vaga})`), que devolve `{ tipo, nome, ordem } | null`:

1. **Placa:** compara `normPlaca` (já existe em `frota.ts`) e também a forma **Mercosul**. A conversão vale só para placa antiga de 7 caracteres (3 letras e 4 números): o 5º caractere troca de número para letra (0→A, 1→B … 9→J). Exemplo: DYB7210 ↔ DYB7C10. A comparação aceita qualquer uma das duas formas dos dois lados.
2. **Aspiradores:** pela **vaga**, com a expressão `/ASPIRADOR.*GPS\s*-\s*(\d{1,2})/i`; o número 1–10 vira "Aspirador NN". A placa do aspirador no GAUSS é ignorada (ASPII, ASP12-RESERVA… não são confiáveis).
3. **Motor secundário** (placa + `2`): pertence à frota se o caminhão principal pertence. A regra de pareamento atual (`parearMotores`) não muda.
4. Qualquer outro veículo → `null` (fora da frota).

Nome mostrado:
- Caminhões: a placa no formato da planilha (com hífen, ex.: `EGC-2985`).
- Aspiradores: "Aspirador 05".

A busca aceita qualquer uma das formas.

`TipoEquip`, `TIPOS_EQUIP` (sigla, rótulo e ordem) ficam em `tipos.ts` e `equipamentos.ts`. O nome "categoria" continua sendo o estado ligado/desligado (`categoria()` em `veiculo.ts`); o novo conceito se chama **tipo de equipamento** (`tipoEquip`) para não confundir.

### Coletor

- Depois do processamento atual (`processarLeitura`/`montarSnapshot`, que continuam iguais e com a paridade com o coletor antigo), um passo novo `filtrarFrota` mantém só os veículos com `identificarEquip(...) != null` e seus motores secundários.
- `Veiculo` ganha `equip: { tipo, nome }`, preenchido pelo coletor.
- Os eventos de veículos fora da frota não são gravados.
- `Retrato` ganha `fora_da_lista: string[]`: placas de veículos que **parecem** da frota (grupo do GAUSS contém ALTA PRESSÃO, VÁCUO, BROOK, ASPIRADOR ou ULTRAVAC) mas não estão na lista. Serve para o dono perceber um equipamento novo; não aparece na tela, e o README explica onde ver (`loc_kv.snapshot`).

### Site

- `lerRetrato` e `lerEventos` também aplicam `identificarEquip`. Os eventos antigos, gravados antes do filtro, aparecem certos; um retrato antigo, sem `equip`, também.

---

## Parte 2 — Timeline: faixa do dia e capítulos

### `src/lib/dominio/capitulos.ts` (puro, com testes)

Entrada: o `Historico` que já existe (trechos e pontos). Saída: `HistoriaDia`:

```ts
type TipoLugar = "base" | "servico" | "via";
interface Capitulo {
  n: number;              // 1..N, o mesmo número no mapa
  lugar: string;          // nome da área (ou "Fora de área")
  tipoLugar: TipoLugar;
  inicio: string; fim: string; duracao_min: number;
  ligado_min: number; desligado_min: number; outro_min: number;  // barrinha
  lat: number | null; lng: number | null;                        // pino do mapa
  ate: { km: number; min: number; destino: string; passou: string[] } | null; // linha "→ km até …"
}
interface HistoriaDia {
  capitulos: Capitulo[];
  faixaLugar: { inicio: string; fim: string; tipoLugar: TipoLugar; lugar: string }[];
  faixaMotor: { inicio: string; fim: string; estado: EstadoTrecho }[];
  destaques: { primeiraSaidaBase: string | null; ultimaVoltaBase: string | null; areasServico: number; maiorParadoLigado: { lugar: string; min: number } | null };
}
```

Regras:
- **Tipo de lugar** (`tipoLugar(nome)`):
  - `base`: o nome contém PÁTIO/PATIO, ESTACIONAMENTO, OFICINA ou GARAGEM.
  - `via`: o trecho é de movimento, ou o lugar é vazio, "Fora de cerca" ou uma via (`tipoCerca` = via).
  - `servico`: todo o resto.
- **Bloco:** trechos parados (não `movimento`) seguidos e com o **mesmo `local`** formam um bloco, mesmo que o motor ligue e desligue no meio.
- **Capítulo:** bloco com duração ≥ `MIN_CAPITULO = 15` minutos. Um bloco menor não vira capítulo: o nome dele entra em `passou` do deslocamento que liga os capítulos vizinhos.
- **Deslocamento entre capítulos** (`ate`): soma os km e os minutos de tudo o que fica entre o fim de um capítulo e o início do seguinte. O destino é o lugar do capítulo seguinte. O último capítulo tem `ate = null`.
- **Destaques:**
  - `primeiraSaidaBase`: fim do primeiro capítulo `base` que é seguido por um capítulo de outro lugar.
  - `ultimaVoltaBase`: início do último capítulo `base` que vem depois de um capítulo de outro lugar.
  - `areasServico`: quantos lugares `servico` distintos há entre os capítulos.
  - `maiorParadoLigado`: o capítulo com mais `parado_ligado` (só se ≥ 15 min).
  - Todos são frases neutras: nada de "trabalhou".
- **Ponto da regra "trabalhando":** a função `classeTempo(estado)` concentra a classificação usada na barrinha e nos destaques (hoje: ligado = `parado_ligado`; desligado = `desligado` ou `parado`; outro = `sem_sinal`). Quando o dono definir a regra, ela muda só ali.

### Tela (computador)

Painel da Timeline, de cima para baixo:
1. Placa, tipo (selo) e dia, com o seletor de veículo e dia como hoje.
2. Destaques em pílulas.
3. Totais (km, andando, parado ligado, desligado), como hoje.
4. **Faixa do dia (`FaixaDia`):** duas trilhas alinhadas de 0h a 24h.
   - "Onde estava": cor pelo `tipoLugar`, com o nome escrito no bloco quando cabe.
   - "Motor": as cores de estado de hoje.
   - O cursor do player desenha uma linha sobre as duas trilhas.
   - Clicar leva o player para aquele horário.
   - **Arrastar** escolhe um foco (início e fim); um "✕" limpa o foco.
5. Player, como hoje, com o botão novo "⏭ próximo capítulo".
6. **Capítulos (`ListaCapitulos`):**
   - Linha: número, lugar, horário, duração, barrinha e "→ km até …"/"passou por …".
   - O capítulo onde o player está fica destacado.
   - Clicar leva o player e o mapa para o capítulo.
   - Com foco ativo, só aparecem os capítulos dentro do foco.
7. **"Apontamento completo"**, recolhido: a lista de trechos, o tempo por área e o CSV de hoje (`ListaTrechos`, `TempoPorArea`, `csv.ts`), sem mudança.

Mapa da Timeline:
- O trajeto do dia, com o pedaço do foco forte e o resto apagado.
- **Só os pinos numerados dos capítulos** (cinza para `base`, azul para os demais).
- O caminhão na posição do player.
- Somem as bolinhas de cada parada e os rótulos "Início/Fim".

### Celular

A faixa do dia fica fixa embaixo do mapa (só a trilha "Motor" e os números dos capítulos), os capítulos ficam numa gaveta e o player continua como hoje.

---

## Parte 3 — Dia da frota (tela nova, `src/app/frota/`)

### `src/lib/dominio/dia-frota.ts` (puro, com testes)

Entrada: os eventos do dia (`Evento[]`), a frota (equipamentos com o retrato atual), o dia e `agora`. Saída: uma `LinhaFrota` por equipamento, agrupada por tipo:

```ts
type EstadoFaixa = "ligado" | "desligado" | "manut" | "sem_sinal" | "sem_registro";
interface LinhaFrota { id: string; nome: string; tipo: TipoEquip; vaga: string;
  faixas: { inicio: string; fim: string; estado: EstadoFaixa; area: string }[];
  ligado_min: number; agora: EstadoFaixa | null }
```

Regras:
- **Estado à meia-noite**, nesta ordem:
  1. O evento `abertura` do dia (novo, ver abaixo).
  2. O `de` do primeiro evento `status` do dia.
  3. Para hoje: o status do retrato atual.
  4. Senão: `sem_registro` (cinza claro). Nunca se inventa um estado.
- **Status para estado:**
  - "Ligado" → `ligado`.
  - "Desligado" e "Chave geral desligada" → `desligado`.
  - Texto com "manuten" → `manut`.
  - "Sem comunicação…" → `sem_sinal`.
  - Qualquer outro → `desligado`, com o texto original no passar do mouse.
- **Sinal:** entre `sinal_perdido` e `sinal_retomado`, a faixa é `sem_sinal`, por cima do status.
- **Área:** o lugar de cada pedaço vem das entradas e saídas (`entrada`/`saida`).
- **Fim do dia:**
  - Hoje: a última faixa termina em `agora`.
  - Dias passados: termina às 24h.
- `ligado_min` soma só as faixas `ligado`.

### Evento novo: `abertura` (coletor)

- No primeiro ciclo do coletor em um novo dia (comparando com `loc_kv.estado`, que já guarda o último ciclo), grava um evento `{ tipo: "abertura", id, placa, vaga, status, area }` para cada equipamento da frota. Os dados vêm da leitura que o ciclo já fez: **nenhuma requisição a mais ao GAUSS**.
- `TipoEvento` e o esquema zod ganham `abertura`. Não há migração: `loc_eventos.dados` é JSON.
- A tela de Alertas **ignora** `abertura`: não é alerta.

### Tela

- **Cabeçalho:** o dia, os botões Ontem / Hoje / 📅 e a ordenação (por tipo, por mais tempo ligado, por menos tempo ligado). A legenda inclui "precisão de ~5 min" e "ligado = status do GAUSS (inclui andando)".
- **Por tipo:** um cabeçalho com nome, total, ligados/desligados/sem sinal agora e as horas ligado no dia.
- **Linha:** nome (e vaga), a faixa de 0–24h com a linha "agora" quando o dia é hoje, e as horas ligado com barrinha.
  - Passar o mouse mostra estado, horário e área.
  - Clicar abre `/timeline/?v=<id>&dia=<dia>`.
- **Dados ao vivo:**
  - Hoje: atualiza pelo Realtime, como os Alertas.
  - Dias passados: uma leitura (`lerEventos`, paginada até 5000, como já é).
- **Celular:** o nome fica em cima da faixa, que ocupa a largura toda, e os tipos abrem e fecham.
- **Menu:** Localização · **Dia da frota** · Timeline · Alertas.

---

## Parte 4 — Localização, Alertas e itens comuns

### Painel retrátil (computador)

- Botão "◂" no painel. Recolhido, ele vira uma **barra fina** (cerca de 58 px) com as 6 siglas e a contagem de ligados de cada tipo.
- Clicar numa sigla filtra o mapa por aquele tipo; clicar de novo limpa o filtro. "▸" reabre o painel.
- Depois de abrir ou fechar, o mapa chama `invalidateSize`.
- A preferência fica em `localStorage`. A leitura e a escrita ficam em try/catch, e sem ela o painel começa aberto.

### Painel aberto

- **Topo:** 4 números (ligados, desligados, sem sinal, manutenção) que filtram a lista e o mapa. Eles substituem os indicadores atuais.
- **Abas:** **Tipos** (padrão) · Áreas (como hoje) · Alertas (os eventos de hoje, como a aba Eventos atual).
- **Aba Tipos:**
  - Um grupo por tipo, abrindo e fechando, com as contagens no cabeçalho.
  - Linha: ponto de estado, nome, vaga curta, idade da posição e a frase "Ligado há 51 min · Baia de Resíduos".
  - Sem sinal: "sem sinal 6h · último lugar: Pátio 80".
  - O motor secundário aparece só como um detalhe pequeno na linha.

### Detalhe do veículo

- Uma frase grande: "**Ligado há 51 min** na **Baia de Resíduos**".
- 4 dados: vaga, idade da posição, motorista e bomba (motor 2º; só aparece se o equipamento tiver).
- "▸ mais" abre o endereço e as coordenadas.
- Botões: **Ver o dia** (`/timeline/?v=&dia=hoje`) e Centralizar.
- O histórico embutido no detalhe (data, "Ver histórico", `HistoricoDia`) **sai** dali: a Timeline é o único lugar do histórico.

### Mapa da Localização

- **Marcador:** uma pílula com a sigla do tipo, num círculo na cor do estado, e a placa ou o nome. Sem sinal fica com a opacidade reduzida.
- **Agrupamento:** com `leaflet.markercluster` (dependência nova; importada só no navegador, como o Leaflet). Um círculo com o número abre ao clicar ou ao aproximar.

### Alertas

- Só a frota (vem do filtro).
- Filtro por tipo de equipamento.
- `abertura` é ignorado.

### Busca Ctrl K

- Acha por placa (com ou sem hífen, nas duas formas Mercosul), por "Aspirador 5" ou "asp 05".
- Mostra o tipo do equipamento no resultado.

### Celular

- A gaveta de resumo mostra as contagens por tipo.
- A lista segue a organização por tipo.
- Não há barra fina no celular: ela é só para o computador.

---

## Parte 5 — Testes, publicação e riscos

- **Testes de unidade (vitest):**
  - `equipamentos.test.ts`: hífen, minúsculas, Mercosul nos dois sentidos, aspirador pela vaga (incluindo "ASP12-RESERVA" na vaga 05 → Aspirador 05), motor 2º de um caminhão nosso e de um de fora, veículo de fora → `null`.
  - `capitulos.test.ts`:
    - Com as amostras reais de `coletor/__amostras__/apontamento-*.json` (quando presentes, como a paridade): o número de capítulos fica bem abaixo do de trechos, e a soma das durações cobre o dia.
    - Sintéticos: dia vazio; bloco de exatamente 15 min (vira capítulo); bloco de 14 min (vira "passou por"); motor ligando e desligando no mesmo lugar (um capítulo); destaques.
  - `dia-frota.test.ts`: com abertura; sem abertura (usa o `de`); sem nenhum evento (`sem_registro`); sinal perdido no meio; manutenção; hoje termina em `agora`.
  - Coletor: `filtrarFrota` e a abertura no primeiro ciclo do dia (e só no primeiro).
- **Paridade:** `coletor/paridade.test.ts` continua igual, porque o filtro vem depois do processamento comparado.
- **Testes de navegador (Playwright, dados sintéticos, nenhuma gravação):**
  - Os dados de `e2e/apoio.ts` passam a usar placas da frota.
  - Testes novos: recolher e reabrir o painel e filtrar por sigla; o Dia da frota abre a Timeline ao clicar numa linha; na Timeline, clicar num capítulo leva o player ao horário dele.
- **Carga no GAUSS:** igual à de hoje (nenhuma consulta nova).
- **Publicação:** só quando o dono pedir, depois de `npm run lint && npm run typecheck && npm test && npm run build && npm run e2e`. O push na `main` também publica o coletor novo (filtro e abertura).
- **Riscos:**
  - Uma vaga de aspirador trocada no GAUSS faz o aspirador mudar de número. É aceito; o `fora_da_lista` ajuda a perceber.
  - Um equipamento novo que não está na lista some da tela até alguém editar a lista. O `fora_da_lista` e o README avisam.
  - A precisão do Dia da frota é de ~5 min: a legenda diz isso, e o detalhe fino fica na Timeline.
  - O `leaflet.markercluster` precisa funcionar com o Leaflet atual e com o export estático: conferir no build e no teste de navegador.
