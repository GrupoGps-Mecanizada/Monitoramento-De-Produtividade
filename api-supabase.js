/* Adaptador GitHub Pages <-> Supabase.
   As páginas foram feitas para o servidor local (automation/monitoramento/server.js),
   que respondia /api/estado, /api/eventos... e empurrava atualizações por
   /api/stream (SSE). No GitHub Pages não há servidor: este arquivo atende as mesmas
   chamadas lendo do Supabase PRODUTIVIDADE (chave publishable, só leitura + pedido
   de histórico, ver supabase/schema.sql), com os mesmos formatos de resposta.
   Carregar DEPOIS do supabase-js e ANTES do script da página. */
(() => {
  const SUPABASE_URL = 'https://mfsyrsegkvjmefcdaegh.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_rw878qLgcmUdixI8QsejBA_lSXYAsIv';
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

  // o coletor roda no GitHub Actions a cada ~5 min; histórico de hoje mais velho que
  // isso pede atualização (dia encerrado é definitivo)
  const HISTORICO_FRESCO_MS = 10 * 60 * 1000;
  const ESPERA_HISTORICO_MS = 25 * 60 * 1000;

  const pad = (n) => String(n).padStart(2, '0');
  const diaLocal = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const resposta = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json' } });

  async function ok(promessa) {
    const { data, error } = await promessa;
    if (error) throw new Error(error.message);
    return data;
  }

  async function estado() {
    const r = await ok(db.from('loc_kv').select('valor').eq('chave', 'snapshot').maybeSingle());
    return r?.valor ?? { lido_em: null, erro: null, intervalo_s: 300, sem_sinal_min: 30, veiculos: [] };
  }

  async function cercas() {
    const r = await ok(db.from('loc_kv').select('valor').eq('chave', 'cercas').maybeSingle());
    return r?.valor?.cercas ?? [];
  }

  async function eventos(dia, id) {
    let q = db.from('loc_eventos').select('dados').eq('dia', dia).order('t').limit(5000);
    if (id) q = q.eq('veiculo_id', id);
    return (await ok(q)).map((r) => r.dados);
  }

  async function dias() {
    return (await ok(db.from('loc_dias').select('dia').order('dia', { ascending: false }).limit(120))).map((r) => r.dia);
  }

  async function lerHistorico(id, dia) {
    return ok(db.from('loc_historico').select('resultado, baixado_em, fechado').eq('veiculo_id', id).eq('dia', dia).maybeSingle());
  }

  async function pedirHistorico(id, dia) {
    const { error } = await db.from('loc_pedidos').insert({ veiculo_id: id, dia });
    // 23505 = já existe pedido em aberto para esse veículo/dia: é só esperar ele
    if (error && error.code !== '23505') throw new Error(error.message);
  }

  /* Histórico: se já está no banco e é definitivo/recente, devolve na hora. Senão
     deixa um pedido para o coletor (GitHub Actions) e espera ele ficar pronto. */
  async function historico(id, dia) {
    const atual = await lerHistorico(id, dia);
    const fresco = atual?.resultado && (atual.fechado || Date.now() - new Date(atual.baixado_em) < HISTORICO_FRESCO_MS);
    if (fresco) return { ...atual.resultado, fonte: 'cache' };
    await pedirHistorico(id, dia);
    // tem versão antiga de hoje: mostra já, a nova chega no próximo ciclo
    if (atual?.resultado) return { ...atual.resultado, fonte: 'cache', aviso: 'atualização pedida ao coletor' };

    // mostra o andamento em qualquer elemento [data-espera-historico] da página
    const inicio = Date.now();
    const andamento = (status) => {
      const s = Math.round((Date.now() - inicio) / 1000);
      const t = s < 60 ? `${s}s` : `${Math.floor(s / 60)}min ${String(s % 60).padStart(2, '0')}s`;
      const etapa = status === 'processando' ? 'o coletor está buscando no GAUSS agora' : 'na fila do coletor';
      document.querySelectorAll('[data-espera-historico]').forEach((el) => { el.textContent = `Pedido ${etapa} · ${t}`; });
    };
    const relogio = setInterval(() => andamento(), 1000);
    try {
      const limite = Date.now() + ESPERA_HISTORICO_MS;
      while (Date.now() < limite) {
        await sleep(6000);
        const ped = await ok(db.from('loc_pedidos').select('status, erro').eq('veiculo_id', id).eq('dia', dia)
          .order('criado_em', { ascending: false }).limit(1).maybeSingle());
        andamento(ped?.status);
        if (ped?.status === 'erro') throw new Error(ped.erro || 'o coletor não conseguiu buscar o histórico');
        if (ped?.status === 'pronto') {
          const novo = await lerHistorico(id, dia);
          if (novo?.resultado) return novo.resultado; // fonte (gauss/incremental/cache) vem do coletor
        }
      }
      throw new Error('o coletor ainda não atendeu o pedido - confira se o workflow está rodando no GitHub Actions');
    } finally {
      clearInterval(relogio);
    }
  }

  async function rotear(url) {
    const u = new URL(url, location.href);
    const q = u.searchParams;
    const rota = u.pathname.replace(/^.*\/api\//, '');
    try {
      if (rota === 'estado') return resposta(await estado());
      if (rota === 'cercas') return resposta(await cercas());
      if (rota === 'dias') return resposta(await dias());
      if (rota === 'eventos') return resposta(await eventos(q.get('dia') || diaLocal(), q.get('id')));
      if (rota === 'historico') {
        const id = q.get('id') ?? '';
        const dia = q.get('dia') || diaLocal();
        if (!/^\d+$/.test(id) || !/^\d{4}-\d{2}-\d{2}$/.test(dia)) return resposta({ erro: 'parâmetros inválidos' }, 400);
        return resposta(await historico(id, dia));
      }
      return resposta({ erro: 'rota desconhecida' }, 404);
    } catch (err) {
      return resposta({ erro: err.message }, 502);
    }
  }

  const fetchOriginal = window.fetch.bind(window);
  window.fetch = (entrada, opcoes) => {
    const url = typeof entrada === 'string' ? entrada : entrada?.url ?? '';
    return url.startsWith('/api/') ? rotear(url) : fetchOriginal(entrada, opcoes);
  };

  /* /api/stream: em vez de SSE, Realtime do Supabase. Emite "estado" quando o coletor
     grava um retrato novo e "eventos" quando entram eventos. */
  const EventSourceOriginal = window.EventSource;
  class FonteSupabase {
    constructor() {
      this.readyState = 0;
      this.onerror = null;
      this.ouvintes = {};
      this.canal = null;
      this.timer = null;
      this.iniciar();
    }
    addEventListener(tipo, fn) { (this.ouvintes[tipo] ??= []).push(fn); }
    removeEventListener(tipo, fn) { this.ouvintes[tipo] = (this.ouvintes[tipo] ?? []).filter((f) => f !== fn); }
    emitir(tipo, dados) { for (const fn of this.ouvintes[tipo] ?? []) fn({ type: tipo, data: JSON.stringify(dados) }); }
    async enviarEstado() {
      try { this.emitir('estado', await estado()); } catch { this.onerror?.(new Event('error')); }
    }
    iniciar() {
      this.readyState = 1;
      this.enviarEstado();
      // relê o retrato inteiro (não confia no payload, que pode ser grande)
      this.canal = db.channel('loc-' + Math.random().toString(36).slice(2))
        .on('postgres_changes', { event: '*', schema: 'public', table: 'loc_kv', filter: 'chave=eq.snapshot' }, () => this.enviarEstado())
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'loc_eventos' }, (p) => { if (p.new?.dados) this.emitir('eventos', [p.new.dados]); })
        .subscribe((status) => { if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') this.onerror?.(new Event('error')); });
      // rede de segurança caso o Realtime perca alguma atualização
      this.timer = setInterval(() => this.enviarEstado(), 2 * 60 * 1000);
    }
    close() {
      this.readyState = 2;
      clearInterval(this.timer);
      if (this.canal) db.removeChannel(this.canal);
    }
  }
  window.EventSource = function (url, opcoes) {
    return String(url).startsWith('/api/stream') ? new FonteSupabase() : new EventSourceOriginal(url, opcoes);
  };
})();
