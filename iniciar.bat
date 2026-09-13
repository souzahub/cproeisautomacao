@echo off
chcp 65001 > nul
title Automacao CPROEIS

cd /d "%~dp0"

echo Verificando instalacao do Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

echo Iniciando automacao...
python bot.py

pause
