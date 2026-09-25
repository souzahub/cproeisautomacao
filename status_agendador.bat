@echo off
chcp 65001 > nul
title Status do Agendador - CPROEIS

cd /d "%~dp0"

echo Verificando processo do agendador...
powershell -NoProfile -Command "$conn = Get-NetTCPConnection -LocalPort 58921 -State Listen -ErrorAction SilentlyContinue; if ($conn) { Write-Host 'Status: Agendador ativo e monitorando em segundo plano.' -ForegroundColor Green } else { Write-Host 'Status: Agendador parado.' -ForegroundColor Red }"

echo.
echo Ultimas linhas do log do agendador:
echo ----------------------------------------------------
powershell -NoProfile -Command "$log = Get-ChildItem logs\agendamento_*.log -ErrorAction SilentlyContinue | Sort-Object LastWriteTime -Descending | Select-Object -First 1; if ($log) { Get-Content $log.FullName -Tail 15 } else { Write-Host 'Nenhum log encontrado ainda.' }"
echo ----------------------------------------------------
echo.

pause
