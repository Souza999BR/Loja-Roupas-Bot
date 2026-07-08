import { Markup } from "telegraf";

export const mainMenuKeyboard = Markup.keyboard([
  ["📦 Produtos", "📊 Estoque"],
  ["💰 Vendas", "👥 Clientes"],
  ["🏭 Fornecedores", "💵 Financeiro"],
  ["📈 Dashboard", "📋 Relatórios"],
  ["⚙️ Configurações", "❓ Ajuda"],
]).resize();

export const cancelKeyboard = Markup.keyboard([["❌ Cancelar"]]).resize();

export const cancelSkipKeyboard = Markup.keyboard([
  ["⏭ Pular", "❌ Cancelar"],
]).resize();

export function productsMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Novo Produto", "product:start_add")],
    [Markup.button.callback("📋 Listar Produtos", "product:list:0")],
    [Markup.button.callback("⚠️ Estoque Baixo", "product:low_stock")],
  ]);
}

export function stockMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📋 Ver Estoque Atual", "stock:list")],
    [Markup.button.callback("➕ Registrar Entrada", "stock:entry")],
    [Markup.button.callback("➖ Registrar Saída", "stock:exit")],
    [Markup.button.callback("⚠️ Estoque Baixo", "stock:low")],
  ]);
}

export function salesMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("💰 Nova Venda", "sale:start")],
    [Markup.button.callback("📋 Histórico de Vendas", "sale:history")],
    [Markup.button.callback("📊 Resumo do Dia", "sale:today")],
  ]);
}

export function clientsMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Novo Cliente", "client:add")],
    [Markup.button.callback("📋 Listar Clientes", "client:list")],
  ]);
}

export function suppliersMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("➕ Novo Fornecedor", "supplier:add")],
    [Markup.button.callback("📋 Listar Fornecedores", "supplier:list")],
  ]);
}

export function reportsMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("📊 Relatório de Vendas", "report:sales")],
    [Markup.button.callback("💵 Relatório Financeiro", "report:financial")],
    [Markup.button.callback("📦 Relatório de Estoque", "report:stock")],
    [Markup.button.callback("👥 Relatório de Clientes", "report:clients")],
  ]);
}

export function settingsMenuInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("👤 Ver Perfil", "settings:profile")],
    [Markup.button.callback("🔑 Alterar Senha", "settings:change_password")],
    [Markup.button.callback("🚪 Sair da Conta", "settings:logout")],
  ]);
}

export function paymentMethodsInline() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("💳 PIX", "sale:pay:pix"),
      Markup.button.callback("💵 Dinheiro", "sale:pay:cash"),
    ],
    [
      Markup.button.callback("💳 Cartão Débito", "sale:pay:debit"),
      Markup.button.callback("💳 Cartão Crédito", "sale:pay:credit"),
    ],
    [
      Markup.button.callback("🏦 Transferência", "sale:pay:transfer"),
      Markup.button.callback("📝 Boleto", "sale:pay:boleto"),
    ],
  ]);
}

export function saleConfirmInline() {
  return Markup.inlineKeyboard([
    [Markup.button.callback("✅ Finalizar Venda", "sale:confirm")],
    [Markup.button.callback("➕ Adicionar Mais Itens", "sale:add_more")],
    [Markup.button.callback("❌ Cancelar Venda", "sale:cancel")],
  ]);
}

export function financialPeriodsInline() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback("Hoje", "financial:day"),
      Markup.button.callback("Esta Semana", "financial:week"),
    ],
    [
      Markup.button.callback("Este Mês", "financial:month"),
      Markup.button.callback("Total Geral", "financial:all"),
    ],
  ]);
}

export function productActionsInline(productId: number) {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(
        "➕ Entrada Estoque",
        `stock:entry:prod:${productId}`
      ),
      Markup.button.callback(
        "➖ Saída Estoque",
        `stock:exit:prod:${productId}`
      ),
    ],
    [Markup.button.callback("🗑 Remover Produto", `product:delete:${productId}`)],
    [Markup.button.callback("« Voltar à Lista", "product:list:0")],
  ]);
}
