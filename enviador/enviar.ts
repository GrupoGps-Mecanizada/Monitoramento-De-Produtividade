// Enviador dos alertas no WhatsApp (etapa 3 do P-026): roda no PC do dono (depois, num servidor) ao lado do Evolution.
// A cada minuto: lê no Supabase os alertas de hoje que vão para o WhatsApp e ainda não foram avisados, manda UMA
// mensagem juntando todos e marca `ultimo_aviso_em` (nunca repete). PC desligado: alerta que já acabou não sai.
//
// Configuração (arquivos que ficam só no PC, fora do Git):
//   ../.env.local            NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (os mesmos do site)
//   ./.env.enviador          EVOLUTION_CHAVE, WHATSAPP_DESTINO e, se mudar, EVOLUTION_URL e EVOLUTION_INSTANCIA
//
// Uso: npx tsx enviador/enviar.ts            (fica rodando)
//      npx tsx enviador/enviar.ts --teste    (mostra a mensagem, não manda nem marca)
//      npx tsx enviador/enviar.ts --grupos   (lista os grupos do número, para achar o código do grupo)
//      npx tsx enviador/enviar.ts --teste --relatorio   (mostra o relatório do último turno, não manda)
// No fim de cada turno do 4x4 manda também o relatório do turno (turno.ts, P-088).
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { montarMensagem, numeroDestino, paraEnviar, type AlertaEnvio } from "./mensagem";
import { montarRelatorio, resumirVagas, turnoEncerrado, ultimoTurno, type ApontTurno, type EventoTurno, type LinhaTurno, type Turno } from "./turno";

const AQUI = dirname(fileURLToPath(import.meta.url));
const INTERVALO_MS = 60_000;

function lerEnv(arquivo: string): Record<string, string> {
  if (!existsSync(arquivo)) return {};
  return Object.fromEntries(
    readFileSync(arquivo, "utf-8")
      .split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/))
      .filter((m): m is RegExpMatchArray => !!m)
      .map((m) => [m[1], m[2].replace(/^["']|["']$/g, "")]),
  );
}

const site = lerEnv(join(AQUI, "..", ".env.local"));
const cfg = { ...lerEnv(join(AQUI, ".env.enviador")), ...process.env } as Record<string, string | undefined>;
const SUPABASE_URL = cfg.SUPABASE_URL ?? site.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_CHAVE = cfg.SUPABASE_CHAVE ?? site.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const EVOLUTION_URL = (cfg.EVOLUTION_URL ?? "http://localhost:8080").replace(/\/$/, "");
const EVOLUTION_CHAVE = cfg.EVOLUTION_CHAVE;
const INSTANCIA = cfg.EVOLUTION_INSTANCIA ?? "alertas-frota";
const DESTINO = cfg.WHATSAPP_DESTINO ? numeroDestino(cfg.WHATSAPP_DESTINO) : undefined;
const TESTE = process.argv.includes("--teste");
/** Monta já o relatório do último turno que acabou (com --teste, só mostra). */
const RELATORIO_AGORA = process.argv.includes("--relatorio");
/** Guarda o último relatório de turno mandado (fica só no PC, fora do Git): nunca repete. */
const ARQ_RELATORIO = join(AQUI, ".relatorio-turno.json");

const hora = () => new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo" });
const log = (msg: string) => console.log(`[${hora()}] ${msg}`);
const hojeLocal = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date());

function faltando(): string[] {
  const f: string[] = [];
  if (!SUPABASE_URL || !SUPABASE_CHAVE) f.push("endereço/chave do Supabase (o .env.local do site, na pasta de cima)");
  if (!EVOLUTION_CHAVE && !TESTE) f.push("EVOLUTION_CHAVE no enviador/.env.enviador");
  if (!DESTINO && !TESTE && !process.argv.includes("--grupos")) f.push("WHATSAPP_DESTINO no enviador/.env.enviador");
  return f;
}

const supa = (caminho: string, init: RequestInit = {}) =>
  fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, { ...init, headers: { apikey: SUPABASE_CHAVE!, Authorization: `Bearer ${SUPABASE_CHAVE}`, "Content-Type": "application/json", ...init.headers } });
const evo = (caminho: string, init: RequestInit = {}) => fetch(`${EVOLUTION_URL}${caminho}`, { ...init, headers: { apikey: EVOLUTION_CHAVE!, "Content-Type": "application/json", ...init.headers } });

async function lerAlertas(): Promise<AlertaEnvio[]> {
  const campos = "id,regra,placa,vaga,supervisor,dia,ini,fim,ref,local,detalhe,destino,situacao,ultimo_aviso_em";
  const r = await supa(`alertas?select=${campos}&dia=eq.${hojeLocal()}&destino=eq.whatsapp&ultimo_aviso_em=is.null&order=ini.asc&limit=200`);
  if (!r.ok) throw new Error(`Supabase respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return (await r.json()) as AlertaEnvio[];
}

/** Janela de "recente" da tela Filtro inteligente; sem a coluna (SQL não rodado) ou erro, 60 min. */
async function lerJanela(): Promise<number> {
  try {
    const r = await supa("alerta_politica?select=janela_min&id=eq.1");
    const j = r.ok ? ((await r.json()) as { janela_min?: number }[]) : [];
    return j[0]?.janela_min ?? 60;
  } catch {
    return 60;
  }
}
const agoraSegLocal = () => {
  const [h, m, s] = new Date().toLocaleTimeString("en-GB", { timeZone: "America/Sao_Paulo", hour12: false }).split(":").map(Number);
  return h * 3600 + m * 60 + s;
};

async function mandar(texto: string) {
  const r = await evo(`/message/sendText/${encodeURIComponent(INSTANCIA)}`, { method: "POST", body: JSON.stringify({ number: DESTINO, text: texto }) });
  if (!r.ok) throw new Error(`WhatsApp (Evolution) respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function marcar(ids: number[]) {
  const r = await supa(`alertas?id=in.(${ids.join(",")})`, { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ ultimo_aviso_em: new Date().toISOString() }) });
  if (!r.ok) throw new Error(`Não deu para marcar como enviado (${r.status}): ${(await r.text()).slice(0, 200)}`);
}

