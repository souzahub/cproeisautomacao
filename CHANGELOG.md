# CHANGELOG & REGISTRO DE DESENVOLVIMENTO

Este documento registra todas as alterações, melhorias, correções de bugs e a estrutura criada no projeto **CPROEIS Automação**.

---

## [16/09/2026] - Versão 1.2.0 & Criação do App Android Nativo

### 1. Relatório de Vagas Vinculado à Busca & Limpeza de Logs
- **Filtro por Execução (`selectedExecution`)**:
  - A tela de **Relatórios/Comprovantes** agora isola as vagas pela busca realizada (padrão: *"Última busca realizada"*).
  - Se a automação preencher 7 de 7 vagas na busca, o relatório exibe exatamente as 7 vagas daquela sessão sem misturar com tentativas antigas.
- **Limpeza de Nomes de Eventos**:
  - O parser de logs agora remove prefixos técnicos e timestamps como `03:13]`, `[HOMOLOGACAO]`, `Vaga compativel (1/7) identificada:`, exibindo o nome limpo do cargo (ex: `ENFERMAGEM CIRURGIA GERAL`, `ENFERMAGEM CARDIOLOGIA`).
- **Exportação Excel (`.CSV`) & PDF Executivo**:
  - Exportação `.csv` formatada com UTF-8 BOM e delimitador `;` para compatibilidade total com o Excel brasileiro.
  - Relatório formal e executivo em folha A4 com cabeçalho oficial do CPROEIS e métricas de vagas titulares/reservas.

---

### 2. Impressão de Resumo da Busca & Contador em Tempo Real
- **Botão "Imprimir Resumo"**:
  - Adicionado card de destaque verde no término da busca com botão direto para emitir o resumo em PDF.
  - Botão também integrado no cabeçalho do terminal de logs e em cada linha da tabela de histórico.
  - Implementado extrator inteligente (`parseVagasFromLogs`) no frontend para garantir que todas as vagas apareçam na impressão mesmo em execuções locais ou com delay de banco de dados.
- **Acompanhamento Visual de Tentativas**:
  - Badge e barra de progresso em tempo real no Dashboard:
    - *Tentativas:* `43 / 60 ciclos`
    - *Vagas Confirmadas:* `7 / 7 vaga(s)`
    - *Data Pesquisada:* `17/09/2026`

---

### 3. Correção de Erros no Frontend Web/Desktop
- **Correção da Exceção `n.forEach is not a function`**:
  - Blindada a rota `/api/comprovantes/vagas-report` e a página `Comprovantes.jsx` para suportar tanto array direto quanto objetos estruturados `{ vagas, executions, summary }`.
  - Adicionadas validações defensivas (`Array.isArray`) em todo o fluxo de dados.

---

### 4. Criação do Aplicativo Android 100% Nativo (`app_android/`)
Foi criada uma pasta dedicada com o projeto completo para **Android Studio**, totalmente desacoplado do projeto web:
- **Tecnologias**: Kotlin, Material Design 3, Retrofit 2, OkHttp 3, Coroutines, ViewBinding, Foreground Services.
- **Estrutura**:
  - `app_android/app/src/main/java/com/cproeis/app/`:
    - `api/`: `ApiClient.kt`, `ApiService.kt`, `AuthInterceptor.kt` (conecta no servidor Python `https://cprsautomacao.devsouza.online` com autenticação por token Bearer).
    - `data/model/`: Modelos de autenticação, cliente, robô, vagas e logs.
    - `service/`: `BotForegroundService.kt` (serviço de segundo plano com notificações nativas de novas vagas).
    - `ui/`:
      - `login/LoginActivity.kt`: Tela de login e configuração da URL do servidor.
      - `main/MainActivity.kt`: Hospeda a barra de navegação inferior (*BottomNavigationView*).
      - `dashboard/DashboardFragment.kt`: Painel clean com controle em 1 toque (*Homologação*, *Produção*, *Parar*), contador de tentativas e dados do cliente.
      - `vagas/VagasFragment.kt`: Lista nativa de vagas agendadas com *RecyclerView*.
      - `logs/LogsFragment.kt`: Terminal de logs nativo com rolagem automática.
  - `app_android/app/src/main/res/`:
    - Ícones oficiais vetoriais do Google Material (`ic_nav_dashboard`, `ic_nav_vagas`, `ic_nav_logs`).
    - Ícone adaptativo vetorial moderno com escudo de segurança do CPROEIS (`ic_launcher_foreground.xml`).
    - Layouts XML nativos Material 3 com tema escuro profissional.

---

