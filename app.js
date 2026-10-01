/* Monitoramento de Localização - front-end.
   Dados chegam por SSE (/api/stream) - a página nunca fala com o GAUSS direto. */

/* ---------- utilidades ---------- */
const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const diaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—');
const horaSeg = (iso) => (iso ? new Date(iso).toLocaleTimeString('pt-BR') : '—');

function fmtMin(min) {
  if (min == null || isNaN(min)) return '—';
  min = Math.round(min);
  if (min < 60) return `${min} min`;
  if (min < 1440) return `${Math.floor(min / 60)}h${pad(min % 60)}`;
  return `${Math.floor(min / 1440)}d ${Math.floor((min % 1440) / 60)}h`;
}
function idadeCurta(iso) {
  if (!iso) return '?';
  const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

/* ---------- domínio ---------- */
const CATS = {
  ligado:    { label: 'Ligado',        cor: 'var(--st-ligado)',    hex: '#16a34a' },
  parado:    { label: 'Parado ligado', cor: 'var(--st-parado)',    hex: '#ca8a04' },
  desligado: { label: 'Desligado',     cor: 'var(--st-desligado)', hex: '#dc2626' },
  manut:     { label: 'Manutenção',    cor: 'var(--st-manut)',     hex: '#ea580c' },
  semcom:    { label: 'Sem comunicação', cor: 'var(--st-semcom)',  hex: '#6b7280' },
  outro:     { label: 'Outros',        cor: 'var(--st-outro)',     hex: '#7c3aed' },
};
function categoria(v) {
  const c = v.status_cod;
  if (c === 1) return 'ligado';
  if (c === 3) return 'parado';
  if ([2, 4, 71, 98].includes(c)) return 'desligado';
  if ([5, 9].includes(c)) return 'manut';
  if (c === 7) return 'semcom';
  return 'outro';
}
// quão recente é a posição - nunca mostrar posição velha como se fosse ao vivo
function frescor(v) {
  const min = v.posicao_em ? (Date.now() - new Date(v.posicao_em)) / 60000 : Infinity;
  if (min <= 5) return 'vivo';
  if (min <= (S.snap?.sem_sinal_min ?? 30)) return 'atrasado';
  return 'semsinal';
}
const FRESCOR_TXT = { vivo: 'posição ao vivo', atrasado: 'posição atrasada', semsinal: 'sem sinal' };

const ESTADO_HIST = {
  movimento:     { label: 'Em deslocamento', hex: '#0ea5e9', ic: '➜' },
  parado_ligado: { label: 'Parado ligado',   hex: '#eab308', ic: '◐' },
  desligado:     { label: 'Desligado',       hex: '#dc2626', ic: '■' },
  parado:        { label: 'Parado',          hex: '#6b7280', ic: '■' },
  sem_sinal:     { label: 'Sem sinal',       hex: '#9ca3af', ic: '⚠' },
};

/* ---------- estado da página ---------- */
const S = {
  snap: null,
  cercas: [],
  poligono: {},          // nome da área -> polígono
  aba: 'veiculos',
  filtro: { kpi: null, busca: '', area: null },
  sel: null,             // id do veículo aberto no detalhe
  eventos: [],
  diaEventos: diaLocal(),
  tiposEventos: new Set(['entrada', 'saida', 'status', 'sinal']),
  hist: null,            // histórico carregado no detalhe
  zoomInicialFeito: false,
  pausado: null,         // motivo da pausa por inatividade, ou null
};

/* ---------- tema (mesma chave do painel de produtividade) ---------- */
function aplicarTema(t) {
  document.documentElement.setAttribute('data-theme', t);
  try { localStorage.setItem('gps-tema', t); } catch {}
  $('#btnTema').textContent = t === 'dark' ? '☀' : '☾';
}
let temaSalvo = null;
try { temaSalvo = localStorage.getItem('gps-tema'); } catch {}
aplicarTema(temaSalvo || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'));
$('#btnTema').onclick = () => aplicarTema(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');

/* ---------- mapa ---------- */
// imagem de satélite da Esri só existe até o zoom 18 nesta região; acima disso
// o Leaflet amplia o tile 18 (senão aparece "Map data not yet available")
const satelite = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
  { maxZoom: 21, maxNativeZoom: 18, attribution: 'Imagens © Esri' });
const ruas = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
  { maxZoom: 21, maxNativeZoom: 19, attribution: '© OpenStreetMap' });
const mapa = L.map('mapa', { layers: [satelite], zoomControl: true, maxZoom: 21 }).setView([-19.48, -42.53], 14);
const camadaCercas = L.layerGroup().addTo(mapa);
const camadaHist = L.layerGroup().addTo(mapa);
const cluster = L.markerClusterGroup({
  disableClusteringAtZoom: 18, maxClusterRadius: 45, showCoverageOnHover: false, spiderfyOnMaxZoom: true,
  iconCreateFunction: (c) => L.divIcon({ html: `<div class="cl" style="width:38px;height:38px">${c.getChildCount()}</div>`, className: '', iconSize: [38, 38] }),
}).addTo(mapa);
L.control.layers({ 'Satélite': satelite, 'Mapa': ruas }, { 'Cercas': camadaCercas, 'Veículos': cluster, 'Histórico': camadaHist }).addTo(mapa);

$('#legenda').innerHTML = Object.entries(CATS).filter(([k]) => k !== 'outro')
  .map(([, c]) => `<div><i style="--c:${c.hex}"></i>${c.label}</div>`).join('') +
  '<div style="opacity:.7"><i style="--c:#9ca3af;outline:1px dashed #555"></i>Tracejado = sem sinal</div>';

const marcadores = new Map(); // id -> { m, chave }

function desenharCercas() {
  camadaCercas.clearLayers();
  for (const c of S.cercas) {
    if (c.polygon.length < 3) continue;
    const planta = c.tipo === 'planta';
    const via = c.tipo === 'via';
    L.polygon(c.polygon, {
      color: c.color, weight: planta ? 2 : 1, dashArray: planta ? '6 4' : null,
      fillOpacity: planta ? 0 : via ? 0.12 : 0.22, interactive: !planta,
    }).bindTooltip(esc(c.name), { sticky: true, className: 'rotulo-cerca' }).addTo(camadaCercas);
    if (c.tipo === 'area' && !S.poligono[c.name]) S.poligono[c.name] = c.polygon;
  }
}

const motor2Ligado = (v) => v.motor2?.status_cod === 1;

function iconeVeiculo(v, sel) {
  const cat = categoria(v);
  const fr = frescor(v);
  const seta = cat === 'ligado' && fr === 'vivo'
    ? `<span class="seta" style="transform:rotate(${v.direcao}deg)">▲</span>`
    : '<span class="seta">●</span>';
  const m2 = motor2Ligado(v) ? '<span class="m2" title="Motor secundário ligado">⚙</span>' : '';
  return `<div class="mk${fr === 'semsinal' ? ' semsinal' : ''}${sel ? ' sel' : ''}" style="--c:${CATS[cat].hex}" title="${esc(v.placa)} · ${esc(v.status)}${v.motor2 ? ' · motor 2º ' + esc(v.motor2.status) : ''} · ${FRESCOR_TXT[fr]}">${seta}${esc(v.placa)}${m2} <small>${idadeCurta(v.posicao_em)}</small></div>`;
}

function atualizarMarcadores(visiveis) {
  const ids = new Set(visiveis.map((v) => v.id));
  for (const v of S.snap.veiculos) {
    if (!v.lat || !v.lng) continue;
    // com histórico aberto, só o veículo selecionado fica no mapa
    // o selecionado aparece mesmo que o filtro atual o esconda (ex.: buscado pela busca geral)
    const mostrar = (ids.has(v.id) || v.id === S.sel) && (!S.hist || v.id === S.sel);
    const html = iconeVeiculo(v, v.id === S.sel);
    const chave = `${v.lat},${v.lng}|${html}`;
    let reg = marcadores.get(v.id);
    if (!reg) {
      const m = L.marker([v.lat, v.lng], { icon: L.divIcon({ html, className: '', iconSize: null }), riseOnHover: true });
      m.on('click', () => abrirDetalhe(v.id));
      reg = { m, chave };
      marcadores.set(v.id, reg);
    } else if (reg.chave !== chave) {
      const moveu = !reg.m.getLatLng().equals([v.lat, v.lng]);
      if (moveu && cluster.hasLayer(reg.m)) { cluster.removeLayer(reg.m); reg.m.setLatLng([v.lat, v.lng]); cluster.addLayer(reg.m); }
      else if (moveu) reg.m.setLatLng([v.lat, v.lng]);
      reg.m.setIcon(L.divIcon({ html, className: '', iconSize: null }));
      reg.chave = chave;
    }
    reg.m.setZIndexOffset(v.id === S.sel ? 1000 : 0);
    if (mostrar && !cluster.hasLayer(reg.m)) cluster.addLayer(reg.m);
    if (!mostrar && cluster.hasLayer(reg.m)) cluster.removeLayer(reg.m);
  }
}

// zoom inicial: a área com mais veículos com sinal (normalmente o pátio)
function zoomInicial() {
  const conta = {};
  for (const v of S.snap.veiculos) if (frescor(v) !== 'semsinal' && S.poligono[v.area]) conta[v.area] = (conta[v.area] ?? 0) + 1;
  const top = Object.keys(conta).sort((a, b) => conta[b] - conta[a])[0];
  if (top) mapa.fitBounds(L.latLngBounds(S.poligono[top]).pad(0.08));
  else {
    const pts = S.snap.veiculos.filter((v) => v.lat).map((v) => [v.lat, v.lng]);
    if (pts.length) mapa.fitBounds(L.latLngBounds(pts).pad(0.1));
  }
}

/* ---------- KPIs ---------- */
const KPIS = [
  { id: 'todos',     label: 'Frota no mapa',  acento: 'var(--brand-2)', filtro: () => true },
  { id: 'ligado',    label: 'Ligados',        acento: CATS.ligado.cor, filtro: (v) => categoria(v) === 'ligado' },
  { id: 'parado',    label: 'Parados ligados', acento: CATS.parado.cor, filtro: (v) => categoria(v) === 'parado' },
  { id: 'motor2',    label: 'Motor 2º ligado', acento: '#0891b2', filtro: motor2Ligado,
    sub: () => `de ${S.snap.veiculos.filter((v) => v.motor2).length} com motor secundário` },
  { id: 'desligado', label: 'Desligados',     acento: CATS.desligado.cor, filtro: (v) => categoria(v) === 'desligado' },
  { id: 'manut',     label: 'Manutenção',     acento: CATS.manut.cor, filtro: (v) => categoria(v) === 'manut' },
  { id: 'semsinal',  label: 'Sem sinal',      acento: CATS.semcom.cor, filtro: (v) => frescor(v) === 'semsinal',
    sub: () => `+${S.snap?.sem_sinal_min ?? 30} min sem posição nova` },
];

// a fileira de indicadores foi retirada da página a pedido (01/10/2026); se voltar
// a existir um #kpis, ela é desenhada de novo
function renderKPIs() {
  const el = $('#kpis');
  if (!el) return;
  const vs = S.snap.veiculos;
  el.innerHTML = KPIS.map((k) => {
    const n = vs.filter(k.filtro).length;
    const ativo = S.filtro.kpi === k.id || (k.id === 'todos' && !S.filtro.kpi);
    const sub = k.sub ? k.sub() : k.id === 'todos' ? `${vs.filter((v) => frescor(v) === 'vivo').length} com posição ao vivo` : `${Math.round((n / (vs.length || 1)) * 100)}% da frota`;
    return `<button class="kpi${ativo ? ' ativo' : ''}" data-kpi="${k.id}" style="--acento:${k.acento}" aria-pressed="${ativo}">
      <span class="kpi-label"><span class="pt"></span>${k.label}</span>
      <span class="kpi-valor tnum">${n}</span>
      <span class="kpi-sub">${sub}</span></button>`;
  }).join('');
}
if ($('#kpis')) $('#kpis').onclick = (e) => {
  const b = e.target.closest('[data-kpi]');
  if (!b) return;
  S.filtro.kpi = b.dataset.kpi === 'todos' || S.filtro.kpi === b.dataset.kpi ? null : b.dataset.kpi;
  if (S.aba !== 'veiculos') trocarAba('veiculos');
  render();
};

/* ---------- filtros / lista ---------- */
function veiculosFiltrados() {
  const k = KPIS.find((x) => x.id === S.filtro.kpi);
  const q = S.filtro.busca.trim().toUpperCase();
  return S.snap.veiculos.filter((v) =>
    (!k || k.filtro(v)) &&
    (!S.filtro.area || (S.filtro.area === '__fora' ? !v.area : v.area === S.filtro.area)) &&
    (!q || [v.placa, v.motor2?.placa, v.vaga, v.grupo, v.area, v.via, v.motorista].join(' ').toUpperCase().includes(q)));
}

function renderFiltroAtivo() {
  const partes = [];
  if (S.filtro.kpi) partes.push(['kpi', KPIS.find((k) => k.id === S.filtro.kpi).label]);
  if (S.filtro.area) partes.push(['area', S.filtro.area === '__fora' ? 'Fora de área' : S.filtro.area]);
  const el = $('#filtroAtivo');
  el.hidden = !partes.length;
  el.innerHTML = partes.map(([k, t]) => `<button class="chip ativo" data-limpar="${k}" title="Remover filtro">${esc(t)} ✕</button>`).join('');
}
$('#filtroAtivo').onclick = (e) => {
  const b = e.target.closest('[data-limpar]');
  if (!b) return;
  S.filtro[b.dataset.limpar] = null;
  render();
};
$('#busca').oninput = (e) => { S.filtro.busca = e.target.value; render(); };

function renderVeiculos(lista) {
  if (!lista.length) return '<div class="vazio"><div class="vazio-titulo">Nenhum veículo</div><div class="vazio-sub">Ajuste a busca ou os filtros.</div></div>';
  // agrupa por área atual; quem está em rua/sem área vai pro fim
  const grupos = {};
  for (const v of lista) (grupos[v.area || ''] ??= []).push(v);
  const nomes = Object.keys(grupos).sort((a, b) => (!a) - (!b) || grupos[b].length - grupos[a].length || a.localeCompare(b));
  return nomes.map((nome) => `
    <div class="grupo-titulo"><span>${esc(nome || 'Fora de área / em vias')}</span><span class="cnt">${grupos[nome].length}</span></div>
    ${grupos[nome].sort((a, b) => a.placa.localeCompare(b.placa)).map(itemVeiculo).join('')}`).join('');
}

function itemVeiculo(v) {
  const cat = categoria(v);
  const fr = frescor(v);
  const onde = v.area ? (v.area_desde ? `há ${fmtMin((Date.now() - new Date(v.area_desde)) / 60000)} na área` : 'na área') : v.via || 'fora de cerca';
  return `<button class="item${v.id === S.sel ? ' sel' : ''}" data-id="${v.id}">
    <span class="pt" style="--c:${CATS[cat].hex}"></span>
    <span class="placa">${esc(v.placa)}</span>
    <span class="lado"><span class="frescor ${fr}" title="${FRESCOR_TXT[fr]}"></span>${idadeCurta(v.posicao_em)}</span>
    <span class="sub">${esc(v.status)} · ${esc(v.vaga || 'sem vaga')}</span>
    <span class="sub2">${esc(onde)}${v.demora ? ' · ' + esc(v.demora) : ''}</span>
    ${v.motor2 ? `<span class="sub2 m2-linha${motor2Ligado(v) ? ' on' : ''}">⚙ Motor 2º: ${esc(v.motor2.status)}${motor2Ligado(v) && v.motor2.status_desde ? ' há ' + fmtMin((Date.now() - new Date(v.motor2.status_desde)) / 60000) : ''}</span>` : ''}
  </button>`;
}

/* ---------- áreas ---------- */
function renderAreas() {
  const grupos = {};
  for (const v of S.snap.veiculos) (grupos[v.area || '__fora'] ??= []).push(v);
  const nomes = Object.keys(grupos).sort((a, b) => (a === '__fora') - (b === '__fora') || grupos[b].length - grupos[a].length);
  return nomes.map((nome) => {
    const vs = grupos[nome];
    const porCat = {};
    vs.forEach((v) => { const c = categoria(v); porCat[c] = (porCat[c] ?? 0) + 1; });
    const barra = Object.entries(porCat).map(([c, n]) => `<span style="width:${(n / vs.length) * 100}%;background:${CATS[c].hex}" title="${CATS[c].label}: ${n}"></span>`).join('');
    const resumo = Object.entries(porCat).map(([c, n]) => `${n} ${CATS[c].label.toLowerCase()}`).join(' · ');
    return `<button class="item area-item" data-area="${esc(nome)}">
      <span class="nome">${esc(nome === '__fora' ? 'Fora de área / em vias' : nome)}</span>
      <span class="total">${vs.length}</span>
      <span class="barra">${barra}</span>
      <span class="sub">${resumo}</span></button>`;
  }).join('');
}

/* ---------- eventos ---------- */
const TIPO_EV = {
  entrada: { label: 'Entradas', ic: '↘' },
  saida: { label: 'Saídas', ic: '↗' },
  status: { label: 'Status', ic: '●' },
  sinal: { label: 'Sinal', ic: '⚠' },
};
const grupoTipo = (t) => (t.startsWith('sinal') ? 'sinal' : t);

function textoEvento(e) {
  const p = e.motor2 ? `<b>${esc(e.principal ?? e.placa)}</b> ⚙ motor 2º` : `<b>${esc(e.placa)}</b>`;
  switch (e.tipo) {
    case 'entrada': return `${p} entrou em <b>${esc(e.area)}</b>`;
    case 'saida': return `${p} saiu de <b>${esc(e.area)}</b>${e.permanencia_min != null ? ` · ficou ${fmtMin(e.permanencia_min)}` : ''}`;
    case 'status': return `${p} ${esc(e.de)} → <b>${esc(e.para)}</b>${e.duracao_min != null ? ` · ${fmtMin(e.duracao_min)} no anterior` : ''}${e.area ? ` · ${esc(e.area)}` : ''}`;
    case 'sinal_perdido': return `${p} <b>sem sinal</b> desde ${hora(e.ultima_posicao)}${e.area ? ` · ${esc(e.area)}` : ''}`;
    case 'sinal_retomado': return `${p} <b>voltou a comunicar</b>${e.sem_sinal_min != null ? ` após ${fmtMin(e.sem_sinal_min)}` : ''}`;
    default: return `${p} ${esc(e.tipo)}`;
  }
}

function renderEventos() {
  const q = $('#buscaEventos').value.trim().toUpperCase();
  const lista = S.eventos
    .filter((e) => S.tiposEventos.has(grupoTipo(e.tipo)) && (!q || `${e.placa} ${e.area ?? ''}`.toUpperCase().includes(q)))
    .sort((a, b) => b.t.localeCompare(a.t));
  if (!lista.length) {
    return `<div class="vazio"><div class="vazio-titulo">Nenhum evento</div>
      <div class="vazio-sub">Eventos são gerados a partir de quando o monitoramento está rodando. Para o dia completo de um veículo, abra-o e use “Ver histórico”.</div></div>`;
  }
  return lista.slice(0, 400).map((e) => `
    <button class="item evento" data-id="${e.principal_id ?? e.id}">
      <span class="ic ${e.tipo}">${TIPO_EV[grupoTipo(e.tipo)].ic}</span>
      <span class="txt">${textoEvento(e)}</span>
      <span class="hora">${hora(e.t)}</span></button>`).join('');
}

function renderChipsEventos() {
  const conta = {};
  S.eventos.forEach((e) => { const g = grupoTipo(e.tipo); conta[g] = (conta[g] ?? 0) + 1; });
  $('#tiposEventos').innerHTML = Object.entries(TIPO_EV).map(([k, t]) =>
    `<button class="chip${S.tiposEventos.has(k) ? ' ativo' : ''}" data-tipo="${k}">${t.ic} ${t.label} <span class="cnt">${conta[k] ?? 0}</span></button>`).join('');
  $('#cntEventos').textContent = S.eventos.length;
}
$('#tiposEventos').onclick = (e) => {
  const b = e.target.closest('[data-tipo]');
  if (!b) return;
  const t = b.dataset.tipo;
  S.tiposEventos.has(t) ? S.tiposEventos.delete(t) : S.tiposEventos.add(t);
  renderChipsEventos();
  renderCorpo();
};
$('#buscaEventos').oninput = () => renderCorpo();
$('#diaEventos').onchange = async (e) => { S.diaEventos = e.target.value; await carregarEventos(); };

async function carregarEventos() {
  try {
    S.eventos = await (await fetch(`/api/eventos?dia=${S.diaEventos}`)).json();
  } catch { S.eventos = []; }
  renderChipsEventos();
  if (S.aba === 'eventos') renderCorpo();
}
async function carregarDias() {
  let dias = [];
  try { dias = await (await fetch('/api/dias')).json(); } catch {}
  const hoje = diaLocal();
  if (!dias.includes(hoje)) dias.unshift(hoje);
  $('#diaEventos').innerHTML = dias.map((d) => `<option value="${d}">${d === hoje ? 'Hoje' : d.split('-').reverse().join('/')}</option>`).join('');
}

/* ---------- abas ---------- */
function trocarAba(aba) {
  S.aba = aba;
  document.querySelectorAll('#abas button').forEach((b) => b.classList.toggle('ativo', b.dataset.aba === aba));
  $('#filtrosVeiculos').hidden = aba !== 'veiculos';
  $('#filtrosEventos').hidden = aba !== 'eventos';
  renderCorpo();
}
$('#abas').onclick = (e) => { const b = e.target.closest('[data-aba]'); if (b) trocarAba(b.dataset.aba); };

function renderCorpo() {
  const corpo = $('#corpo');
  const topo = corpo.scrollTop;
  if (S.aba === 'veiculos') corpo.innerHTML = renderVeiculos(veiculosFiltrados());
  else if (S.aba === 'areas') corpo.innerHTML = renderAreas();
  else corpo.innerHTML = renderEventos();
  corpo.scrollTop = topo; // atualização ao vivo não pode jogar a lista pro topo
}
$('#corpo').onclick = (e) => {
  const area = e.target.closest('[data-area]');
  if (area) {
    S.filtro.area = area.dataset.area;
    if (S.poligono[S.filtro.area]) mapa.fitBounds(L.latLngBounds(S.poligono[S.filtro.area]).pad(0.08));
    trocarAba('veiculos');
    render();
    return;
  }
  const it = e.target.closest('[data-id]');
  if (it) abrirDetalhe(it.dataset.id);
};

/* ---------- detalhe do veículo ---------- */
function abrirDetalhe(id) {
  if (S.sel !== id) limparHistorico();
  S.sel = id;
  const v = S.snap.veiculos.find((x) => x.id === id);
  $('#vistaPrincipal').hidden = true;
  $('#vistaDetalhe').hidden = false;
  $('#vistaDetalhe').innerHTML = `
    <div class="det-topo">
      <button class="btn btn-neutro btn-mini det-voltar" id="btnVoltar">← Voltar</button>
      <div id="detCabecalho"></div>
      <div class="det-acoes">
        <button class="btn btn-neutro btn-mini" id="btnCentralizar">Centralizar no mapa</button>
        <input class="input" type="date" id="diaHist" value="${diaLocal()}" max="${diaLocal()}" aria-label="Dia do histórico">
        <button class="btn btn-primario btn-mini" id="btnHist">Ver histórico</button>
      </div>
    </div>
    <div class="det-corpo">
      <dl class="det-campos" id="detCampos"></dl>
      <div id="detHist"></div>
    </div>`;
  $('#btnVoltar').onclick = fecharDetalhe;
  $('#btnCentralizar').onclick = () => { const x = S.snap.veiculos.find((y) => y.id === S.sel); if (x) mapa.flyTo([x.lat, x.lng], 18); };
  $('#btnHist').onclick = carregarHistorico;
  renderDetalhe();
  if (v?.lat) mapa.flyTo([v.lat, v.lng], Math.max(mapa.getZoom(), 17));
  render();
}

function fecharDetalhe() {
  S.sel = null;
  limparHistorico();
  $('#vistaDetalhe').hidden = true;
  $('#vistaPrincipal').hidden = false;
  render();
}

function renderDetalhe() {
  if (!S.sel || $('#vistaDetalhe').hidden) return;
  const v = S.snap.veiculos.find((x) => x.id === S.sel);
  if (!v) return;
  const cat = categoria(v);
  const fr = frescor(v);
  const seloFrescor = { vivo: 'selo-good', atrasado: 'selo-warn', semsinal: 'selo-neutral' }[fr];
  $('#detCabecalho').innerHTML = `
    <div class="det-placa">${esc(v.placa)}
      <span class="selo" style="background:color-mix(in srgb, ${CATS[cat].hex} 15%, transparent);color:${CATS[cat].hex}"><span class="pt"></span>${esc(v.status)}</span>
      <span class="selo ${seloFrescor}">${FRESCOR_TXT[fr]}</span></div>
    <div class="det-vaga">${esc(v.vaga || 'Sem vaga')}${v.grupo ? ' · ' + esc(v.grupo) : ''}</div>`;
  const campos = [
    ['Última posição', `${horaSeg(v.posicao_em)} (há ${idadeCurta(v.posicao_em)})`],
    ['Status desde', v.status_desde ? `${hora(v.status_desde)} · ${fmtMin((Date.now() - new Date(v.status_desde)) / 60000)}` : 'antes do início do monitoramento'],
    ['Área', v.area ? `${esc(v.area)}${v.area_desde ? ` · desde ${hora(v.area_desde)} (${fmtMin((Date.now() - new Date(v.area_desde)) / 60000)})` : ''}` : 'Fora de área'],
    ['Via', esc(v.via || '—')],
    ['Endereço', esc(v.endereco || '—')],
    ...(v.motor2 ? [['Motor secundário', `${esc(v.motor2.status)} · ${esc(v.motor2.placa)}${v.motor2.status_desde ? ` · desde ${hora(v.motor2.status_desde)}` : ''}`]] : []),
    ['Motorista', esc(v.motorista || 'Não identificado')],
    ['Demora', esc(v.demora || '—')],
    ['Coordenadas', `${v.lat?.toFixed(6)}, ${v.lng?.toFixed(6)}`],
  ];
  $('#detCampos').innerHTML = campos.map(([k, val]) => `<dt>${k}</dt><dd>${val}</dd>`).join('');
}

/* ---------- histórico / apontamento ---------- */
function limparHistorico() {
  S.hist = null;
  camadaHist.clearLayers();
}

async function carregarHistorico() {
  const dia = $('#diaHist').value || diaLocal();
  const alvo = $('#detHist');
  const btn = $('#btnHist');
  btn.disabled = true;
  alvo.innerHTML = '<div class="vazio"><div class="vazio-titulo">Buscando histórico…</div><div class="vazio-sub">Se este dia ainda não está no banco, o pedido vai para o coletor (roda a cada ~5 min no GitHub) e aparece aqui sozinho quando chegar. Depois fica guardado.</div><div class="vazio-sub" data-espera-historico style="font-weight:700;margin-top:6px"></div></div>';
  try {
    const r = await fetch(`/api/historico?id=${encodeURIComponent(S.sel)}&dia=${dia}`);
    const h = await r.json();
    if (!r.ok) throw new Error(h.erro || `HTTP ${r.status}`);
    S.hist = h;
    desenharHistorico(h);
    renderHistorico(h);
    render();
  } catch (err) {
    alvo.innerHTML = `<div class="faixa faixa-atencao" style="margin:12px 16px">Não foi possível carregar: ${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
}

function desenharHistorico(h) {
  camadaHist.clearLayers();
  if (!h.pontos?.length) return;
  // uma polilinha por sequência de mesmo estado, na cor do estado
  const sequencias = [];
  for (const [lat, lng, , , estado] of h.pontos) {
    const atual = sequencias.at(-1);
    if (atual && atual.estado === estado) { atual.pts.push([lat, lng]); continue; }
    if (atual) atual.pts.push([lat, lng]); // emenda com a próxima, sem buraco visual
    sequencias.push({ estado, pts: [[lat, lng]] });
  }
  // contorno escuro por baixo + linha grossa por cima: destaca no satélite e sobre as cercas coloridas
  for (const s of sequencias) L.polyline(s.pts, { color: '#0b1220', weight: 11, opacity: 0.75, lineJoin: 'round' }).addTo(camadaHist);
  for (const s of sequencias) {
    L.polyline(s.pts, { color: ESTADO_HIST[s.estado]?.hex ?? '#888', weight: 7, opacity: 1, lineJoin: 'round', lineCap: 'round' }).addTo(camadaHist);
  }
  // paradas relevantes viram marcadores numerados
  h.trechos.forEach((t, i) => {
    if (t.estado === 'movimento' || t.estado === 'sem_sinal' || t.duracao_min < 10 || t.lat == null) return;
    L.circleMarker([t.lat, t.lng], { radius: 7, color: '#fff', weight: 2, fillColor: ESTADO_HIST[t.estado].hex, fillOpacity: 1 })
      .bindTooltip(`${t.inicio.slice(11, 16)}–${t.fim.slice(11, 16)} · ${ESTADO_HIST[t.estado].label} · ${fmtMin(t.duracao_min)}<br>${esc(t.local)}`)
      .on('click', () => focarTrecho(i))
      .addTo(camadaHist);
  });
  const ini = h.pontos[0];
  const fim = h.pontos.at(-1);
  L.marker([ini[0], ini[1]], { icon: L.divIcon({ html: '<div class="mk" style="--c:#0f766e">Início ' + ini[2].slice(0, 5) + '</div>', className: '', iconSize: null }) }).addTo(camadaHist);
  L.marker([fim[0], fim[1]], { icon: L.divIcon({ html: '<div class="mk" style="--c:#1f3864">Fim ' + fim[2].slice(0, 5) + '</div>', className: '', iconSize: null }) }).addTo(camadaHist);
  mapa.fitBounds(L.latLngBounds(h.pontos.map((p) => [p[0], p[1]])).pad(0.05));
}

function focarTrecho(i) {
  const t = S.hist.trechos[i];
  const ini = t.inicio.slice(11, 19);
  const fim = t.fim.slice(11, 19);
  const pts = S.hist.pontos.filter((p) => p[2] >= ini && p[2] <= fim).map((p) => [p[0], p[1]]);
  if (pts.length > 1) mapa.fitBounds(L.latLngBounds(pts).pad(0.2), { maxZoom: 18 });
  else if (t.lat != null) mapa.flyTo([t.lat, t.lng], 18);
  document.querySelectorAll('.trecho').forEach((el) => el.classList.toggle('sel', Number(el.dataset.i) === i));
}

function renderHistorico(h) {
  const alvo = $('#detHist');
  if (!h.trechos.length) {
    alvo.innerHTML = '<div class="vazio"><div class="vazio-titulo">Sem dados neste dia</div><div class="vazio-sub">O GAUSS não tem posições do veículo para a data escolhida.</div></div>';
    return;
  }
  const r = h.resumo;
  const linhasResumo = [
    ['Período', `${r.primeiro.slice(11, 16)} – ${r.ultimo.slice(11, 16)}`],
    ['Distância', `${r.km.toLocaleString('pt-BR')} km · máx ${r.vel_max} km/h`],
    ['Em deslocamento', fmtMin(r.movimento_min)],
    ...(h.temRpm
      ? [['Parado ligado', fmtMin(r.parado_ligado_min)], ['Desligado', fmtMin(r.desligado_min)]]
      : [['Parado', `${fmtMin(r.parado_min)} <span class="texto-3">(${h.rpm_travado ? `RPM do rastreador travado em ${h.rpm_travado} o dia todo - sem informação confiável de motor ligado/desligado` : 'veículo não envia RPM'})</span>`]]),
    ...(r.sem_sinal_min ? [['Sem sinal', fmtMin(r.sem_sinal_min)]] : []),
    ...(h.motor2 ? [['Motor 2º ligado', `<b>${fmtMin(r.motor2_ligado_min)}</b> <span class="texto-3">(${esc(h.motor2.placa ?? '')})</span>`]] : []),
    ...(h.motor2_erro ? [['Motor 2º', `<span class="texto-3">não carregou: ${esc(h.motor2_erro)}</span>`]] : []),
  ];
  const fonte = { cache: 'do cache local', incremental: 'atualizado (só a parte nova)', gauss: 'baixado do GAUSS' }[h.fonte] ?? '';
  alvo.innerHTML = `
    <div class="det-secao">Resumo do dia ${h.dia.split('-').reverse().join('/')} <span style="text-transform:none;font-weight:500">· ${fonte}</span></div>
    <div style="padding:0 16px 8px"><a class="btn btn-primario btn-mini" href="timeline.html?v=${encodeURIComponent(h.id)}&dia=${h.dia}">▶ Reproduzir trajetória na Timeline</a></div>
    <dl class="det-campos">${linhasResumo.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
    <div class="det-secao">Tempo por área</div>
    <div style="padding:0 16px 12px;display:flex;flex-direction:column;gap:6px">
      ${r.areas.slice(0, 8).map((a) => `<div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:8px;font-size:12px">
        <span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.area)}</span><b class="tnum">${fmtMin(a.min)}</b>
        <span class="mini-barra" style="grid-column:1/3;height:4px;border-radius:2px;background:var(--surface-3);overflow:hidden"><span style="display:block;height:100%;width:${(a.min / r.areas[0].min) * 100}%;background:var(--brand-2)"></span></span></div>`).join('')}
    </div>
    <div class="det-secao" style="display:flex;align-items:center;justify-content:space-between">Apontamento <button class="btn btn-neutro btn-mini" id="btnCSV">Exportar CSV</button></div>
    ${h.trechos.map((t, i) => itemTrecho(t, i)).join('')}`;
  $('#btnCSV').onclick = () => exportarCSV(h);
  alvo.onclick = (e) => { const it = e.target.closest('.trecho'); if (it) focarTrecho(Number(it.dataset.i)); };
}

function itemTrecho(t, i) {
  const e = ESTADO_HIST[t.estado];
  let desc;
  if (t.estado === 'movimento') {
    const caminho = t.percurso.length ? t.percurso.map(esc).join(' → ') : 'sem cercas no caminho';
    desc = `<b>${e.label}</b> · ${t.km} km · máx ${t.vel_max} km/h<br>${caminho}`;
  } else if (t.estado === 'sem_sinal') {
    desc = `<b>${e.label}</b> · nenhuma posição recebida`;
  } else {
    desc = `<b>${e.label}</b> em ${esc(t.local)}`;
  }
  if (t.motor2_min) desc += `<br><span class="m2-linha on">⚙ motor 2º ligado ${fmtMin(t.motor2_min)}</span>`;
  return `<button class="item evento trecho" data-i="${i}">
    <span class="ic" style="background:color-mix(in srgb, ${e.hex} 16%, transparent);color:${e.hex}">${e.ic}</span>
    <span class="txt">${desc}</span>
    <span class="hora">${t.inicio.slice(11, 16)}–${t.fim.slice(11, 16)}<br><span style="font-weight:500">${fmtMin(t.duracao_min)}</span></span></button>`;
}

function exportarCSV(h) {
  const v = S.snap.veiculos.find((x) => x.id === h.id);
  const cab = ['placa', 'dia', 'inicio', 'fim', 'duracao_min', 'situacao', 'local_ou_percurso', 'km', 'vel_max', 'motor2_ligado_min'];
  const linhas = h.trechos.map((t) => [
    v?.placa ?? h.id, h.dia, t.inicio.slice(11, 19), t.fim.slice(11, 19), t.duracao_min, ESTADO_HIST[t.estado].label,
    t.estado === 'movimento' ? t.percurso.join(' > ') : t.local ?? '', t.km ?? '', t.vel_max ?? '', t.motor2_min ?? '',
  ]);
  const csv = [cab, ...linhas].map((l) => l.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\r\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `apontamento-${v?.placa ?? h.id}-${h.dia}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ---------- status da conexão ---------- */
function renderStatus(conectado = true) {
  const chip = $('#chipAtualizacao');
  $('#faixaPausa').hidden = !S.pausado;
  if (S.pausado) {
    $('#faixaPausa').innerHTML = `Atualização pausada (${esc(S.pausado)}) para não consultar o GAUSS sem ninguém olhando. Os dados abaixo são de ${horaSeg(S.snap?.lido_em)}. <a href="#" onclick="return false">Mexa o mouse ou clique para retomar</a>`;
    chip.classList.add('alerta');
    chip.classList.remove('pulsando');
    $('#txtAtualizacao').textContent = 'pausado';
    return;
  }
  chip.classList.add('pulsando');
  const snap = S.snap;
  const atrasado = snap?.lido_em && Date.now() - new Date(snap.lido_em) > snap.intervalo_s * 3 * 1000;
  const ok = conectado && snap?.lido_em && !snap.erro && !atrasado;
  chip.classList.toggle('alerta', !ok);
  $('#txtAtualizacao').textContent = !conectado ? 'reconectando…'
    : !snap?.lido_em ? 'aguardando 1ª leitura…'
    : `atualizado ${horaSeg(snap.lido_em)} · a cada ${snap.intervalo_s >= 60 ? snap.intervalo_s / 60 + ' min' : snap.intervalo_s + 's'}`;
  const g = snap?.gauss;
  if (g) {
    $('#txtCarga').textContent = `GAUSS: ${g.requisicoes} req`;
    $('#txtCarga').title = `Requisições feitas ao GAUSS desde ${new Date(g.desde).toLocaleString('pt-BR')}: ${g.requisicoes} (${g.logins} login(s), ${g.erros} erro(s))`;
  }
  const faixa = $('#faixaErro');
  if (snap?.erro) {
    faixa.hidden = false;
    faixa.textContent = `Falha ao consultar o GAUSS às ${hora(snap.erro.em)}: ${snap.erro.msg}. Mostrando a última leitura${snap.lido_em ? ` (${horaSeg(snap.lido_em)})` : ''}.`;
  } else if (g?.pausadoAte && new Date(g.pausadoAte) > Date.now()) {
    faixa.hidden = false;
    faixa.textContent = `Acesso ao GAUSS pausado até ${hora(g.pausadoAte)} após falhas seguidas (proteção para não insistir).`;
  } else {
    faixa.hidden = true;
  }
}

/* ---------- render geral ---------- */
function render() {
  if (!S.snap) return;
  const visiveis = veiculosFiltrados();
  $('#cntVeiculos').textContent = visiveis.length;
  $('#cntAreas').textContent = new Set(S.snap.veiculos.map((v) => v.area).filter(Boolean)).size;
  renderKPIs();
  renderFiltroAtivo();
  renderCorpo();
  renderDetalhe();
  atualizarMarcadores(visiveis);
  renderStatus();
}

/* ---------- conexão ao vivo + pausa por inatividade ----------
   Cada aba conectada faz o servidor consultar o GAUSS a cada 30s. Aba esquecida
   aberta (ex.: de madrugada) não pode manter esse ritmo: sem uso por 15 min ou
   em segundo plano por 2 min, a página desconecta e o servidor cai para 5 min.
   Modo telão (#tv=1 no endereço) não pausa. */
const VERSAO_CLIENTE = '2'; // só abas com esta versão (que pausam) aceleram as consultas no servidor
const PAUSA_INATIVO_MS = 15 * 60 * 1000;
const PAUSA_OCULTA_MS = 2 * 60 * 1000;
// GitHub Pages: a página só lê do Supabase, não gera consulta ao GAUSS - não há o que pausar
const MODO_TV = true;
let fonte = null;
let ultimoUso = Date.now();
let timerOculta = null;

function conectar() {
  fonte?.close();
  fonte = new EventSource(`/api/stream?v=${VERSAO_CLIENTE}`);
  fonte.addEventListener('estado', async (e) => {
    const snap = JSON.parse(e.data);
    // motor secundário (placa + "2") não é outro caminhão: sai da lista e vai em v.motor2
    S.snap = { ...snap, veiculos: snap.veiculos.filter((v) => !v.motor2_de) };
    if (!S.cercas.length && S.snap.lido_em) { // 1ª execução: cercas acabaram de ser baixadas
      try { S.cercas = await (await fetch('/api/cercas')).json(); desenharCercas(); } catch {}
    }
    const primeira = !S.zoomInicialFeito && S.snap.veiculos.length && S.cercas.length;
    if (primeira) { zoomInicial(); S.zoomInicialFeito = true; }
    render();
    // link direto: #v=<código do veículo>[&hist=AAAA-MM-DD] abre o detalhe (e o histórico)
    if (primeira) {
      const h = new URLSearchParams(location.hash.slice(1));
      if (h.get('v') && S.snap.veiculos.some((v) => v.id === h.get('v'))) {
        abrirDetalhe(h.get('v'));
        if (h.get('hist')) { $('#diaHist').value = h.get('hist'); carregarHistorico(); }
      }
    }
  });
  fonte.addEventListener('eventos', (e) => {
    if (S.diaEventos !== diaLocal()) return;
    S.eventos.push(...JSON.parse(e.data));
    renderChipsEventos();
    if (S.aba === 'eventos') renderCorpo();
  });
  fonte.onerror = () => renderStatus(false);
}

function pausar(motivo) {
  if (S.pausado || MODO_TV) return;
  S.pausado = motivo;
  fonte?.close();
  fonte = null;
  renderStatus();
}

function retomar() {
  ultimoUso = Date.now();
  if (!S.pausado) return;
  S.pausado = null;
  conectar();
  carregarEventos(); // eventos que aconteceram durante a pausa
  renderStatus();
}

for (const ev of ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart']) {
  addEventListener(ev, retomar, { passive: true });
}
document.addEventListener('visibilitychange', () => {
  clearTimeout(timerOculta);
  if (document.hidden) timerOculta = setTimeout(() => pausar('aba em segundo plano'), PAUSA_OCULTA_MS);
  else retomar();
});
setInterval(() => { if (Date.now() - ultimoUso > PAUSA_INATIVO_MS) pausar('sem uso há 15 min'); }, 30_000);
$('#faixaPausa').onclick = retomar;

/* ---------- inicialização ---------- */
async function iniciar() {
  try {
    S.cercas = await (await fetch('/api/cercas')).json();
    desenharCercas();
  } catch {}
  await carregarDias();
  await carregarEventos();
  conectar();
  // idades ("há 2m") envelhecem mesmo sem leitura nova
  setInterval(() => { if (S.snap) { renderCorpo(); renderDetalhe(); renderStatus(); } }, 30_000);
}
iniciar();
