@echo off
chcp 65001 > nul
title Gerar Instalador Desktop CPROEIS (.exe)

cd /d "%~dp0"

echo ============================================================
echo    Gerador de Instalador Desktop CPROEIS (Windows .exe)
echo ============================================================
taskkill /F /IM "CPROEIS Automacao.exe" >nul 2>&1

cd frontend

echo [1/3] Verificando e instalando dependencias do Electron...
call npm install

echo.
echo [2/3] Compilando interface React e empacotando com Electron...
call npm run build:electron

if %errorlevel% neq 0 (
    echo.
    echo Ocorreu um erro durante a geracao do instalador.
    pause
    exit /b %errorlevel%
)

cd ..

echo.
echo [3/3] Instalador gerado na pasta 'dist_instalador'.
echo Abrindo a pasta do executavel...
start "" "%~dp0dist_instalador"

echo.
echo Concluido. O arquivo do instalador NSIS (Avancar, Instalar, Concluir) esta pronto.
pause
