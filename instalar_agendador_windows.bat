@echo off
chcp 65001 > nul
title Instalar Agendador - CPROEIS

cd /d "%~dp0"

echo Configurando inicializacao automatica com o Windows...

set "STARTUP_FOLDER=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup"
set "SHORTCUT_PATH=%STARTUP_FOLDER%\CPROEIS_Agendador.vbs"

(
echo Set objShell = CreateObject("WScript.Shell"^)
echo Set objFSO = CreateObject("Scripting.FileSystemObject"^)
echo strDir = "%~dp0"
echo objShell.CurrentDirectory = strDir
echo strPy = "pythonw.exe"
echo strUserPy = objShell.ExpandEnvironmentStrings("%%LOCALAPPDATA%%"^) ^& "\Programs\Python\Python313\pythonw.exe"
echo If objFSO.FileExists(strUserPy^) Then strPy = strUserPy
echo objShell.Run """" ^& strPy ^& """ """ ^& strDir ^& "agendador_local.py""", 0, False
) > "%SHORTCUT_PATH%"

echo Iniciando o servico em segundo plano agora...
wscript.exe "%SHORTCUT_PATH%"

timeout /t 2 >nul

echo.
echo Agendador configurado para iniciar com o Windows.
echo O monitoramento esta ativo em segundo plano e executara no horario programado.
echo Os logs ficam salvos na pasta logs.
echo.

pause
