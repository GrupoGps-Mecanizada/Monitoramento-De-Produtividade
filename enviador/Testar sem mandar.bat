@echo off
title Teste do envio de alertas (nao manda)
cd /d "%~dp0.."
npx tsx enviador/enviar.ts --teste --uma-vez
pause
