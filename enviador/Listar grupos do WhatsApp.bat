@echo off
title Grupos do WhatsApp dos alertas
cd /d "%~dp0.."
npx tsx enviador/enviar.ts --grupos
pause
