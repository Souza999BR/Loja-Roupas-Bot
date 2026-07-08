# 🛍️ LojaRoupasBot

Bot de gestão completa para lojas de roupas via Telegram.

## Funcionalidades

| Módulo | Descrição |
|---|---|
| 📦 Produtos | Cadastro com custo, venda, custos extras (sacola, mimo, frete, comissão) e foto |
| 📊 Estoque | Entradas e saídas manuais, alertas de estoque baixo |
| 💰 Vendas | Carrinho com múltiplos itens, 6 formas de pagamento, lucro automático |
| 👥 Clientes | Cadastro com nome, telefone e e-mail |
| 🏭 Fornecedores | Cadastro com contato e telefone |
| 💵 Financeiro | Receita, custo e lucro por dia / semana / mês / total |
| 📈 Dashboard | Resumo do dia + mês + estoque + clientes |
| 📋 Relatórios | Relatórios de vendas, financeiro, estoque e clientes |
| ⚙️ Configurações | Ver perfil, alterar senha, logout |

---

## Pré-requisitos

- **Node.js 20+**
- **PostgreSQL 14+**
- **Token do bot Telegram** (obtido no [@BotFather](https://t.me/BotFather))

---

## Instalação

### 1. Instalar dependências

```bash
npm install
```

### 2. Configurar variáveis de ambiente

Copie o arquivo de exemplo e preencha:

```bash
cp .env.example .env
```

Edite o `.env`:

```env
TELEGRAM_BOT_TOKEN=seu_token_aqui
DATABASE_URL=postgresql://usuario:senha@localhost:5432/lojaroupasbot
```

### 3. Criar o banco de dados

Crie o banco no PostgreSQL:

```sql
CREATE DATABASE lojaroupasbot;
```

### 4. Aplicar o schema no banco

```bash
npm run db:push
```

### 5. Iniciar o bot

**Desenvolvimento (com hot-reload):**
```bash
npm run dev
```

**Produção:**
```bash
npm run build
npm start
```

---

## Estrutura do projeto

```
src/
├── main.ts              # Ponto de entrada
├── bot.ts               # Setup do Telegraf e roteamento
├── types.ts             # Tipos TypeScript e constantes de estado
├── keyboards.ts         # Teclados do Telegram (reply + inline)
├── services.ts          # Funções de banco de dados
├── schema.ts            # Schema Drizzle ORM
├── db.ts                # Conexão com o banco
├── logger.ts            # Logger (pino)
└── handlers/
    ├── auth.ts          # Cadastro e login
    ├── products.ts      # Gestão de produtos
    ├── stock.ts         # Controle de estoque
    ├── sales.ts         # Registro de vendas
    ├── clients.ts       # Cadastro de clientes
    ├── suppliers.ts     # Cadastro de fornecedores
    ├── dashboard.ts     # Dashboard resumo
    ├── financial.ts     # Controle financeiro
    ├── reports.ts       # Relatórios
    └── settings.ts      # Configurações do usuário
```

---

## Comandos do bot

| Comando | Descrição |
|---|---|
| `/start` | Iniciar / Criar conta / Login |
| `/menu` | Voltar ao menu principal |
| `/cancelar` | Cancelar ação atual |
| `/ajuda` | Lista de comandos |

---

## Tecnologias

- **Telegraf v4** — Framework para bots Telegram
- **Drizzle ORM** — Acesso ao banco de dados
- **PostgreSQL** — Banco de dados
- **bcryptjs** — Hash de senhas
- **TypeScript** — Tipagem estática
- **pino** — Logger de alta performance

---

## Hospedagem recomendada

Para rodar 24/7 com baixo custo:

- **Railway** — [railway.app](https://railway.app) (plano free inclui PostgreSQL)
- **Render** — [render.com](https://render.com)
- **VPS** com PM2: `npm install -g pm2 && pm2 start npm -- start`

---

## Deploy na Discloud

O projeto já inclui o `discloud.config` na raiz, pronto para uso.

1. **Banco de dados**: a Discloud não oferece PostgreSQL. Crie um banco externo
   gratuito (Neon, Supabase, Railway, Render ou Aiven) e copie a URL de conexão.
2. **Variáveis de ambiente**: no painel da Discloud, cadastre:
   - `TELEGRAM_BOT_TOKEN`
   - `DATABASE_URL` (a URL do banco externo)
   - `NODE_ENV=production`
   - `LOG_LEVEL=info` (opcional)
3. **Criar as tabelas no banco**: rode uma vez, a partir da sua máquina,
   apontando `DATABASE_URL` para o banco externo:
   ```bash
   npm run db:push
   ```
   (Também há migrações versionadas em `drizzle/`, geradas com `npm run db:generate`
   e aplicáveis com `npm run db:migrate`, caso prefira esse fluxo.)
4. **Empacotar o projeto**: compacte a pasta do projeto em `.zip`, **sem** incluir
   `node_modules`, `dist`, `.git` e `.env` (todos já listados no `.gitignore`).
5. **Enviar o `.zip` para a Discloud**. O `discloud.config` já define
   `TYPE=node`, `VERSION=22` e `START=npm start` — o `npm start` compila o
   TypeScript (`tsc`) e depois inicia `dist/main.js` automaticamente.
6. **Acompanhar os logs** no painel da Discloud para confirmar:
   - `Database connected` / sem erros de conexão com o banco
   - `LojaRoupasBot iniciado com sucesso!`

---

## Licença

MIT — use livremente para fins pessoais e comerciais.
