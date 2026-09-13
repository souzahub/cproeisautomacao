@echo off
chcp 65001 > nul
title Agente Local CPROEIS - Conexao Nuvem

cd /d "%~dp0"

echo Conectando ao servidor online CPROEIS e iniciando agente local...
python agente_local.py

pause
