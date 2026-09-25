@echo off
chcp 65001 > nul
title Encerrar Todos os Processos - CPROEIS

cd /d "%~dp0"

echo Encerrando processos do CPROEIS em segundo plano...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'python' -and ($_.CommandLine -match 'agendador_local' -or $_.CommandLine -match 'bot\.py' -or $_.CommandLine -match 'consultar_vagas' -or $_.CommandLine -match 'uvicorn' -or $_.CommandLine -match 'backend\.app\.main') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo Processos finalizados. Pastas e arquivos liberados.
pause
