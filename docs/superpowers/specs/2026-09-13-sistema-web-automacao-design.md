# Especificação Técnica do Sistema Web de Automação

## Visão Geral
Sistema web monorepo para gerenciamento e execução da automação CPROEIS, com controle de usuários, menu de configurações e suporte a deploy no Easypanel via Docker Compose.

## Arquitetura do Monorepo

```
Automacao Navegador/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models.py
│   │   ├── schemas.py
│   │   ├── security.py
│   │   ├── routes/
│   │   │   ├── auth.py
│   │   │   ├── users.py
│   │   │   ├── settings.py
│   │   │   ├── bot.py
│   │   │   └── comprovantes.py
│   │   └── services/
│   │       ├── bot_runner.py
│   │       └── vagas_service.py
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── api/
│   │   ├── components/
│   │   │   ├── Layout.jsx
│   │   │   ├── Sidebar.jsx
│   │   │   ├── Header.jsx
│   │   │   ├── StatusBadge.jsx
│   │   │   └── Skeleton.jsx
│   │   └── pages/
│   │       ├── Login.jsx
│   │       ├── Dashboard.jsx
│   │       ├── Settings.jsx
│   │       ├── Users.jsx
│   │       └── Comprovantes.jsx
│   ├── package.json
│   ├── vite.config.js
│   └── index.html
├── docker-compose.yml
├── Dockerfile
├── .env.example
├── iniciar.bat
└── requirements.txt
```

## Banco de Dados e Autenticação
- SQLite local (`data/app.db`) montado em volume persistente.
- Usuário master inicial criado automaticamente na inicialização a partir de `ADMIN_EMAIL` e `ADMIN_PASSWORD` do `.env`.
- JWT para autenticação de sessões com expiração configurável.
- Níveis de permissão: `master` (acesso total e gestão de usuários) e `operador` (execução do bot, consulta de vagas e visualização de comprovantes).

## Integração com Automação
- Execução assíncrona do bot em background process com captura de logs em tempo real via streaming/polling ou WebSocket.
- Modo de homologação (dry run): permite testar login, navegação, resolução de captcha e detecção de vagas sem efetivar o agendamento real (não clica na confirmação final).
- Suporte a parada forçada da automação.
- Consulta de vagas direta via endpoint.
- Visualização e download de arquivos da pasta `comprovantes/`.

## Conformidade com o Easypanel
- `docker-compose.yml` definindo o serviço `app` exposto na porta configurada pela variável `PORT` (padrão 3000).
- `Dockerfile` com multi-stage build: constrói o frontend Vite e empacota o backend FastAPI com as dependências do Playwright e navegadores Chromium.
- Suporte a injeção de variáveis pelo painel de ambiente do Easypanel.

## Diretrizes de Interface
- Tema neutro escuro/cinza com no máximo 1 cor de destaque.
- Sem emojis na interface.
- Skeleton loader para todos os estados de carregamento (tabelas, cards, formulários e logs), garantindo transição leve e fluida sem spinners pesados.
- Sem efeitos de glow, neon, gradientes pesados ou sombras excessivas.
- Formato de texto em sentence case.
- Textos diretos e objetivos.
