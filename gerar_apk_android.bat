@echo off
setlocal enabledelayedexpansion
title Gerador de APK Android CPROEIS
echo ========================================================
echo          CPROEIS - GERADOR DE APK ANDROID
echo ========================================================
echo.

if exist "C:\Program Files\Android\Android Studio1\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio1\jbr"
) else if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
) else if exist "%ProgramFiles%\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=%ProgramFiles%\Android\Android Studio\jbr"
)

if defined JAVA_HOME (
    set "PATH=%JAVA_HOME%\bin;%PATH%"
)

if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
)

if not exist "%~dp0frontend\android\local.properties" (
    if defined ANDROID_HOME (
        echo sdk.dir=%ANDROID_HOME:\=\\%> "%~dp0frontend\android\local.properties"
    )
)

cd /d "%~dp0frontend"
echo [1/3] Compilando frontend e sincronizando com Android...
call npm run build:android
if %errorlevel% neq 0 (
    echo Erro ao compilar frontend.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Compilando arquivo APK nativo via Gradle...
cd /d "%~dp0frontend\android"
call gradlew.bat assembleDebug
if %errorlevel% neq 0 (
    echo.
    echo Nao foi possivel compilar diretamente via linha de comando.
    echo Voce pode abrir o projeto no Android Studio pelo arquivo abrir_android_studio.bat
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Organizando arquivo APK na pasta de saida...
cd /d "%~dp0"
if not exist "%~dp0dist_apk" mkdir "%~dp0dist_apk"
copy /y "%~dp0frontend\android\app\build\outputs\apk\debug\app-debug.apk" "%~dp0dist_apk\CPROEIS_Automacao.apk" >nul

echo.
echo ========================================================
echo APK gerado com sucesso em:
echo %~dp0dist_apk\CPROEIS_Automacao.apk
echo ========================================================
echo.
explorer "%~dp0dist_apk"
pause
