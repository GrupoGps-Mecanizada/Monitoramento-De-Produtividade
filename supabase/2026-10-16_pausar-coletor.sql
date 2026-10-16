-- PAUSAR o coletor da frota (menos log no Supabase até o mês virar).
-- Rodar no projeto do Supabase do Monitoramento de Produtividade (o que tem a tabela loc_kv).
-- O que para: o mapa ao vivo, as paradas de hoje, a timeline de motor e a medição deixam de atualizar sozinhos.
-- O que continua: quem pedir o histórico de um veículo na página ainda é atendido (dispara o coletor só nessa hora).
-- Para voltar: rodar 2026-10-16_religar-coletor.sql.

select cron.unschedule(jobid) from cron.job where jobname = 'coletor-localizacao';

-- conferência: deve voltar VAZIO
select jobname, schedule, active from cron.job where jobname = 'coletor-localizacao';
