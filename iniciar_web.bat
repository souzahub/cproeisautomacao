@echo off
chcp 65001 > nul
title Painel Web CPROEIS

cd /d "%~dp0"

echo Verificando instalacao do Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

echo Iniciando servidor web CPROEIS na porta 3000...
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 3000 --reload

pause
