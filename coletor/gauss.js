import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { BASE_URL, CREDENTIALS } from './config.js';

const COMMON_HEADERS = {
  'X-Requested-With': 'XMLHttpRequest',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
};

// sem isso, uma conexão que trava (sem responder e sem erro) prende o fetch pra sempre -
// foi exatamente o que travou o script rodando via Task Scheduler
const REQUEST_TIMEOUT_MS = 30_000;

// --- boas práticas de acesso: o GAUSS não é nosso, a automação tem que pesar
// menos que uma pessoa usando o sistema ---
// uma requisição por vez (fila global do processo), com intervalo mínimo + jitter
const INTERVALO_MIN_MS = 2_000;
const JITTER_MS = 1_000;
// 429/503/timeout: espera crescente (5s, 10s, 20s), respeitando Retry-After
const BACKOFF_BASE_MS = 5_000;
const TENTATIVAS = 3;
// muitas falhas seguidas = para de insistir por um tempo (circuit breaker)
const FALHAS_PARA_PAUSAR = 5;
const PAUSA_MS = 10 * 60 * 1000;
// sessão reaproveitada entre execuções - evita um login a cada script. Só vale se
// foi usada com sucesso há pouco: não sabemos como o GAUSS responde a uma sessão
// expirada (pode ser um JSON de erro igual ao de "sem dados"), então sessão
// parada há mais que isso é descartada e faz login novo - como uma pessoa faria
const SESSAO_FILE = join(import.meta.dirname, '.sessao-gauss.json');
const SESSAO_OCIOSA_MS = 20 * 60 * 1000;
const GRAVAR_USO_A_CADA_MS = 60 * 1000;

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

let fila = Promise.resolve();
let ultimaRequisicao = 0;
let falhasSeguidas = 0;
let pausadoAte = 0;

/** Contadores para acompanhar a carga que geramos no GAUSS. */
export const estatisticas = { desde: new Date().toISOString(), requisicoes: 0, logins: 0, erros: 0, pausadoAte: null };

// serializa: a próxima só começa depois da anterior terminar + intervalo mínimo
function enfileirar(fn) {
  const tarefa = fila.then(async () => {
    if (Date.now() < pausadoAte) {
      throw new Error(`acesso ao GAUSS pausado até ${new Date(pausadoAte).toLocaleTimeString('pt-BR')} após falhas seguidas`);
    }
    const aguardar = ultimaRequisicao + INTERVALO_MIN_MS + Math.random() * JITTER_MS - Date.now();
    if (aguardar > 0) await espera(aguardar);
    try {
      return await fn();
    } finally {
      ultimaRequisicao = Date.now();
    }
  });
  fila = tarefa.catch(() => {});
  return tarefa;
}

async function fetchComBackoff(url, opcoes) {
  for (let tentativa = 1; ; tentativa++) {
    estatisticas.requisicoes++;
    let res;
    try {
      res = await fetch(url, { ...opcoes, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    } catch (err) {
      if (tentativa >= TENTATIVAS) throw registrarFalha(err);
      await espera(BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    if (res.status === 429 || res.status === 503) {
      if (tentativa >= TENTATIVAS) throw registrarFalha(new Error(`HTTP ${res.status} (servidor pediu para desacelerar)`));
      const retryAfter = Number(res.headers.get('retry-after'));
      await espera(retryAfter > 0 ? retryAfter * 1000 : BACKOFF_BASE_MS * 2 ** (tentativa - 1));
      continue;
    }
    falhasSeguidas = 0;
    return res;
  }
}

function registrarFalha(err) {
  estatisticas.erros++;
  if (++falhasSeguidas >= FALHAS_PARA_PAUSAR) {
    pausadoAte = Date.now() + PAUSA_MS;
    estatisticas.pausadoAte = new Date(pausadoAte).toISOString();
    falhasSeguidas = 0;
  }
  return err;
}

export class GaussFleetClient {
  #cookie = '';
  #usoGravadoEm = 0;

  constructor() {
    try {
      if (existsSync(SESSAO_FILE)) {
        const salva = JSON.parse(readFileSync(SESSAO_FILE, 'utf-8'));
        const usadaEm = new Date(salva.usada_em ?? salva.em).getTime();
        if (Date.now() - usadaEm < SESSAO_OCIOSA_MS) this.#cookie = salva.cookie ?? '';
      }
    } catch {
      this.#cookie = '';
    }
  }

  #gravarSessao(forcar = false) {
    if (!forcar && Date.now() - this.#usoGravadoEm < GRAVAR_USO_A_CADA_MS) return;
    this.#usoGravadoEm = Date.now();
    const agora = new Date().toISOString();
    let em = agora;
    try { em = JSON.parse(readFileSync(SESSAO_FILE, 'utf-8')).em ?? agora; } catch {}
    writeFileSync(SESSAO_FILE, JSON.stringify({ cookie: this.#cookie, em: forcar ? agora : em, usada_em: agora }), 'utf-8');
  }

  /** Reaproveita a sessão salva; só faz login de verdade se não houver uma (ou se forcar=true). */
  async login({ forcar = false } = {}) {
    if (this.#cookie && !forcar) return;
    if (!CREDENTIALS.username || !CREDENTIALS.password) {
      throw new Error('GAUSSFLEET_USERNAME / GAUSSFLEET_PASSWORD não configurados (.env).');
    }

    const body = new URLSearchParams({
      username: CREDENTIALS.username,
      password: CREDENTIALS.password,
    });

    const res = await enfileirar(() => fetchComBackoff(`${BASE_URL}/operations/login`, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    }));
    estatisticas.logins++;

    const setCookies = res.headers.getSetCookie?.() ?? [];
    const fresh = setCookies
      .filter((c) => !c.toLowerCase().includes('deleted') && !c.startsWith('=deleted'))
      .map((c) => c.split(';')[0])
      .join('; ');

    if (!fresh) {
      throw new Error(`Login não retornou cookies de sessão válidos (HTTP ${res.status}). Usuário/senha incorretos?`);
    }

    this.#cookie = fresh;
    this.#gravarSessao(true);
  }

  /**
   * @param {string} path
   * @param {[string, string | number][]} fields - pares [chave, valor]; repita a chave para arrays (ex: hashtags[])
   */
  async post(path, fields) {
    if (!this.#cookie) await this.login();

    const body = new URLSearchParams();
    for (const [key, value] of fields) body.append(key, String(value));

    const enviar = () => enqueuePost(path, body, this.#cookie);
    let { status, texto } = await enviar();

    // sessão expirada: o GAUSS responde a página de login (HTML) em vez de JSON.
    // Reloga UMA vez e repete; se continuar, é erro de verdade.
    let json = tentarJSON(texto);
    if ((json === undefined && status < 400) || status === 401 || status === 403) {
      await this.login({ forcar: true });
      ({ status, texto } = await enqueuePost(path, body, this.#cookie));
      json = tentarJSON(texto);
    }

    if (status < 200 || status >= 300) throw new Error(`POST ${path} -> HTTP ${status}`);
    if (json === undefined) throw new Error(`POST ${path} não devolveu JSON (sessão inválida?)`);
    this.#gravarSessao();
    return json;
  }
}

function enqueuePost(path, body, cookie) {
  return enfileirar(async () => {
    const res = await fetchComBackoff(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: { ...COMMON_HEADERS, 'Content-Type': 'application/x-www-form-urlencoded', Cookie: cookie },
      body,
    });
    return { status: res.status, texto: await res.text() };
  });
}

function tentarJSON(texto) {
  try {
    return JSON.parse(texto);
  } catch {
    return undefined;
  }
}
