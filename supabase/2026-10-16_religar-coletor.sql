-- RELIGAR o coletor da frota a cada 5 min (desfaz 2026-10-16_pausar-coletor.sql).
-- Rodar no projeto do Supabase do Monitoramento de Produtividade (o que tem a tabela loc_kv).

select cron.unschedule(jobid) from cron.job where jobname = 'coletor-localizacao';
select cron.schedule('coletor-localizacao', '*/5 * * * *', 'select private.disparar_coletor()');

-- conferência: deve voltar 1 linha, active = true
select jobname, schedule, active from cron.job where jobname = 'coletor-localizacao';
