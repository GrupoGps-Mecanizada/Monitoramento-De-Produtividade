-- Gestão de alertas sem login (17/10/2026) - Supabase PRODUTIVIDADE
--
-- O dono é o único que gere os alertas: a tela não pede mais e-mail e senha (o login do Portal não chega a este
-- banco). Telefones saem do banco: o número de cada destinatário fica só no programa de envio do PC (etapa 3).
-- Roda uma vez depois do supabase/alertas.sql (que já está com isto para quem rodar do zero). Pode rodar de novo.

-- telefones fora do banco
alter table public.alerta_destino drop column if exists telefone;
alter table public.alerta_destino drop column if exists grupo_id;

-- a lista de gestores e a função do login saem
drop policy if exists alertas_gerir on public.alertas;
drop policy if exists alerta_regra_gerir on public.alerta_regra;
drop policy if exists alerta_politica_gerir on public.alerta_politica;
drop policy if exists alerta_silencio_criar on public.alerta_silencio;
drop policy if exists alerta_silencio_apagar on public.alerta_silencio;
drop policy if exists alerta_destino_gerir on public.alerta_destino;
drop policy if exists alerta_envios_ler on public.alerta_envios;
drop function if exists public.eh_gestor_alertas();
drop table if exists public.alerta_gestor;

-- Gestão (tela /gestao-alertas) SEM login (decisão do dono, 17/10/2026): só ele gere, como na matriz de equipamentos.
-- Telefones NÃO ficam no banco: o número de cada destinatário fica só no programa de envio do PC (etapa 3).
-- O Supabase dá todas as permissões às tabelas novas; aqui elas são tiradas e devolvidas só no que a tela usa.
revoke insert, update, delete on public.alertas, public.alerta_regra, public.alerta_politica, public.alerta_silencio from anon, authenticated;
grant select on public.alertas, public.alerta_envios to anon, authenticated;
grant update (situacao, visto_por, visto_em, resolvido_em, resolvido_por, avaliacao) on public.alertas to anon, authenticated;
grant update (ativa, peso, faixas, justificativas, lembrete_min, escalar_min, atualizado_em) on public.alerta_regra to anon, authenticated;
grant update (corte_whatsapp, corte_resumo, corte_coordenador, max_por_hora, modo_teste, resumo_hora, atualizado_em) on public.alerta_politica to anon, authenticated;
grant insert, delete on public.alerta_silencio to anon, authenticated;
grant select, insert, update, delete on public.alerta_destino to anon, authenticated;

drop policy if exists alertas_gerir on public.alertas;
create policy alertas_gerir on public.alertas for update to anon, authenticated using (true) with check (true);
drop policy if exists alerta_regra_gerir on public.alerta_regra;
create policy alerta_regra_gerir on public.alerta_regra for update to anon, authenticated using (true) with check (true);
drop policy if exists alerta_politica_gerir on public.alerta_politica;
create policy alerta_politica_gerir on public.alerta_politica for update to anon, authenticated using (true) with check (true);
drop policy if exists alerta_silencio_criar on public.alerta_silencio;
create policy alerta_silencio_criar on public.alerta_silencio for insert to anon, authenticated with check (true);
drop policy if exists alerta_silencio_apagar on public.alerta_silencio;
create policy alerta_silencio_apagar on public.alerta_silencio for delete to anon, authenticated using (true);
drop policy if exists alerta_destino_gerir on public.alerta_destino;
create policy alerta_destino_gerir on public.alerta_destino for all to anon, authenticated using (true) with check (true);
drop policy if exists alerta_envios_ler on public.alerta_envios;
create policy alerta_envios_ler on public.alerta_envios for select to anon, authenticated using (true);

-- Conferência: sem colunas de telefone e com as permissões da tela
select column_name from information_schema.columns where table_schema = 'public' and table_name = 'alerta_destino' order by ordinal_position;
