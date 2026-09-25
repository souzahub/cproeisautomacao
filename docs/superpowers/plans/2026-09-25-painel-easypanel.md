# Plano de Implementação: Painel de Gestão e Cobrança para Easypanel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a aplicação dedicada `painel/` para deploy no Easypanel com banco SQLite próprio, rotas de sincronização, autenticação, acompanhamento de agendamentos e controle de cobrança financeira por agendamento, além de adicionar o serviço de sincronização em segundo plano no app local.

**Architecture:** O painel em nuvem (`painel/`) roda como um container Docker unificado no Easypanel contendo API FastAPI + SPA Frontend integrado. O sistema local executa um serviço não-bloqueante em segundo plano que sincroniza usuários, clientes e agendamentos confirmados sempre que houver conexão.

**Tech Stack:** Python 3.11, FastAPI, SQLAlchemy, SQLite, React 18, Vite, Vanilla CSS.

**Spec:** `docs/superpowers/specs/2026-09-25-painel-easypanel-design.md`

## Global Constraints
- Total preservação da compatibilidade e funcionamento do sistema local.
- Sem comentários no código gerado ou alterado.
- Sem emojis em nenhum lugar da interface.
- Sem gradientes, glow, neon, blur ou sombras pesadas.
- Sem ícones decorativos sem função.
- Sem bordas arredondadas em excesso (pill só para tags/status).
- Texto direto em sentence case.

---

### Task 1: Backend do Painel (`painel/backend/app/`)
- Criar models, schemas, database, config, security e rotas de auth, sync, clients, agendamentos, billing e settings.

### Task 2: Frontend do Painel (`painel/frontend/`)
- Criar interface React com Vite contendo Login, Dashboard de Métricas, Listagem de Agendamentos/Lançamentos com status de cobrança, Gestão de Clientes e Configurações de Preço por Agendamento.

### Task 3: Configuração de Deploy para Easypanel (`painel/`)
- Criar `painel/Dockerfile`, `painel/docker-compose.yml`, `painel/.env.example` e `painel/README.md`.

### Task 4: Serviço de Sincronização no Sistema Local
- Criar `backend/app/services/sync_service.py` no app local para enviar clientes, usuários e agendamentos ao painel de forma segura e assíncrona.

### Task 5: Validação e Testes
- Testar execução do backend do painel, verificar persistência SQLite, validar rotas de sincronização e build do frontend.
