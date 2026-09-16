# CPROEIS App Android (100% Nativo)

Aplicativo Android Nativo desenvolvido em **Kotlin** com **Material Design 3**, arquitetura moderna (Retrofit, Coroutines, ViewBinding, Foreground Services) e totalmente integrado ao backend do CPROEIS.

---

## Como Abrir e Executar no Android Studio:

1. Abra o **Android Studio**.
2. Clique em **File > Open...** (ou *Open an Existing Project*).
3. Selecione a pasta:
   ```
   C:\Users\LUAN\Documents\GitHub\Automacao Navegador\Automacao Navegador\app_android
   ```
4. Aguarde o Gradle sincronizar as dependências.
5. Conecte um aparelho celular Android via USB (ou inicie um Emulador) e clique em **Run (▶)**.

---

## Funcionalidades Nativas:
- **Design Clean & Direto**: Focado no uso rápido do celular.
- **Carregamento Automático do Servidor**: Obtém os dados e regras configuradas para o cliente logado.
- **Controle 1-Clique**: Botões diretos para iniciar em *Homologação*, *Produção* ou *Interromper*.
- **Acompanhamento em Tempo Real**: Progresso de tentativas (ex: `43 / 60`) e vagas (ex: `7 / 7`).
- **Lista de Vagas Confirmadas**: Exibição detalhada de todas as vagas agendadas com data, horário/turno, convênio e status.
- **Terminal de Logs Nativo**: Acompanhamento das etapas com auto-scroll.
- **Serviço em Segundo Plano (Foreground Service)**: Notificações nativas no Android avisando sempre que uma nova vaga for agendada ou quando a busca finalizar.
