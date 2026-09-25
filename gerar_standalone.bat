@echo off
chcp 65001 > nul
title Gerar Pacote Standalone CPROEIS

cd /d "%~dp0"

echo ============================================================
echo    Gerador de Pacote Standalone CPROEIS (Pasta Limpa)
echo ============================================================
echo.

echo [1/4] Compilando a interface React...
cd frontend
call npm run build
if %errorlevel% neq 0 (
    echo [ERRO] Falha ao compilar o frontend.
    cd ..
    pause
    exit /b %errorlevel%
)
cd ..

set "DEST=%~dp0dist_standalone\CPROEIS_Automacao"

echo.
echo [2/4] Preparando pasta de destino limpa...
if exist "%DEST%" (
    powershell -NoProfile -Command "Get-ChildItem -Path '%DEST%' -Exclude 'app.db' -Recurse | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue" >nul 2>&1
)
mkdir "%DEST%" >nul 2>&1
mkdir "%DEST%\frontend\dist" >nul 2>&1
mkdir "%DEST%\data" >nul 2>&1
mkdir "%DEST%\logs" >nul 2>&1
mkdir "%DEST%\comprovantes" >nul 2>&1

echo.
echo [3/4] Copiando apenas arquivos essenciais de execucao...

robocopy "backend" "%DEST%\backend" /E /XD __pycache__ .pytest_cache /XF *.pyc /NFL /NDL /NJH /NJS >nul
robocopy "frontend\dist" "%DEST%\frontend\dist" /E /NFL /NDL /NJH /NJS >nul

copy /y "bot.py" "%DEST%\" >nul
copy /y "agendador_local.py" "%DEST%\" >nul
copy /y "gerar_pdf.py" "%DEST%\" >nul
copy /y "consultar_vagas.py" "%DEST%\" >nul
copy /y "whatsapp_notifier.py" "%DEST%\" >nul

copy /y "iniciar_local.bat" "%DEST%\" >nul
copy /y "instalar_agendador_windows.bat" "%DEST%\" >nul
copy /y "desinstalar_agendador_windows.bat" "%DEST%\" >nul
copy /y "status_agendador.bat" "%DEST%\" >nul
copy /y "encerrar_tudo.bat" "%DEST%\" >nul
copy /y "iniciar_silencioso.vbs" "%DEST%\" >nul

copy /y "PASSO_A_PASSO.md" "%DEST%\" >nul
if exist "test_captcha.png" copy /y "test_captcha.png" "%DEST%\" >nul
if exist "requirements.txt" copy /y "requirements.txt" "%DEST%\" >nul
if exist ".env" copy /y ".env" "%DEST%\" >nul
if exist ".env.example" copy /y ".env.example" "%DEST%\" >nul
if exist "data\app.db" copy /y "data\app.db" "%DEST%\data\" >nul

echo.
echo [4/4] Pacote standalone concluido com apenas os arquivos necessarios.
echo Abrindo a pasta...
start "" "%DEST%"

echo.
echo Concluido. A pasta dist_standalone\CPROEIS_Automacao esta enxuta e pronta para distribuicao.
pause
