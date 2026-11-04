# Galeto Gestão 🐔

Sistema web de **gestão operacional da Galeto São Luís** (galeteria — Jacintinho, Maceió/AL),
desenvolvido para a feira de ciências **RTECH**.

Centraliza estoque, lotes/validade, desperdício, compras, fornecedores, comunicação
interna, relatórios, funcionários e auditoria — substituindo cadernos e anotações
espalhadas por um único sistema com permissões por perfil.

## Tecnologias

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5, CSS3, JavaScript puro (sem frameworks) |
| Backend | Node.js + Express (API REST, monólito modular) |
| Banco de dados | MySQL/MariaDB (pool `mysql2`, transações SQL nas etapas seguintes) |
| Autenticação | JWT em cookie HttpOnly + bcrypt para senhas |

> **Banco deste ambiente:** o sistema usa a instância **MariaDB 10.4 local na porta 3308**
> (compatível com MySQL e gerenciada pelo driver `mysql2`). Para usar o MySQL Server 8.0
> instalado na porta 3306, basta ajustar `DB_PORT`, `DB_USER` e `DB_PASSWORD` no `.env`.

## Estrutura do projeto

```
backend/
  config/         conexão com o banco (pool)
  middleware/     autenticação, RBAC, rate limit, CSRF, tratamento de erros
  modules/
    auth/         login/logout/sessão (routes, controller, service, repository)
    users/        funcionários e permissões
    audit/        registro de atividades
    dashboard/    indicadores do painel
  routes/         centralizador das rotas da API
  app.js          montagem do Express (API + frontend estático)
  server.js       inicialização
frontend/
  index.html      tela de login
  pages/          dashboard/, usuarios/, breve/ (módulos futuros)
  assets/         css/ e js/ (design system, layout, api)
database/
  migrations/     estrutura do banco
  seeds/          dados iniciais demonstrativos
scripts/          migrate.js, seed.js
```

## Como executar

1. **Pré-requisitos:** Node.js 18+ e MySQL/MariaDB em execução.
2. Configurar o `.env` (veja `.env.example`) com as credenciais do banco.
3. Instalar dependências e preparar o banco:

   ```bash
   npm install
   npm run setup        # migrations + seeds
   ```

4. Iniciar o servidor:

   ```bash
   npm start            # http://localhost:3000
   ```

## Acessos demonstrativos criados pelo seed

> ⚠️ Dados **de demonstração** — trocar as senhas no primeiro uso.

| Perfil | Login | Senha |
|---|---|---|
| Administrador | `admin` ou `admin@galeto.local` | `Galeto@2026` |
| Gerente | `gerente` ou `gerente@galeto.local` | `Galeto@2026` |
| Funcionário | `funcionario` ou `funcionario@galeto.local` | `Galeto@2026` |

## API — Etapa 1

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/api/health` | Verificação do serviço | Público |
| POST | `/api/auth/login` | Login (rate limit: 10 tent./15 min) | Público |
| GET | `/api/auth/me` | Dados do usuário autenticado | Autenticado |
| POST | `/api/auth/logout` | Encerrar sessão | Autenticado |
| GET | `/api/dashboard/summary` | Indicadores + atividade recente | Autenticado |
| GET/POST | `/api/users` | Listar / criar funcionários | Administrador |
| PUT | `/api/users/:id` | Editar funcionário | Administrador |
| POST | `/api/users/:id/activate` · `/deactivate` | Ativar/desativar conta | Administrador |
| GET | `/api/audit` | Histórico de auditoria (filtros + paginação) | Administrador |

## Segurança implementada

- Senhas com hash **bcrypt** (custo 10).
- Sessão com **JWT em cookie HttpOnly, SameSite=Lax** (Secure em produção).
- **Permissões validadas no backend** (`requireAuth`/`requireRole`), nunca só no frontend.
- **Rate limiting** no login; proteção contra CSRF por guarda de mesma origem.
- Consultas **100% parametrizadas** (sem SQL Injection).
- Validação de dados no **backend** (e feedback no frontend), erros centralizados.
- **Auditoria** de login, logout e operações de funcionários.
- Cabeçalhos de segurança (`nosniff`, anti-clickjacking, referrer policy).

## Status do projeto (por etapas)

- ✅ **Etapa 1 — Fundação** (esta entrega): estrutura, banco, autenticação, permissões,
  funcionários, auditoria, layout principal e dashboard inicial.
- ⏭️ **Etapa 2 — Estoque:** produtos, categorias, unidades, lotes, movimentações, FEFO.
- ⏭️ Etapa 3 — Compras e fornecedores · Etapa 4 — Desperdício ·
  Etapa 5 — Comunicação, relatórios e dashboard completo · Etapa 6 — Testes e finalização.

As tabelas de produtos, lotes e movimentações já existem no banco desde a Etapa 1,
para que as próximas etapas se integrem sem reestruturar o banco.
