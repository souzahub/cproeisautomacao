@echo off
chcp 65001 > nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title Painel de Gestao e Cobranca - Easypanel Local

cd /d "%~dp0"

echo Verificando ambiente Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

echo Verificando dependencias do backend do painel...
python -c "import fastapi, uvicorn, sqlalchemy, bcrypt, jwt" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias do backend do painel...
    python -m pip install -r painel\backend\requirements.txt
)

if not exist "painel\frontend\dist\index.html" (
    if exist "painel\frontend\package.json" (
        if not exist "painel\frontend\node_modules" (
            echo Instalando dependencias do frontend do painel...
            cd painel\frontend
            call npm install
            cd ..\..
        )
        echo Gerando build do frontend do painel...
        cd painel\frontend
        call npm run build
        cd ..\..
    )
)

echo Abrindo painel no navegador em http://localhost:8001...
start "" http://localhost:8001

echo Iniciando servidor do painel na porta 8001...
python -m uvicorn painel.backend.app.main:app --host 127.0.0.1 --port 8001 --reload

pause
