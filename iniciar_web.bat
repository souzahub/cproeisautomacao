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

echo Verificando dependencias do backend...
python -c "import fastapi, uvicorn, sqlalchemy, bcrypt, apscheduler" >nul 2>&1
if %errorlevel% neq 0 (
    echo Instalando dependencias do backend - requirements.txt...
    python -m pip install -r backend\requirements.txt
)

echo Iniciando servidor web CPROEIS na porta 8000...
set SERVE_FRONTEND=true
python -m uvicorn backend.app.main:app --host 0.0.0.0 --port 8000 --reload

pause

