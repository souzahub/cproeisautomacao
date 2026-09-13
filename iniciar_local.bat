@echo off
chcp 65001 > nul
title Teste Local - Painel CPROEIS

cd /d "%~dp0"

echo Verificando ambiente Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

if not exist "frontend\dist\index.html" (
    echo Gerando build do frontend...
    cd frontend
    call npm run build
    cd ..
)

echo Abrindo navegador em http://localhost:3000...
start "" http://localhost:3000

echo Iniciando servidor web CPROEIS...
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 3000 --reload

pause
