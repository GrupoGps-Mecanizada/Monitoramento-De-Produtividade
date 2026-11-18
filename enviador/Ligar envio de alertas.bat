@echo off
title Enviador de alertas no WhatsApp
cd /d "%~dp0.."
npx tsx enviador/enviar.ts
pause