async function ciclo() {
  const [alertas, janela] = await Promise.all([lerAlertas(), lerJanela()]);
  const novos = paraEnviar(alertas, hojeLocal(), agoraSegLocal(), janela);
  if (!novos.length) return;
  const texto = montarMensagem(novos, new Date());
  if (TESTE) {
    log(`TESTE (não mandou): ${novos.length} alerta(s)\n${texto}\n`);
    return;
  }
  await mandar(texto);
  // marca só depois de mandar: se o WhatsApp falhar, o próximo minuto tenta de novo
  await marcar(novos.map((a) => a.id));
  log(`✅ mandou ${novos.length} alerta(s) para ${DESTINO}`);
}

/** Todas as linhas de uma consulta, de 1000 em 1000. */
async function todas<T>(caminho: string): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; ; de += 1000) {
    const r = await supa(caminho, { headers: { Range: `${de}-${de + 999}` } });
    if (!r.ok) throw new Error(`Supabase respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
    const pg = (await r.json()) as T[];
    out.push(...pg);
    if (pg.length < 1000) return out;
  }
}

async function relatorioDoTurno(t: Turno): Promise<string> {
  const [ini, fim] = [encodeURIComponent(t.ini), encodeURIComponent(t.fim)];
  const dias = [...new Set([t.ini.slice(0, 10), t.fim.slice(0, 10)])].join(",");
  const [linhas, eventos, apont] = await Promise.all([
    todas<LinhaTurno>(`timeline_motor_vaga?select=vaga_nome,placa,placa_ou_codigo,inicio,fim,status&inicio=lt.${fim}&fim=gt.${ini}&order=inicio`),
    todas<EventoTurno>(`loc_eventos?select=t:dados->>t,placa:dados->>placa,tipo:dados->>tipo,area:dados->>area&dia=in.(${dias})&order=id`),
    todas<ApontTurno>(`demoras_categorizadas?select=placa,inicio,fim,categoria_demora&inicio=lt.${fim}&or=(fim.is.null,fim.gt.${ini})&order=inicio`),
  ]);
  return montarRelatorio(t, resumirVagas(linhas, eventos, apont, t));
}

const ultimoMandado = () => {
  try {
    return (JSON.parse(readFileSync(ARQ_RELATORIO, "utf-8")) as { chave?: string }).chave ?? null;
  } catch {
    return null;
  }
};

/** No fim de cada turno do 4x4 (com a espera do GAUSS), manda o relatório uma vez só. */
async function cicloRelatorio() {
  const t = RELATORIO_AGORA ? ultimoTurno(new Date()) : turnoEncerrado(new Date());
  if (!t || (!RELATORIO_AGORA && ultimoMandado() === t.chave)) return;
  const texto = await relatorioDoTurno(t);
  if (TESTE) {
    log(`TESTE (não mandou): relatório do turno ${t.chave}\n${texto}\n`);
    if (!RELATORIO_AGORA) writeFileSync(ARQ_RELATORIO, JSON.stringify({ chave: t.chave }));
    return;
  }
  await mandar(texto);
  writeFileSync(ARQ_RELATORIO, JSON.stringify({ chave: t.chave, enviado_em: new Date().toISOString() }));
  log(`✅ mandou o relatório do turno ${t.chave} para ${DESTINO}`);
}

async function listarGrupos() {
  const r = await evo(`/group/fetchAllGroups/${encodeURIComponent(INSTANCIA)}?getParticipants=false`);
  if (!r.ok) throw new Error(`Evolution respondeu ${r.status}: ${(await r.text()).slice(0, 200)}`);
  const grupos = (await r.json()) as { id: string; subject: string }[];
  console.log(grupos.length ? grupos.map((g) => `${g.subject}  →  ${g.id}`).join("\n") : "O número não está em nenhum grupo.");
}

async function principal() {
  const f = faltando();
  if (f.length) {
    console.error(`Falta configurar:\n- ${f.join("\n- ")}\nVeja o enviador/LEIA-ME.md.`);
    process.exit(1);
  }
  if (process.argv.includes("--grupos")) return listarGrupos();
  log(`Enviador de alertas ligado${TESTE ? " (modo teste: não manda)" : ""}. Confere a cada minuto. Para desligar, feche esta janela.`);
  for (;;) {
    // um não trava o outro: alerta com erro não impede o relatório, e vice-versa
    for (const passo of RELATORIO_AGORA ? [cicloRelatorio] : [ciclo, cicloRelatorio])
      try {
        await passo();
      } catch (e) {
        log(`⚠ ${e instanceof Error ? e.message : String(e)} (tenta de novo em 1 min)`);
      }
    if (RELATORIO_AGORA) return;
    if (process.argv.includes("--uma-vez")) return;
    await new Promise((r) => setTimeout(r, INTERVALO_MS));
  }
}

await principal();
