-- Alertas: só mandar no WhatsApp o que é recente (19/10/2026, P-064) - Supabase PRODUTIVIDADE
--
-- O dono não quer receber agora o que aconteceu de madrugada. O programa de envio só manda o que aconteceu (ou ainda
-- acontece) nos últimos `janela_min` minutos; o resto fica só na tela. Ajustável na tela Filtro inteligente.
-- Rodar ANTES de publicar a tela nova (ela lê esta coluna). Pode rodar de novo.
alter table public.alerta_politica add column if not exists janela_min int not null default 60 check (janela_min between 5 and 1440);
grant update (janela_min) on public.alerta_politica to anon, authenticated;

-- Conferência: deve mostrar 60
select janela_min from public.alerta_politica where id = 1;
