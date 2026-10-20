-- Enviador dos alertas no WhatsApp (19/10/2026, etapa 3 do P-026) - Supabase PRODUTIVIDADE
--
-- O programa do PC lê os alertas com a chave pública e, depois de mandar a mensagem, marca ultimo_aviso_em
-- (assim nunca manda o mesmo alerta duas vezes). Só essa coluna a mais é liberada. Pode rodar de novo.
grant update (ultimo_aviso_em) on public.alertas to anon, authenticated;

-- Conferência: deve aparecer ultimo_aviso_em para anon
select grantee, column_name from information_schema.column_privileges
where table_schema = 'public' and table_name = 'alertas' and privilege_type = 'UPDATE' and grantee = 'anon' order by column_name;
