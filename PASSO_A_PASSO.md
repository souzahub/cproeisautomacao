# passo a passo de instalacao e uso

### opcao a: usando instalador executavel

1. executar o arquivo `gerar_instalador_inno.bat` para gerar o instalador do aplicativo.
2. abrir a pasta `dist_inno` e rodar o instalador `CPROEIS_Automacao_Setup_1.2.0.exe`.
3. abrir o sistema instalado pelo atalho na área de trabalho e fazer login.
4. cadastrar o cliente com suas preferências de datas, turnos e eventos na aba de clientes.
5. criar o horário programado de execução na aba de agendamentos.
6. executar o arquivo `instalar_agendador_windows.bat` para ativar o agendador em segundo plano com a inicialização do Windows.

---

### opcao b: versao standalone (pasta pronta sem instalador)

1. executar o arquivo `gerar_standalone.bat`.
2. copiar a pasta gerada `dist_standalone\CPROEIS_Automacao` para qualquer computador.
3. no computador de destino, executar `iniciar_local.bat` para abrir o sistema diretamente.
4. executar `instalar_agendador_windows.bat` para ativar o agendador automatico em segundo plano.

---

### configuracao de notificacoes whatsapp (evolution api)

1. acesse a aba de configuracoes no sistema web.
2. preencha a url da evolution api, o nome da instancia e a chave de api (apikey).
3. informe os numeros de telefone separados por virgula (exemplo: `21999999999, 21988888888`).
4. utilize o botao de teste de conexao para validar a integracao e o recebimento de mensagem.
5. o sistema aplica intervalo automatico de 5 segundos entre cada envio para protecao contra bloqueios.