### 5. Correções no Projeto Android Studio
- **AAPT `resource mipmap/ic_launcher not found`**:
  - Copiados e configurados os recursos adaptativos de ícones para todas as densidades (`hdpi`, `mdpi`, `xhdpi`, `xxhdpi`, `xxxhdpi`, `anydpi-v26`).
- **AAPT `Duplicate resources`**:
  - Removido o arquivo duplicado `ic_launcher_background.xml` de `res/values/`, centralizando todas as cores no `colors.xml`.
  - Removidos arquivos `.png` legados que conflitavam com os novos ícones vetoriais.

---

### 6. Implementação de Skeleton Loader Profissional & Shimmer Animation
- **Skeleton Shimmer / Pulse Fluido no App Android**:
  - Criada animação suave e leve de pulso (`res/anim/skeleton_pulse.xml` com interpolação `accelerate_decelerate`).
  - Layouts dedicados de Skeleton para o Dashboard (`layout_skeleton_dashboard.xml`) e para a Lista de Vagas (`layout_skeleton_vagas.xml`).
  - Efeito moderno de placeholder arredondado (`skeleton_box.xml`), exibido no primeiro carregamento e nas atualizações de tela, substituindo barras circulares genéricas por uma experiência fluida de alto nível.
- **Validação de Build 100% com Sucesso**:
  - Executado `gradlew assembleDebug` no `app_android` com JDK 21 do Android Studio, confirmando **BUILD SUCCESSFUL (0 erros)**.
- **Alinhamento com Servidor Cloud & Local**:
  - Compatibilidade total com `https://cprsautomacao.devsouza.online` e `http://localhost:8000`, aceitando login tanto com `email` quanto `username`.

### 7. Exibição Completa dos Dados do Militar & Modal de Parâmetros
- **Card do Militar Detalhado no Dashboard**:
  - Exibição de **Horários Preferenciais** (`preferred_hours`), **Período de Busca** (+X dias à frente ou range de datas), **Postos/Eventos cadastrados**, **Convênio**, **Documento/CPF** e **Status do Perfil (Ativo/Inativo)**.
  - Exibição de métricas de busca do robô: Meta de vagas, Ciclos Máximos e Intervalo de repetição.
- **Material BottomSheet Dialog (`dialog_client_details.xml`)**:
  - Ao tocar no card do militar no Dashboard, abre um BottomSheet Modal moderno detalhando todos os critérios de busca (Apenas Titular, range de datas, postos de interesse e parâmetros da automação).

### 8. Sincronização Inteligente Local-Nuvem & Modo Offline Robusto
- **Base Centralizada na Nuvem (`https://cprsautomacao.devsouza.online`)**:
  - Tanto o app Android quanto o frontend web (rodando local ou em produção) utilizam a Nuvem como base de dados primária por padrão.
  - Qualquer alteração realizada localmente atualiza a nuvem instantaneamente quando houver conexão.
- **Fila Offline Automática (`Sync Queue`)**:
  - Se a conexão cair no momento da alteração de clientes, operadores ou parâmetros, as mudanças são guardadas em cache local com ID temporário e adicionadas à fila de sincronização.
- **Auto-Sync na Reconexão, Login e Botão "Sync"**:
  - Ao fazer login com sucesso, ao recuperar a conexão (`window.online`) ou ao clicar no botão **`sync`** na barra lateral, todos os itens pendentes são enviados automaticamente para a nuvem, mantendo o App Android e a Web sempre 100% atualizados.

---

## Estado Atual do Projeto & Onde Paramos:

| Módulo | Caminho | Status |
| :--- | :--- | :--- |
| **Backend** | `backend/` | Estável, rotas `/api/bot`, `/api/clients`, `/api/comprovantes/vagas-report` 100% operacionais. |
| **Frontend Web/Desktop** | `frontend/` | Versão `1.2.0` com Sincronização Nuvem padrão e fallback offline funcional. |
| **App Android Nativo** | `app_android/` | **BUILD SUCCESSFUL**. Skeleton Loader nativo e Exibição Completa de Dados & Horários operacionais. |

---

## Como Abrir e Continuar o Trabalho:

1. **Para o Sistema Web/Desktop**:
   - Iniciar Backend: `python run_server.py`
   - Iniciar Frontend: `cd frontend && npm run dev`
2. **Para o Aplicativo Android Nativo**:
   - Abrir o **Android Studio**.
   - Abrir a pasta `C:\Users\LUAN\Documents\GitHub\Automacao Navegador\Automacao Navegador\app_android`.
   - Clicar em **Run** (`Shift + F10`) para rodar direto no celular ou emulador.



