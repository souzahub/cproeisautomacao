@echo off
chcp 65001 > nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8
title Painel CPROEIS

cd /d "%~dp0"

echo Verificando ambiente Python...
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo Python nao foi encontrado no sistema. Instale o Python e adicione ao PATH.
    pause
    exit /b 1
)

echo Verificando dependencias do backend...
python -c "import fastapi, uvicorn, sqlalchemy, bcrypt, apscheduler, playwright, ddddocr" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias do backend...
    python -m pip install -r backend\requirements.txt
)

echo Verificando navegador Playwright...
python -c "from playwright.sync_api import sync_playwright; p=sync_playwright().start(); b=p.chromium.launch(headless=True); b.close(); p.stop()" >nul 2>&1
if %errorlevel% neq 0 (
    echo Baixando e instalando navegador Chromium para o robo...
    python -m playwright install chromium
)

if not exist "frontend\dist\index.html" (
    if exist "frontend\package.json" (
        if not exist "frontend\node_modules" (
            echo Instalando dependencias do frontend...
            cd frontend
            call npm install
            cd ..
        )
        echo Gerando build do frontend...
        cd frontend
        call npm run build
        cd ..
    )
)

echo Abrindo navegador em http://localhost:8000...
start "" http://localhost:8000

echo Iniciando servidor web CPROEIS...
set SERVE_FRONTEND=true
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

pause
