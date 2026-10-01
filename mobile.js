/* Celular + busca geral, compartilhado pelas 3 páginas (carregar com defer, depois
   do script da página). No celular: barra de abas embaixo, lista do mapa vira gaveta
   arrastável, detalhe dos alertas abre por cima. Em qualquer tela: busca geral
   (veículos, cercas/ruas, eventos de hoje) pelo botão 🔍, pela tecla "/" ou Ctrl+K.

   Usa funções/variáveis globais das páginas quando existem (abrirDetalhe,
   fecharDetalhe, trocarAba, render, S, mapa - todas do app.js da Localização). */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const celular = matchMedia('(max-width: 760px)');
  const pagina = $('#painel') ? 'mapa' : $('.tl-main') ? 'timeline' : $('.al-main') ? 'alertas' : 'outra';
  const pad = (n) => String(n).padStart(2, '0');
  const hoje = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // busca sem acento e sem maiúscula; placa também sem hífen (EGC-2984 = egc2984)
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const normPlaca = (s) => norm(s).replace(/[^A-Z0-9]/g, '');

  const ICONE = {
    mapa: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
    timeline: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5-6-3.5z" fill="currentColor"/></svg>',
    alertas: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
    busca: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  };

  /* ---------------- barra de abas (celular) + botão de busca no topo ---------------- */
  const abas = document.createElement('nav');
  abas.className = 'abas-inferiores';
  abas.setAttribute('aria-label', 'Navegação');
  abas.innerHTML = [
    ['mapa', './', 'Mapa'], ['timeline', 'timeline.html', 'Timeline'], ['alertas', 'alertas.html', 'Alertas'],
  ].map(([id, href, rot]) => `<a href="${href}" class="${pagina === id ? 'ativa' : ''}"${pagina === id ? ' aria-current="page"' : ''}>${ICONE[id]}${rot}</a>`).join('')
    + `<button type="button" data-busca>${ICONE.busca.replace('width="18" height="18"', '')}Buscar</button>`;
  document.body.appendChild(abas);

  const direita = $('.header-right');
  if (direita) {
    const b = document.createElement('button');
    b.className = 'icon-btn btn-busca-topo';
    b.type = 'button';
    b.title = 'Buscar veículo, área, rua ou evento ( / )';
    b.setAttribute('aria-label', 'Buscar');
    b.dataset.busca = '';
    b.innerHTML = ICONE.busca;
    direita.insertBefore(b, $('#btnTema', direita) ?? null);
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-busca]')) abrirBusca(); });

  // no celular o cabeçalho mostra o nome da página, não o nome longo do sistema
  const marca = $('.brand-text');
  if (marca) {
    const t = document.createElement('div'); // div: o CSS esconde os span do subtítulo
    t.className = 'titulo-pagina';
    t.textContent = { mapa: 'Localização', timeline: 'Timeline', alertas: 'Alertas' }[pagina] ?? '';
    marca.appendChild(t);
  }
  // chip "atualizado 12:05:39 · a cada 5 min" -> no celular só "12:05"
  const chip = $('#chipAtualizacao');
  const txt = $('#txtAtualizacao');
  if (chip && txt) {
    const curto = () => {
      const h = txt.textContent.match(/\d{2}:\d{2}/);
      if (h) chip.dataset.curto = h[0]; else delete chip.dataset.curto;
      chip.title = txt.textContent;
    };
    new MutationObserver(curto).observe(txt, { childList: true, characterData: true, subtree: true });
    curto();
  }

  /* ---------------- busca geral ---------------- */
  const CORES = { 1: '#16a34a', 3: '#ca8a04', 2: '#dc2626', 4: '#dc2626', 71: '#dc2626', 98: '#dc2626', 5: '#ea580c', 9: '#ea580c', 7: '#6b7280' };
  const TIPO_CERCA = { area: 'Área', via: 'Rua / via', planta: 'Planta' };
  let dados = null;
  let dadosEm = 0;
  let foco = -1;

  const fundo = document.createElement('div');
  fundo.className = 'bg-fundo';
  fundo.hidden = true;
  fundo.innerHTML = `<div class="bg-caixa" role="dialog" aria-modal="true" aria-label="Buscar">
      <div class="bg-linha">${ICONE.busca}
        <input class="bg-input" type="search" placeholder="Placa, motorista, vaga, área, rua…" autocomplete="off" enterkeyhint="search" aria-label="Buscar">
        <button class="bg-fechar" type="button">Fechar</button></div>
      <div class="bg-resultados" role="listbox"></div></div>`;
  document.body.appendChild(fundo);
  const entrada = $('.bg-input', fundo);
  const lista = $('.bg-resultados', fundo);
  $('.bg-fechar', fundo).onclick = fecharBusca;
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fecharBusca(); });

  async function carregar() {
    if (dados && Date.now() - dadosEm < 60000) return dados;
    const json = (u) => fetch(u).then((r) => r.json()).catch(() => null);
    const [snap, cercas, eventos] = await Promise.all([json('/api/estado'), json('/api/cercas'), json(`/api/eventos?dia=${hoje()}`)]);
    dados = {
      veiculos: (snap?.veiculos ?? []).filter((v) => !v.motor2_de),
      cercas: Array.isArray(cercas) ? cercas : [],
      eventos: Array.isArray(eventos) ? eventos : [],
    };
    dadosEm = Date.now();
    return dados;
  }

  function lerRecentes() { try { return JSON.parse(localStorage.getItem('gps-buscas') || '[]'); } catch { return []; } }
  function guardarRecente(t) {
    t = t.trim();
    if (t.length < 2) return;
    try { localStorage.setItem('gps-buscas', JSON.stringify([t, ...lerRecentes().filter((x) => x !== t)].slice(0, 8))); } catch {}
  }

  async function abrirBusca(texto = '') {
    fundo.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    entrada.value = texto;
    entrada.focus();
    lista.innerHTML = '<div class="bg-vazio">Carregando…</div>';
    await carregar();
    renderBusca();
  }
  function fecharBusca() {
    fundo.hidden = true;
    document.documentElement.style.overflow = '';
  }

  const marcar = (txt, q) => {
    const i = norm(txt).indexOf(norm(q));
    if (!q || i < 0) return esc(txt);
    return esc(txt.slice(0, i)) + '<mark>' + esc(txt.slice(i, i + q.length)) + '</mark>' + esc(txt.slice(i + q.length));
  };
  const destinoPadrao = pagina === 'timeline' ? 'timeline' : 'mapa';

  function itemVeiculo(v, q) {
    const onde = v.area || v.via || 'fora de cerca';
    const m2 = v.motor2 ? ` · ⚙ 2º ${v.motor2.status}` : '';
    const outro = destinoPadrao === 'mapa' ? ['timeline', 'Timeline'] : ['mapa', 'Mapa'];
    return `<div class="bg-item" role="option" tabindex="-1" data-v="${esc(v.id)}" data-destino="${destinoPadrao}">
      <span class="pt" style="--c:${CORES[v.status_cod] ?? '#7c3aed'}"></span>
      <span class="tit">${marcar(v.placa, q)}${v.motor2 ? ` <small style="color:var(--text-3);font-weight:600">⚙ ${marcar(v.motor2.placa, q)}</small>` : ''}</span>
      <span class="sub">${esc(v.status)}${esc(m2)} · ${esc(v.vaga || 'sem vaga')} · ${esc(onde)}${v.motorista ? ' · ' + esc(v.motorista) : ''}</span>
      <span class="bg-acoes"><button class="bg-acao" type="button" data-v="${esc(v.id)}" data-destino="${outro[0]}">${outro[1]}</button></span>
    </div>`;
  }
  function itemCerca(c, ocupacao, q) {
    const n = ocupacao[c.name] ?? 0;
    return `<div class="bg-item" role="option" tabindex="-1" data-cerca="${esc(c.name)}">
      <span class="pt area" style="--c:${esc(c.color || '#64748b')}"></span>
      <span class="tit">${marcar(c.name, q)}</span>
      <span class="sub">${TIPO_CERCA[c.tipo] ?? 'Cerca'}${n ? ` · ${n} veículo${n > 1 ? 's' : ''} agora` : ''}</span>
    </div>`;
  }
  function textoEvento(e) {
    const quem = e.motor2 ? `${e.principal ?? e.placa} ⚙ motor 2º` : e.placa;
    const o = { entrada: `entrou em ${e.area}`, saida: `saiu de ${e.area}`, status: `${e.de} → ${e.para}`, sinal_perdido: 'sem sinal', sinal_retomado: 'voltou a comunicar' }[e.tipo] ?? e.tipo;
    return { quem, o };
  }
  function itemEvento(e, q) {
    const { quem, o } = textoEvento(e);
    const h = new Date(e.t).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `<div class="bg-item" role="option" tabindex="-1" data-v="${esc(e.principal_id ?? e.id)}" data-destino="${destinoPadrao}">
      <span class="pt" style="--c:#94a3b8"></span>
      <span class="tit">${marcar(quem, q)} <small style="color:var(--text-3);font-weight:600">${h}</small></span>
      <span class="sub">${marcar(o, q)}</span>
    </div>`;
  }

  function renderBusca() {
    const q = entrada.value.trim();
    const { veiculos, cercas, eventos } = dados;
    const ocupacao = {};
    veiculos.forEach((v) => { if (v.area) ocupacao[v.area] = (ocupacao[v.area] ?? 0) + 1; });
    let html = '';

    if (!q) {
      const rec = lerRecentes();
      if (rec.length) html += `<div class="bg-secao">Buscas recentes</div><div class="bg-recentes">${rec.map((r) => `<button type="button" data-recente="${esc(r)}">${esc(r)}</button>`).join('')}</div>`;
      const ligados = veiculos.filter((v) => v.status_cod === 1 || v.status_cod === 3 || v.motor2?.status_cod === 1);
      if (ligados.length) html += `<div class="bg-secao"><span>Ligados agora</span><span>${ligados.length}</span></div>` + ligados.slice(0, 8).map((v) => itemVeiculo(v, '')).join('');
      const cheias = Object.entries(ocupacao).sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([nome]) => cercas.find((c) => c.name === nome)).filter(Boolean);
      if (cheias.length) html += '<div class="bg-secao">Áreas com mais veículos</div>' + cheias.map((c) => itemCerca(c, ocupacao, '')).join('');
      html += '<div class="bg-dica">Busque por placa (com ou sem hífen), motor secundário, motorista, vaga, área, rua ou evento.</div>';
      lista.innerHTML = html;
      foco = -1;
      return;
    }

    const qn = norm(q);
    const qp = normPlaca(q);
    const pontua = (v) => {
      const p = normPlaca(v.placa);
      const p2 = normPlaca(v.motor2?.placa);
      if (qp.length >= 2 && (p.startsWith(qp) || p2.startsWith(qp))) return 3;
      if (qp.length >= 2 && (p.includes(qp) || p2.includes(qp))) return 2;
      if (norm([v.vaga, v.motorista, v.area, v.via, v.grupo, v.status].join(' ')).includes(qn)) return 1;
      return 0;
    };
    const achadosV = veiculos.map((v) => [v, pontua(v)]).filter(([, s]) => s).sort((a, b) => b[1] - a[1] || a[0].placa.localeCompare(b[0].placa)).map(([v]) => v);
    const achadosC = cercas.filter((c) => c.polygon?.length >= 3 && norm(c.name).includes(qn))
      .sort((a, b) => (ocupacao[b.name] ?? 0) - (ocupacao[a.name] ?? 0) || a.name.localeCompare(b.name));
    const achadosE = eventos.filter((e) => { const { quem, o } = textoEvento(e); return norm(`${quem} ${o} ${e.area ?? ''}`).includes(qn); })
      .sort((a, b) => b.t.localeCompare(a.t));

    if (achadosV.length) html += `<div class="bg-secao"><span>Veículos</span><span>${achadosV.length}</span></div>` + achadosV.slice(0, 20).map((v) => itemVeiculo(v, q)).join('');
    if (achadosC.length) html += `<div class="bg-secao"><span>Áreas, ruas e cercas</span><span>${achadosC.length}</span></div>` + achadosC.slice(0, 15).map((c) => itemCerca(c, ocupacao, q)).join('');
    if (achadosE.length) html += `<div class="bg-secao"><span>Eventos de hoje</span><span>${achadosE.length}</span></div>` + achadosE.slice(0, 12).map((e) => itemEvento(e, q)).join('');
    lista.innerHTML = html || `<div class="bg-vazio">Nada encontrado para “${esc(q)}”.</div>`;
    foco = -1;
  }

  entrada.addEventListener('input', () => { if (dados) renderBusca(); });
  entrada.addEventListener('keydown', (e) => {
    const itens = [...lista.querySelectorAll('.bg-item')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      foco = Math.max(0, Math.min(itens.length - 1, foco + (e.key === 'ArrowDown' ? 1 : -1)));
      itens.forEach((el, i) => el.classList.toggle('foco', i === foco));
      itens[foco]?.scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter') {
      (itens[foco] ?? itens[0])?.click();
    } else if (e.key === 'Escape') {
      fecharBusca();
    }
  });
  lista.addEventListener('click', (e) => {
    const rec = e.target.closest('[data-recente]');
    if (rec) { entrada.value = rec.dataset.recente; renderBusca(); return; }
    const alvo = e.target.closest('[data-v], [data-cerca]');
    if (!alvo) return;
    guardarRecente(entrada.value);
    fecharBusca();
    if (alvo.dataset.cerca != null) irCerca(alvo.dataset.cerca);
    else irVeiculo(alvo.dataset.v, alvo.dataset.destino);
  });
  document.addEventListener('keydown', (e) => {
    const digitando = e.target.closest?.('input, textarea, select, [contenteditable]');
    if ((e.key === '/' && !digitando) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) {
      e.preventDefault();
      abrirBusca();
    }
  });

  function irVeiculo(id, destino) {
    if (destino === 'timeline') { location.href = `timeline.html?v=${encodeURIComponent(id)}&dia=${hoje()}`; return; }
    if (pagina === 'mapa' && typeof abrirDetalhe === 'function') { abrirDetalhe(id); return; }
    location.href = `./#v=${encodeURIComponent(id)}`;
  }
  function irCerca(nome) {
    if (pagina === 'mapa') focarCerca(nome);
    else location.href = `./#cerca=${encodeURIComponent(nome)}`;
  }

  /* ======================= Localização: gaveta + cercas ======================= */
  let alturaFolha = () => 0;
  let definirFolha = () => {};

  function focarCerca(nome) {
    if (typeof S === 'undefined' || typeof mapa === 'undefined') return;
    const c = (S.cercas ?? []).find((x) => x.name === nome);
    if (!c) return;
    if (S.sel && typeof fecharDetalhe === 'function') fecharDetalhe();
    // destaque temporário do contorno
    const destaque = L.polygon(c.polygon, { color: '#facc15', weight: 5, fill: false, className: 'cerca-achada', interactive: false }).addTo(mapa);
    setTimeout(() => mapa.removeLayer(destaque), 7000);
    if (S.snap?.veiculos.some((v) => v.area === nome)) {
      S.filtro.area = nome;
      if (typeof trocarAba === 'function') trocarAba('veiculos');
      if (typeof render === 'function') render();
    }
    if (celular.matches) definirFolha('fechada');
    mapa.fitBounds(L.latLngBounds(c.polygon), { paddingTopLeft: [20, 20], paddingBottomRight: [20, 20 + alturaFolha()], maxZoom: 18 });
  }

  if (pagina === 'mapa') {
    /* Gaveta do mapa no celular - o foco é o mapa:
       fechada (padrão): só uma barra com o resumo da frota em números tocáveis,
         ou o cartão do caminhão selecionado;
       meio / cheia: lista, áreas, eventos e detalhe completo.
       Tocar no mapa recolhe a gaveta; escolher um caminhão NÃO abre a gaveta, mostra
       o cartão dele e centraliza no mapa. */
    const painel = $('#painel');
    const layout = $('.layout');
    const alca = document.createElement('div');
    alca.className = 'folha-alca';
    alca.setAttribute('role', 'button');
    alca.setAttribute('aria-label', 'Arrastar para ver mais ou menos da lista');
    const resumo = document.createElement('div');
    resumo.className = 'folha-resumo';
    painel.prepend(alca, resumo);

    let estado = 'fechada';
    const alturas = () => {
      const max = Math.max(260, layout.getBoundingClientRect().height - 6);
      const fechada = alca.offsetHeight + resumo.offsetHeight + 6;
      return { fechada, meio: Math.round(max * 0.5), cheia: max };
    };
    alturaFolha = () => (celular.matches ? painel.getBoundingClientRect().height : 0);
    definirFolha = (e) => {
      if (!celular.matches) return;
      estado = e;
      painel.dataset.estado = e;
      painel.style.setProperty('--folha-h', alturas()[e] + 'px');
    };

    /* ---- barra de resumo (o que aparece com a gaveta fechada) ---- */
    const RESUMO = [
      ['ligado', 'ligados', '#16a34a'], ['parado', 'parados lig.', '#ca8a04'], ['motor2', '⚙ 2º ligado', '#0891b2'],
      ['desligado', 'desligados', '#dc2626'], ['manut', 'manutenção', '#ea580c'], ['semsinal', 'sem sinal', '#6b7280'],
    ];
    const idade = (iso) => {
      if (!iso) return '';
      const m = Math.max(0, (Date.now() - new Date(iso)) / 60000);
      return m < 1 ? 'agora' : m < 60 ? `há ${Math.floor(m)}min` : m < 1440 ? `há ${Math.floor(m / 60)}h` : `há ${Math.floor(m / 1440)}d`;
    };
    function renderResumo() {
      if (typeof S === 'undefined' || !S.snap) return;
      const v = S.sel && S.snap.veiculos.find((x) => x.id === S.sel);
      if (v) {
        const cor = { 1: '#16a34a', 3: '#ca8a04', 5: '#ea580c', 9: '#ea580c', 7: '#6b7280' }[v.status_cod] ?? '#dc2626';
        resumo.innerHTML = `<div class="fr-card" data-acao="abrir">
            <span class="fr-pt" style="--c:${cor}"></span>
            <b class="fr-placa">${esc(v.placa)}</b>
            <span class="fr-linha">${esc(v.status)}${v.motor2?.status_cod === 1 ? ' · ⚙ 2º ligado' : ''} · ${idade(v.posicao_em)}<br>${esc(v.area || v.via || 'fora de cerca')}</span>
            <span class="fr-acoes">
              <a class="fr-btn" href="timeline.html?v=${encodeURIComponent(v.id)}&dia=${hoje()}" aria-label="Timeline de ${esc(v.placa)}">▶</a>
              <button class="fr-btn" type="button" data-acao="fechar" aria-label="Fechar">✕</button>
            </span></div>`;
      } else {
        const vs = S.snap.veiculos;
        const n = Object.fromEntries(RESUMO.map(([k]) => [k, vs.filter(KPIS.find((x) => x.id === k).filtro).length]));
        const area = S.filtro.area ? `<button class="fr-chip ativo" type="button" data-acao="limpar-area" style="--c:#facc15"><i></i>${esc(S.filtro.area === '__fora' ? 'Fora de área' : S.filtro.area)} ✕</button>` : '';
        resumo.innerHTML = `<button class="fr-total" type="button" data-acao="lista"><b>${vs.length}</b> veículos</button>`
          + RESUMO.filter(([k]) => n[k]).map(([k, rot, c]) =>
            `<button class="fr-chip${S.filtro.kpi === k ? ' ativo' : ''}" type="button" data-kpi="${k}" style="--c:${c}"><i></i><b>${n[k]}</b> ${rot}</button>`).join('')
          + area;
      }
      if (estado === 'fechada') definirFolha('fechada'); // a altura acompanha o conteúdo
    }
    resumo.addEventListener('click', (e) => {
      const alvo = e.target.closest('[data-kpi], [data-acao]');
      if (!alvo || alvo.tagName === 'A') return;
      const acao = alvo.dataset.acao;
      if (alvo.dataset.kpi) {
        // toque num número = filtra a lista por ele e mostra a lista
        S.filtro.kpi = S.filtro.kpi === alvo.dataset.kpi ? null : alvo.dataset.kpi;
        trocarAba('veiculos');
        render();
        definirFolha('meio');
      } else if (acao === 'fechar') {
        fecharDetalhe();
        definirFolha('fechada');
      } else if (acao === 'limpar-area') {
        S.filtro.area = null;
        render();
      } else {
        definirFolha('meio'); // "51 veículos" ou o cartão do caminhão: abre a gaveta
      }
    });
    if (typeof render === 'function') {
      const renderOriginal = render;
      window.render = function () { renderOriginal(); renderResumo(); };
    }
    setInterval(renderResumo, 30000); // "há X min" envelhece mesmo sem leitura nova

    /* ---- arrastar pela alça, pela barra de resumo ou pelo topo da lista ---- */
    let ini = null;
    const inicio = (ev) => {
      if (!celular.matches || ev.target.closest('input, select, a, .chip')) return;
      ini = { y: ev.clientY, h: painel.getBoundingClientRect().height, t: performance.now(), moveu: false };
      painel.classList.add('arrastando');
    };
    const mover = (ev) => {
      if (!ini) return;
      const dy = ini.y - ev.clientY;
      if (Math.abs(dy) > 6 && !ini.moveu) { ini.moveu = true; ev.currentTarget.setPointerCapture(ev.pointerId); }
      if (!ini.moveu) return;
      const a = alturas();
      painel.style.setProperty('--folha-h', Math.max(a.fechada - 20, Math.min(a.cheia, ini.h + dy)) + 'px');
    };
    const fim = (ev) => {
      if (!ini) return;
      painel.classList.remove('arrastando');
      const ordem = ['fechada', 'meio', 'cheia'];
      if (!ini.moveu) {
        // toque sem arrastar: só a alça alterna; nos botões o clique segue normal
        if (ev.currentTarget === alca) definirFolha(estado === 'fechada' ? 'meio' : 'fechada');
        ini = null;
        return;
      }
      const a = alturas();
      const h = painel.getBoundingClientRect().height;
      const vel = (ini.y - ev.clientY) / Math.max(1, performance.now() - ini.t); // px/ms, + = para cima
      let alvo = ordem.reduce((m, k) => (Math.abs(a[k] - h) < Math.abs(a[m] - h) ? k : m), 'fechada');
      if (Math.abs(vel) > 0.5) {
        const i = ordem.indexOf(estado);
        alvo = ordem[Math.max(0, Math.min(2, i + (vel > 0 ? 1 : -1)))];
      }
      definirFolha(alvo);
      painel.dataset.arrastou = '1';
      setTimeout(() => delete painel.dataset.arrastou, 80);
      ini = null;
    };
    for (const el of [alca, resumo, $('.painel-topo', painel)]) {
      if (!el) continue;
      el.addEventListener('pointerdown', inicio);
      el.addEventListener('pointermove', mover);
      el.addEventListener('pointerup', fim);
      el.addEventListener('pointercancel', fim);
    }
    // depois de arrastar, o clique que o navegador gera no fim não pode acionar botão
    resumo.addEventListener('click', (e) => { if (painel.dataset.arrastou) { e.stopImmediatePropagation(); delete painel.dataset.arrastou; } }, true);

    // no toque o nome da cerca abre e não fecha mais (não há "mouse saindo"): some sozinho
    mapa.on('tooltipopen', (e) => {
      if (celular.matches) setTimeout(() => mapa.closeTooltip(e.tooltip), 2500);
    });

    // tocar no mapa = foco no mapa: recolhe a gaveta
    $('#mapa').addEventListener('pointerdown', () => { if (celular.matches && estado !== 'fechada') definirFolha('fechada'); });

    const aplicar = () => {
      if (celular.matches) definirFolha(estado);
      else painel.style.removeProperty('--folha-h');
      try { mapa.invalidateSize(); } catch {}
    };
    celular.addEventListener('change', aplicar);
    addEventListener('resize', () => { if (celular.matches) definirFolha(estado); });
    aplicar();

    // ao escolher um caminhão: cartão na barra + caminhão centralizado acima dela
    if (typeof abrirDetalhe === 'function') {
      const original = abrirDetalhe;
      window.abrirDetalhe = function (id) {
        original(id);
        if (!celular.matches) return;
        renderResumo();
        definirFolha('fechada');
        // zoom 18: acima do limite de agrupamento (o selecionado nunca some num cluster);
        // centro deslocado para o caminhão ficar no meio da área visível, acima do cartão
        const v = S.snap?.veiculos.find((x) => x.id === id);
        if (v?.lat) {
          const z = Math.max(mapa.getZoom(), 18);
          const centro = mapa.project([v.lat, v.lng], z).add([0, alturas().fechada / 2]);
          mapa.flyTo(mapa.unproject(centro, z), z, { duration: 0.8 });
        }
      };
    }

    // link vindo da busca de outra página: ./#cerca=NOME
    const cercaHash = new URLSearchParams(location.hash.slice(1)).get('cerca');
    if (cercaHash) {
      const espera = setInterval(() => {
        if (typeof S !== 'undefined' && S.snap?.veiculos?.length && S.cercas?.length) {
          clearInterval(espera);
          setTimeout(() => focarCerca(cercaHash), 400);
        }
      }, 300);
      setTimeout(() => clearInterval(espera), 20000);
    }
  }

  /* ======================= Timeline no celular: player sobre o mapa =======================
     O mapa ocupa a tela; embaixo um player (horário + situação, barra colorida arrastável,
     ⏮ deslocamento anterior · ▶ · próximo deslocamento ⏭ · velocidade · ☰ opções) e as
     opções (veículo, dia, acelerar paradas, seguir) numa gaveta retrátil. Apontamento,
     resumo e tempo por área ficam no computador.
     Os controles são os MESMOS da página (mesmos ids, já ligados ao Player): aqui eles só
     mudam de lugar. Cada "Ver timeline" recria os controles no painel; o observador os
     traz de volta para o player. */
  if (pagina === 'timeline') {
    celular.addEventListener('change', () => location.reload()); // troca de layout: monta de novo
  }
  if (pagina === 'timeline' && celular.matches) {
    document.body.classList.add('tl-player');
    const wrap = $('.tl-mapa-wrap');
    const corpo = $('#tlCorpo');
    const segDe = (hms) => { const [a, b, c] = hms.split(':').map(Number); return a * 3600 + b * 60 + (c || 0); };

    const pilula = document.createElement('button');
    pilula.type = 'button';
    pilula.className = 'mp-veiculo';
    wrap.appendChild(pilula);

    const barra = document.createElement('div');
    barra.className = 'mp-barra';
    barra.innerHTML = `
      <div class="mp-status" hidden><span class="mp-status-txt"></span><span class="mp-espera" data-espera-historico></span>
        <button type="button" class="mp-escolher" data-mp="opcoes">⚙ Escolher veículo e dia</button></div>
      <div class="mp-player" hidden>
        <div class="mp-info"></div>
        <div class="mp-scrub"></div>
        <div class="mp-controles">
          <button type="button" class="mp-btn" data-mp="ant" title="Deslocamento anterior" aria-label="Deslocamento anterior">⏮</button>
          <span class="mp-play"></span>
          <button type="button" class="mp-btn" data-mp="prox" title="Próximo deslocamento" aria-label="Próximo deslocamento">⏭</button>
          <span class="mp-vel"></span>
          <button type="button" class="mp-btn" data-mp="opcoes" title="Opções" aria-label="Opções do Player">⚙</button>
        </div>
      </div>`;
    wrap.appendChild(barra);

    const backdrop = document.createElement('div');
    backdrop.className = 'mp-opcoes-backdrop';
    document.body.appendChild(backdrop);

    const opcoes = document.createElement('div');
    opcoes.className = 'mp-opcoes';
    opcoes.innerHTML = `
      <div class="folha-alca" style="margin: -4px 0 8px; cursor: pointer;"></div>
      <div class="mp-opcoes-topo"><span>Opções do Player</span><button type="button" class="mp-btn" data-mp="fechar" aria-label="Fechar">✕</button></div>
      <div class="mp-slot-busca"></div>
      <div class="mp-slot-checks"></div>
      <p class="mp-nota">O mapa é o foco principal no celular. Detalhes completos e relatórios CSV ficam disponíveis no PC.</p>`;
    document.body.appendChild(opcoes);

    const abrirOpcoes = (sim) => {
      opcoes.classList.toggle('aberta', sim);
      backdrop.classList.toggle('aberta', sim);
    };
    backdrop.addEventListener('click', () => abrirOpcoes(false));
    $('.folha-alca', opcoes)?.addEventListener('click', () => abrirOpcoes(false));

    $('.mp-slot-busca', opcoes).appendChild($('.tl-topo')); // veículo, dia e "Ver timeline"
    $('#btnCarregar')?.addEventListener('click', () => abrirOpcoes(false));

    function atualizarPilula() {
      const placa = typeof S !== 'undefined' && S.sel?.placa;
      const sel = $('#diaSel');
      const dia = sel?.selectedOptions?.[0]?.textContent ?? '';
      pilula.innerHTML = placa
        ? `<span>🚗 <b>${esc(placa)}</b> · ${esc(dia)}</span><span class="mp-tag-opt">Opções ⚙</span>`
        : `<span> Escolher veículo</span><span class="mp-tag-opt">Opções ⚙</span>`;
    }

    // move para o player os controles que a página acabou de (re)criar
    function trazerControles() {
      const pares = [['#playInfo', '.mp-info'], ['#barraTempo', '.mp-scrub'], ['#barraM2', '.mp-scrub'], ['#btnPlay', '.mp-play'], ['#velPlay', '.mp-vel']];
      let trouxe = false;
      for (const [sel, slot] of pares) {
        const novo = $(sel, corpo);
        if (!novo) continue;
        const destino = $(slot, barra);
        if (slot !== '.mp-scrub') destino.replaceChildren(novo);
        else { destino.querySelector(sel)?.remove(); destino.appendChild(novo); }
        trouxe = true;
      }
      const play = $('#btnPlay', barra);
      if (play && !play.dataset.observado) {
        play.dataset.observado = '1';
        const marcar = () => play.toggleAttribute('data-tocando', play.textContent.includes('Pausar'));
        new MutationObserver(marcar).observe(play, { childList: true, characterData: true, subtree: true });
        marcar();
      }
      const checks = ['#pularParadas', '#seguirPlay'].map((s) => $(s, corpo)?.closest('label')).filter(Boolean);
      if (checks.length) $('.mp-slot-checks', opcoes).replaceChildren(...checks);
      return trouxe;
    }

    function sincronizar() {
      atualizarPilula();
      const status = $('.mp-status', barra);
      const player = $('.mp-player', barra);
      if (trazerControles() || (S?.hist?.pontos?.length && $('#btnPlay', barra))) {
        status.hidden = true;
        player.hidden = false;
        return;
      }
      // sem histórico na tela: carregando, vazio ou erro - repete a mensagem do painel
      player.hidden = true;
      status.hidden = false;
      const carregando = !!$('.spin', corpo);
      $('.mp-status-txt', barra).textContent = carregando
        ? 'Buscando o histórico…'
        : ($('.tl-vazio-titulo', corpo)?.textContent ?? 'Escolha um veículo') + ' ' + ($('.tl-vazio-sub', corpo)?.textContent ?? '');
      $('.mp-espera', barra).hidden = !carregando;
      $('.mp-escolher', barra).hidden = carregando;
    }
    new MutationObserver(sincronizar).observe(corpo, { childList: true });
    $('#diaSel')?.addEventListener('change', atualizarPilula);
    sincronizar();
    if (!new URLSearchParams(location.search).get('v')) abrirOpcoes(true);

    // ⏮ / ⏭: pula para o início do deslocamento anterior/seguinte (sem assistir parada longa)
    function pular(direcao) {
      const trechos = S?.hist?.trechos ?? [];
      const agora = Player.tempo();
      const inicios = trechos.filter((t) => t.estado === 'movimento').map((t) => segDe(t.inicio.slice(11, 19)));
      const alvo = direcao > 0 ? inicios.find((s) => s > agora + 1) : [...inicios].reverse().find((s) => s < agora - 2);
      if (alvo != null) Player.irPara(alvo, !Player.tocando());
    }
    const clique = (e) => {
      const b = e.target.closest('[data-mp]');
      if (!b) return;
      const acao = b.dataset.mp;
      if (acao === 'opcoes') abrirOpcoes(!opcoes.classList.contains('aberta'));
      else if (acao === 'fechar') abrirOpcoes(false);
      else if (acao === 'ant') pular(-1);
      else if (acao === 'prox') pular(1);
    };
    barra.addEventListener('click', clique);
    opcoes.addEventListener('click', clique);
    // ▶ com o mapa afastado (rota do dia inteiro): aproxima no caminhão; daí o Player acompanha
    barra.addEventListener('click', (e) => {
      if (!e.target.closest('#btnPlay')) return;
      setTimeout(() => {
        const p = Player.posicao?.();
        if (Player.tocando() && p && mapa.getZoom() < 16) mapa.setView(p, 16, { animate: true });
      }, 0);
    });
    pilula.addEventListener('click', () => abrirOpcoes(true));
    // tocar no mapa fecha as opções (o foco é o mapa)
    $('#mapa').addEventListener('pointerdown', () => abrirOpcoes(false));
    setTimeout(() => { try { mapa.invalidateSize(); } catch {} }, 100);
  }

  /* ======================= Alertas: detalhe por cima da lista ======================= */
  if (pagina === 'alertas') {
    const det = $('.al-detalhe');
    if (det) {
      const voltar = document.createElement('button');
      voltar.type = 'button';
      voltar.className = 'btn btn-neutro al-voltar';
      voltar.style.cssText = 'margin:8px 12px 0;align-self:flex-start;min-height:40px';
      voltar.textContent = '← Voltar para a lista';
      voltar.onclick = () => document.body.classList.remove('detalhe-aberto');
      det.prepend(voltar);
      $('#alCorpo')?.addEventListener('click', (e) => {
        if (celular.matches && e.target.closest('.al-item')) document.body.classList.add('detalhe-aberto');
      });
    }
  }

  // o layout muda depois que a página montou o mapa: recalcula o tamanho
  setTimeout(() => { try { mapa.invalidateSize(); } catch {} }, 300);
})();
