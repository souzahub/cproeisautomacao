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

echo Verificando dependencias do backend...
python -c "import fastapi, uvicorn, sqlalchemy, bcrypt" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias do backend - requirements.txt...
    python -m pip install -r backend\requirements.txt
)

if not exist "frontend\node_modules" (
    echo Instalando dependencias do frontend - npm install...
    cd frontend
    call npm install
    cd ..
)

if not exist "frontend\dist\index.html" (
    echo Gerando build do frontend - npm run build...
    cd frontend
    call npm run build
    cd ..
)

echo Abrindo navegador em http://localhost:8000...
start "" http://localhost:8000

echo Iniciando servidor web CPROEIS...
set SERVE_FRONTEND=true
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload

pause

