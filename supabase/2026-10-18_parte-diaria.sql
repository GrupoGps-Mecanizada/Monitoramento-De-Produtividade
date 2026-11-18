-- Parte Diária (P-047): onde cada vaga foi programada para atender (Imp. Detalhes Solicitação do GAUSS).
-- Rodar no SQL Editor do projeto PRODUTIVIDADE. Pode rodar de novo.
-- Grava só o coletor (chave secreta). Sem nomes e sem telefones. Por enquanto o site NÃO lê (sem acesso público):
-- abrir a leitura quando a tela da Parte Diária existir.
create table if not exists public.parte_diaria (
  chave text primary key,            -- solicitação | vaga | dia | início
  dia date not null,
  inicio text not null,              -- "07:01"
  fim text not null,                 -- "19:00"
  solicitacao text not null,
  vaga_id integer,
  vaga text not null,
  regime text,
  grupo text,
  equipamento text,
  servico text,
  area text,
  local_origem text,
  endereco text,
  apresentar text,
  atividade text,
  material text,
  classificacao text,
  destino text,
  gerencia text,
  seguranca jsonb not null default '{}'::jsonb,  -- altura, andaime, confinado, gás (sim/não)
  aprovado boolean not null default false,
  coletado_em timestamptz not null default now()
);
create index if not exists parte_diaria_dia_vaga on public.parte_diaria (dia, vaga_id);

alter table public.parte_diaria enable row level security;
revoke all on public.parte_diaria from anon, authenticated;

-- conferência: deve aparecer parte_diaria com rowsecurity = true
select tablename, rowsecurity from pg_tables where schemaname = 'public' and tablename = 'parte_diaria';
