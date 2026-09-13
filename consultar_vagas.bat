@echo off
chcp 65001 > nul
title Consultar Vagas Cadastradas - CPROEIS

cd /d "%~dp0"

echo Conectando ao portal para verificar vagas cadastradas...
python consultar_vagas.py

pause
