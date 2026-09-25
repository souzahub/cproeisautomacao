@echo off
chcp 65001 > nul
title Desinstalar Agendador - CPROEIS

cd /d "%~dp0"

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\CPROEIS_Agendador.vbs"

if exist "%SHORTCUT_PATH%" (
    del /f /q "%SHORTCUT_PATH%"
    echo Inicializacao automatica removida do Windows.
) else (
    echo Inicializacao automatica nao estava instalada.
)

echo Encerrando processos do agendador e robos em segundo plano...
powershell -NoProfile -Command "Get-CimInstance Win32_Process | Where-Object { $_.Name -match 'python' -and ($_.CommandLine -match 'agendador_local' -or $_.CommandLine -match 'bot\.py' -or $_.CommandLine -match 'consultar_vagas') } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }" >nul 2>&1

echo Agendador desativado e processos encerrados.
pause
