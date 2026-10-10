-- Matriz de equipamentos SEM LOGIN (decisão do dono, 05/10/2026): qualquer pessoa com o endereço do site
-- cadastra e altera equipamentos, supervisores e regimes. Ninguém apaga (sem permissão de delete):
-- tirar um equipamento = mudar o status para DESMOBILIZADO. O histórico de cada mudança continua (só a data;
-- sem login não há "quem").
--
-- Rodar DEPOIS de supabase/equipamentos.sql. Pode rodar de novo sem problema.

-- gravar: a página (chave publishable) entra como anon
grant insert (tipo, placa, numero, codigo, status, supervisor_id, regime_id, observacao, ordem),
      update (tipo, placa, numero, codigo, status, supervisor_id, regime_id, observacao, ordem)
  on public.frota_equipamento to anon, authenticated;
grant insert (nome, ativo), update (nome, ativo) on public.frota_supervisor, public.frota_regime to anon, authenticated;
grant select on public.frota_equipamento_historico to anon, authenticated;

drop policy if exists "frota_equipamento: editor cadastra" on public.frota_equipamento;
drop policy if exists "frota_equipamento: editor altera" on public.frota_equipamento;
drop policy if exists "frota_equipamento: todos cadastram" on public.frota_equipamento;
create policy "frota_equipamento: todos cadastram" on public.frota_equipamento for insert to anon, authenticated with check (true);
drop policy if exists "frota_equipamento: todos alteram" on public.frota_equipamento;
create policy "frota_equipamento: todos alteram" on public.frota_equipamento for update to anon, authenticated using (true) with check (true);

drop policy if exists "frota_supervisor: editor cadastra" on public.frota_supervisor;
drop policy if exists "frota_supervisor: editor altera" on public.frota_supervisor;
drop policy if exists "frota_supervisor: todos cadastram" on public.frota_supervisor;
create policy "frota_supervisor: todos cadastram" on public.frota_supervisor for insert to anon, authenticated with check (true);
drop policy if exists "frota_supervisor: todos alteram" on public.frota_supervisor;
create policy "frota_supervisor: todos alteram" on public.frota_supervisor for update to anon, authenticated using (true) with check (true);

drop policy if exists "frota_regime: editor cadastra" on public.frota_regime;
drop policy if exists "frota_regime: editor altera" on public.frota_regime;
drop policy if exists "frota_regime: todos cadastram" on public.frota_regime;
create policy "frota_regime: todos cadastram" on public.frota_regime for insert to anon, authenticated with check (true);
drop policy if exists "frota_regime: todos alteram" on public.frota_regime;
create policy "frota_regime: todos alteram" on public.frota_regime for update to anon, authenticated using (true) with check (true);

drop policy if exists "frota_equipamento_historico: editor lê" on public.frota_equipamento_historico;
drop policy if exists "frota_equipamento_historico: leitura pública" on public.frota_equipamento_historico;
create policy "frota_equipamento_historico: leitura pública" on public.frota_equipamento_historico for select to anon, authenticated using (true);

-- a lista de editores não é mais usada
drop table if exists public.frota_editor;

-- conferência: as 3 tabelas aceitam gravação da página
select tablename, policyname from pg_policies where schemaname = 'public' and tablename like 'frota%' order by 1, 2;
