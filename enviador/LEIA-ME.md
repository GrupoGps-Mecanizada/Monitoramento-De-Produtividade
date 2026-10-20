# Envio dos alertas no WhatsApp

Programa que roda no PC (ao lado do WhatsApp/Evolution do Mensagens-Automaticas). A cada minuto ele olha os
alertas de hoje que **vão para o WhatsApp** e ainda não foram avisados, manda **uma mensagem só** juntando todos
e marca como enviado (nunca repete). Se o PC ficou desligado, alerta que já acabou não é mandado.

## Primeira vez
1. Rodar no Supabase PRODUTIVIDADE o `supabase/2026-10-19_enviador-whatsapp.sql`.
2. Copiar `exemplo.env.enviador` para `.env.enviador` (nesta pasta) e preencher a chave e o destino.
3. Para mandar num grupo: dois cliques em `Listar grupos do WhatsApp.bat` e copiar o código do grupo (termina em `@g.us`).
4. Testar: `Testar sem mandar.bat` mostra a mensagem sem enviar.

## Todo dia
- Docker Desktop ligado + `Mensagens-Automaticas/iniciar.bat` (o WhatsApp).
- Dois cliques em `Ligar envio de alertas.bat`. Para desligar, fechar a janela.

O endereço e a chave do Supabase vêm do `.env.local` do site (pasta de cima): não precisa repetir.

## Relatório de fim de turno (P-088)
O mesmo programa manda, no fim de cada turno do 4x4, um relatório no mesmo grupo dos alertas: supervisor, letra,
data e um cartão por vaga de 24 h (AP 01, AP 08, AV 01, AV 08) com o caminhão, as áreas atendidas, as barras de
produtivo e ocioso e os apontamentos do tablet.
- Sai às **07:00** (noite que acabou às 06:40) e às **19:00** (dia que acabou às 18:40): espera 20 min para o GAUSS chegar.
- Manda uma vez só (guarda em `enviador/.relatorio-turno.json`). PC ligado mais de 3 h depois do fim: não manda o velho.
- Produtivo: bomba ligada (Alta Pressão) ou parado ligado (Auto Vácuo). Ocioso: motor ligado sem produzir.
- Ver como fica sem mandar: dois cliques em `Testar relatório do turno.bat`.
