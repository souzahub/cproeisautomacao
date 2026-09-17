@echo off
chcp 65001 > nul
title Gerar Instalador CPROEIS (Inno Setup)

cd /d "%~dp0"

echo ============================================================
echo    Gerador de Instalador CPROEIS (completo)
echo ============================================================
echo.

taskkill /F /T /IM "CPROEIS Automacao.exe" >nul 2>&1
taskkill /F /T /IM "electron.exe" >nul 2>&1
timeout /t 2 >nul 2>&1

set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if exist "%ProgramFiles(x86)%\Inno Setup 7\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 7\ISCC.exe"
if exist "%ProgramFiles%\Inno Setup 7\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 7\ISCC.exe"
if not defined ISCC if exist "C:\Program Files\Inno Setup 7\ISCC.exe" set "ISCC=C:\Program Files\Inno Setup 7\ISCC.exe"

if not defined ISCC (
    echo [ERRO] Inno Setup nao encontrado.
    echo Baixe em: https://jrsoftware.org/isdl.php
    echo.
    pause
    exit /b 1
)

echo [1/4] Instalando dependencias do frontend...
cd frontend
call npm install
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao instalar as dependencias.
    cd ..
    pause
    exit /b %errorlevel%
)

echo.
echo [2/4] Compilando a interface e empacotando o Electron...
echo       (--dir gera apenas o win-unpacked, sem o instalador NSIS)
call npx vite build
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao compilar a interface.
    cd ..
    pause
    exit /b %errorlevel%
)

call npx electron-builder --win --dir
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao gerar o build do Electron.
    cd ..
    pause
    exit /b %errorlevel%
)

cd ..

if not exist "dist_instalador\win-unpacked\CPROEIS Automacao.exe" (
    echo.
    echo [ERRO] O build nao gerou dist_instalador\win-unpacked.
    pause
    exit /b 1
)

echo.
echo [3/4] Compilando o instalador com Inno Setup...
"%ISCC%" "instalador_inno.iss"
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha na compilacao do instalador.
    pause
    exit /b %errorlevel%
)

echo.
echo [4/4] Instalador gerado na pasta 'dist_inno'.
start "" "%~dp0dist_inno"

echo.
echo Concluido.
pause
