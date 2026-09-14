@echo off
title Abrir Projeto no Android Studio
echo ========================================================
echo        CPROEIS - ABRIR NO ANDROID STUDIO
echo ========================================================
echo.
echo Sincronizando arquivos do frontend com o projeto Android...
cd /d "%~dp0frontend"
call npm run build:android
echo.
echo Abrindo Android Studio...
call npx cap open android
pause
