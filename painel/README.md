# Painel CPROEIS - Deploy no Easypanel

Painel web para visualização de agendamentos, clientes e controle financeiro de cobrança por vaga.

## Como implantar no Easypanel

1. Crie um novo **App** (tipo Docker ou GitHub) no Easypanel.
2. Defina o caminho raiz como a pasta `painel` (ou aponte para o repositório).
3. Selecione o método de build **Dockerfile** apontando para `Dockerfile`.
4. Configure as variáveis de ambiente:
   - `PORT=8000`
   - `ADMIN_EMAIL=seu-email@dominio.com`
   - `ADMIN_PASSWORD=SuaSenhaForte`
   - `SYNC_SECRET_KEY=sua_chave_secreta_de_sincronizacao`
   - `JWT_SECRET=sua_chave_jwt`
5. Adicione um volume persistente (Montagem de volume):
   - Caminho do Host: `./data` ou volume gerenciado do Easypanel
   - Caminho no Container: `/app/data`
6. Defina a porta exposta como `8000` e ative o domínio / SSL automático.

## Como conectar o sistema local ao painel

No arquivo `.env` do seu sistema local (na raiz do projeto), adicione:
```
PAINEL_URL=https://seu-painel.seu-dominio.com
SYNC_SECRET_KEY=sua_chave_secreta_de_sincronizacao
```

O sistema local enviará automaticamente clientes, usuários e agendamentos confirmados para o painel em segundo plano.
