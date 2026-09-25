# Especificação Técnica: Painel de Gestão e Cobrança para Easypanel

## 1. Visão Geral
Criar uma aplicação paralela e independente localizada no diretório `painel/`, projetada especificamente para execução em nuvem via Easypanel (Docker). O painel permite autenticação com as mesmas credenciais do sistema, visualização em tempo real de clientes, acompanhamento de agendamentos/lançamentos e gestão financeira completa com cobrança customizável por agendamento.
Além disso, implementa um serviço de sincronização automática e não-bloqueante no sistema local para manter os dados no painel da nuvem atualizados sempre que houver conexão.

## 2. Restrições Globais
- Total conformidade com o ambiente local (não quebrar nem modificar o comportamento de execução local).
- Sem emojis na interface.
- Sem gradientes, glow, sombras pesadas ou bordas excessivamente arredondadas.
- Sem ícones decorativos sem função.
- Sentence case em todos os textos da interface.
- Nenhum comentário em arquivos de código criados ou editados.
- Persistência com SQLite em ambos os ambientes.

## 3. Arquitetura da Solução

### 3.1 Estrutura do Diretório `painel/`
```
painel/
├── backend/
│   ├── app/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── sync.py
│   │   │   ├── clients.py
│   │   │   ├── agendamentos.py
│   │   │   ├── billing.py
│   │   │   └── settings.py
│   │   └── main.py
│   └── requirements.txt
├── frontend/
│   ├── package.json
│   ├── vite.config.js
│   ├── index.html
│   └── src/
│       ├── main.jsx
│       ├── App.jsx
│       ├── index.css
│       ├── api/
│       │   └── client.js
│       └── pages/
│           ├── Login.jsx
│           ├── Dashboard.jsx
│           ├── Agendamentos.jsx
│           ├── Clientes.jsx
│           └── Configuracoes.jsx
├── Dockerfile
├── docker-compose.yml
└── README.md
```

### 3.2 Modelagem de Dados no Painel (`painel/backend/app/models.py`)
- **User**: `id, email, name, hashed_password, role, is_active, created_at`
- **ClientProfile**: `id, user_id, name, document_type, document, phone, valor_agendamento, is_active, created_at, updated_at`
- **Agendamento**: `id, execution_id, client_name, cliente_id, evento, convenio, data_evento, horario, ponto_encontro, endereco, tipo_vaga, status, modo, valor_cobrado, status_pagamento, data_agendamento, synced_at`
- **BillingConfig**: `id, key, value, updated_at` (armazena valor padrão por agendamento, ex: `default_slot_price = 30.00`)

### 3.3 Protocolo de Sincronização Local -> Painel
- Endpoint no painel: `POST /api/sync/push`
- Autenticação: Header `X-Sync-Token` ou Bearer JWT.
- Carga útil:
  - `users`: lista de usuários ativos locais
  - `clients`: lista de clientes locais
  - `agendamentos`: lista de agendamentos extraídos das execuções locais
- No backend local (`backend/app/services/sync_service.py`):
  - Rotina não-bloqueante que envia os dados para a URL configurada do painel (`PAINEL_URL` e `SYNC_SECRET_KEY`).
  - Execução automática ao iniciar, ao logar e após cada agendamento concluído com sucesso.

### 3.4 Interface do Painel (`painel/frontend`)
- **Login**: Tela limpa com autenticação via token JWT.
- **Dashboard**:
  - Cards de métricas: Total de agendamentos, clientes cadastrados, faturamento acumulado, total pendente de pagamento.
  - Tabela com últimos lançamentos realizados.
- **Agendamentos**:
  - Tabela paginada e filtrável por cliente, data e status de pagamento.
  - Ação rápida para alternar status de pagamento (Pendente / Pago).
- **Clientes e Cobrança**:
  - Lista de clientes com total de agendamentos obtidos e valor total faturado.
  - Edição do valor cobrado por agendamento (customizado por cliente ou usar valor padrão).
  - Controle de pagamentos por cliente.
- **Configurações**:
  - Definição do valor padrão global por agendamento.
  - Visualização do token de sincronização e status de conexão.
