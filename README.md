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
    catalogo/     categorias e unidades
    produtos/     cadastro de produtos
    lotes/        lotes e validade (FEFO)
    movimentacoes/ entradas, saídas e estornos
    alertas/      estoque mínimo e validade
    fornecedores/ cadastro e histórico de compras
    compras/      pedidos, recebimento e estorno
    desperdicios/ perdas, baixa no estoque e prejuízo
    comunicados/  mural interno, prioridade e leituras
    relatorios/   estoque, compras, desperdício e validade (JSON + CSV)
    configuracoes/ parâmetros da galeteria (chave/valor)
  routes/         centralizador das rotas da API
  app.js          montagem do Express (API + frontend estático)
  server.js       inicialização
frontend/
  index.html      tela de login
  pages/          dashboard/, estoque/, lotes/, movimentacoes/, fornecedores/,
                  compras/, desperdicio/, comunicacao/, relatorios/, configuracoes/,
                  usuarios/
  assets/         css/ e js/ (design system, layout, api)
database/
  migrations/     estrutura do banco
  seeds/          dados iniciais demonstrativos
scripts/          migrate.js, seed.js, test-api.js
tests/            suíte de integração da API (node:test)
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

## Testes automatizados

```bash
npm test
```

- Sobe a aplicação real em processo e cobre **autenticação/permissões, estoque**
  (entrada, saída e estorno), **compras** (pedido, recebimento e estorno),
  **desperdício** (baixa no lote, custo e estorno), **comunicação** (publicação,
  leitura, arquivamento) e **configurações** (parâmetros, auditoria e permissões).
- Usa um banco **isolado** `galeto_gestao_test`: criado, migrado e populado pelo
  seed na hora, e apagado ao final. O banco de desenvolvimento não é tocado.
- Runner nativo do Node (`node:test`), sem dependências adicionais.

## Checklist antes de produção

- [ ] Trocar as senhas dos usuários de demonstração (`admin`, `gerente`, `funcionario`).
- [ ] Apagar/desativar produtos, lotes, compras, perdas e comunicados de **teste**.
- [ ] Definir `NODE_ENV=production`, usar HTTPS e revisar o `JWT_SECRET` (forte e único).
- [ ] Rodar `npm test` e conferir os parâmetros em **Configurações** (nome, contato e
      janela de alerta de validade).
- [ ] Revisar usuários ativos e permissões (administrador/gerente/funcionário).

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

## API — Desperdício (Etapa 4)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/api/desperdicios` | Histórico de perdas (filtros `product_id`/`product` (nome), motivo, período e status) + resumo do prejuízo | Autenticado |
| POST | `/api/desperdicios` | Registra a perda e baixa o estoque no lote informado (`batch_id`) ou em FEFO quando não informado | Autenticado |
| POST | `/api/desperdicios/:id/estorno` | Devolve a quantidade aos lotes de origem e marca a perda como estornada | Administrador/Gerente |

## API — Comunicação e Relatórios (Etapa 5)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/api/comunicados` | Mural com prioridade, marcação de lido e contadores (arquivados: gestão) | Autenticado |
| POST | `/api/comunicados` | Publica um comunicado | Administrador/Gerente |
| POST | `/api/comunicados/:id/lido` | Marca o comunicado como lido | Autenticado |
| POST | `/api/comunicados/:id/arquivar` · `/reabrir` | Tira do mural / devolve ao mural | Administrador/Gerente |
| GET | `/api/comunicados/:id/leituras` | Quem leu e quando | Administrador/Gerente |
| GET | `/api/relatorios/:tipo` | `estoque`, `compras`, `desperdicio` ou `validade`, com filtros e resumo | Autenticado (compras: gestão) |
| GET | `/api/relatorios/:tipo?format=csv` | Mesmo relatório e filtros em CSV (Excel pt-BR) | Autenticado (compras: gestão) |

## API — Configurações e Auditoria (Etapa 6)

| Método | Rota | Descrição | Acesso |
|---|---|---|---|
| GET | `/api/configuracoes` | Parâmetros da galeteria (nome, contato e janela de alerta) | Autenticado |
| PUT | `/api/configuracoes` | Altera os parâmetros (auditado) | Administrador |
| GET | `/api/audit` | Auditoria paginada (filtros `user`, `module`, `action`, período) | Administrador |
| GET | `/api/audit?format=csv` | Mesma auditoria e filtros em CSV (até 5.000 eventos) | Administrador |

## Segurança implementada

- Senhas com hash **bcrypt** (custo 10).
- Sessão com **JWT em cookie HttpOnly, SameSite=Lax** (Secure em produção).
- **Permissões validadas no backend** (`requireAuth`/`requireRole`), nunca só no frontend.
- **Rate limiting** no login; proteção contra CSRF por guarda de mesma origem.
- Consultas **100% parametrizadas** (sem SQL Injection).
- Validação de dados no **backend** (e feedback no frontend), erros centralizados.
- **Auditoria** de login, logout, operações de funcionários e comunicados.
- Cabeçalhos de segurança (`nosniff`, anti-clickjacking, referrer policy).

## Status do projeto (por etapas)

- ✅ **Etapa 1 — Fundação:** estrutura, banco, autenticação, permissões, funcionários,
  auditoria, layout principal e dashboard inicial.
- ✅ **Etapa 2 — Estoque:** produtos, categorias, unidades, lotes, movimentações, FEFO.
- ✅ **Etapa 3 — Compras e fornecedores:** pedidos, recebimento com lotes e estorno.
- ✅ **Etapa 4 — Desperdício:** registro de perdas por motivo, baixa automática do estoque
  (vencidos primeiro), prejuízo pelo custo do lote, estorno e indicador no dashboard.
- ✅ **Etapa 5 — Comunicação, relatórios e dashboard completo:** mural de comunicados com
  prioridade e confirmação de leitura, central de relatórios (estoque, compras, desperdício
  e validade) com exportação CSV, valor do estoque e resumo do mês no dashboard.
- ✅ **Etapa 6 — Configurações, auditoria e finalização:** parâmetros da galeteria
  (nome, contato e janela de alerta de validade usada no dashboard/alertas), tela de
  auditoria completa com filtros por usuário/módulo/ação, exportação CSV e suíte de
  testes de integração da API.

Todas as etapas planejadas foram concluídas.

As tabelas de produtos, lotes e movimentações já existem no banco desde a Etapa 1,
para que as próximas etapas se integrem sem reestruturar o banco.
