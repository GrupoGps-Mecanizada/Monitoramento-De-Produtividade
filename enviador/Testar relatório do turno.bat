@echo off
title Teste do relatorio de turno (nao manda)
cd /d "%~dp0.."
npx tsx enviador/enviar.ts --teste --relatorio
pause
