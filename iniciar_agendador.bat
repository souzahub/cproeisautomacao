@echo off
chcp 65001 > nul
title Agendador Local - CPROEIS

cd /d "%~dp0"

echo Verificando ambiente Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

echo Iniciando agendador local CPROEIS...
echo Este processo monitora seus agendamentos e executa o robo no horario programado.
echo Deixe esta janela aberta ou instale como servico do Windows.
echo.

python agendador_local.py

pause
