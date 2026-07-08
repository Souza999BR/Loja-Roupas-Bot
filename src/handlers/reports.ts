import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import { reportsMenuInline } from "../keyboards.js";
import {
  getSales,
  getClients,
  getProducts,
  getLowStockProducts,
  getFinancialSummary,
  fmt,
  fmtDate,
  paymentLabel,
} from "../services.js";
import { requireAuth } from "./auth.js";

export async function showReportsMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("📋 *Menu de Relatórios*\n\nEscolha um relatório:", {
    parse_mode: "Markdown",
    ...reportsMenuInline(),
  });
}

export async function handleReportAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "report:sales") return generateSalesReport(ctx);
  if (data === "report:financial") return generateFinancialReport(ctx);
  if (data === "report:stock") return generateStockReport(ctx);
  if (data === "report:clients") return generateClientsReport(ctx);
}

async function generateSalesReport(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const recentSales = await getSales(userId, 30);

  if (recentSales.length === 0) {
    return ctx.reply("📊 Nenhuma venda registrada.", {
      ...reportsMenuInline(),
    });
  }

  const totalRevenue = recentSales.reduce(
    (s, v) => s + parseFloat(String(v.totalAmount)),
    0
  );
  const totalProfit = recentSales.reduce(
    (s, v) => s + parseFloat(String(v.profit)),
    0
  );

  const paymentCounts: Record<string, number> = {};
  for (const s of recentSales) {
    paymentCounts[s.paymentMethod] =
      (paymentCounts[s.paymentMethod] ?? 0) + 1;
  }

  const paymentLines = Object.entries(paymentCounts)
    .map(([k, v]) => `  • ${paymentLabel(k)}: ${v} venda(s)`)
    .join("\n");

  const saleLines = recentSales
    .slice(0, 10)
    .map(
      (s) =>
        `#${s.id} | ${fmtDate(s.createdAt).split(",")[0]} | ${fmt(parseFloat(String(s.totalAmount)))} | ${paymentLabel(s.paymentMethod)}`
    )
    .join("\n");

  await ctx.reply(
    `📊 *Relatório de Vendas* (últimas 30)\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `🛒 Total de vendas: ${recentSales.length}\n` +
    `💰 Receita total: *${fmt(totalRevenue)}*\n` +
    `📈 Lucro total: *${fmt(totalProfit)}*\n` +
    `💳 Ticket médio: ${fmt(totalRevenue / recentSales.length)}\n\n` +
    `*Formas de pagamento:*\n${paymentLines}\n\n` +
    `*Últimas 10 vendas:*\n\`\`\`\n${saleLines}\n\`\`\``,
    { parse_mode: "Markdown", ...reportsMenuInline() }
  );
}

async function generateFinancialReport(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const [day, month, all] = await Promise.all([
    getFinancialSummary(userId, "day"),
    getFinancialSummary(userId, "month"),
    getFinancialSummary(userId, "all"),
  ]);

  const monthMargin =
    month.revenue > 0
      ? ((month.profit / month.revenue) * 100).toFixed(1)
      : "0.0";
  const allMargin =
    all.revenue > 0 ? ((all.profit / all.revenue) * 100).toFixed(1) : "0.0";

  await ctx.reply(
    `💵 *Relatório Financeiro*\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `🌅 *Hoje:*\n` +
    `  Vendas: ${day.totalSales} | Receita: ${fmt(day.revenue)} | Lucro: *${fmt(day.profit)}*\n\n` +
    `📅 *Este Mês:*\n` +
    `  Vendas: ${month.totalSales}\n` +
    `  Receita: *${fmt(month.revenue)}*\n` +
    `  Custo: ${fmt(month.totalCost)}\n` +
    `  Lucro: *${fmt(month.profit)}*\n` +
    `  Margem: ${monthMargin}%\n\n` +
    `📊 *Total Geral:*\n` +
    `  Vendas: ${all.totalSales}\n` +
    `  Receita: *${fmt(all.revenue)}*\n` +
    `  Custo: ${fmt(all.totalCost)}\n` +
    `  Lucro: *${fmt(all.profit)}*\n` +
    `  Margem: ${allMargin}%`,
    { parse_mode: "Markdown", ...reportsMenuInline() }
  );
}

async function generateStockReport(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const [allProducts, lowStock] = await Promise.all([
    getProducts(userId),
    getLowStockProducts(userId),
  ]);

  const totalQty = allProducts.reduce((s, p) => s + p.quantityAvailable, 0);
  const totalValue = allProducts.reduce(
    (s, p) => s + parseFloat(String(p.salePrice ?? "0")) * p.quantityAvailable,
    0
  );
  const totalCostValue = allProducts.reduce(
    (s, p) => s + parseFloat(String(p.costPrice ?? "0")) * p.quantityAvailable,
    0
  );

  const productLines = allProducts
    .slice(0, 15)
    .map(
      (p) =>
        `${p.quantityAvailable <= p.quantityMin ? "⚠️" : "✅"} ${p.name}: ${p.quantityAvailable} un`
    )
    .join("\n");

  const lowLines =
    lowStock.length > 0
      ? lowStock
          .map((p) => `  ⚠️ ${p.name}: ${p.quantityAvailable}/${p.quantityMin}`)
          .join("\n")
      : "  ✅ Nenhum";

  await ctx.reply(
    `📦 *Relatório de Estoque*\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `📊 Produtos cadastrados: ${allProducts.length}\n` +
    `📦 Total em estoque: ${totalQty} unidades\n` +
    `💰 Valor em estoque (venda): *${fmt(totalValue)}*\n` +
    `📦 Valor em estoque (custo): ${fmt(totalCostValue)}\n\n` +
    `*Estoque baixo (${lowStock.length}):*\n${lowLines}\n\n` +
    `*Produtos (até 15):*\n${productLines}`,
    { parse_mode: "Markdown", ...reportsMenuInline() }
  );
}

async function generateClientsReport(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allClients = await getClients(userId);

  if (allClients.length === 0) {
    return ctx.reply("👥 Nenhum cliente cadastrado.", {
      ...reportsMenuInline(),
    });
  }

  const lines = allClients
    .slice(0, 20)
    .map(
      (c) =>
        `👤 *${c.name}*${c.phone ? ` — ${c.phone}` : ""}`
    )
    .join("\n");

  await ctx.reply(
    `👥 *Relatório de Clientes*\n` +
    `━━━━━━━━━━━━━━━━\n\n` +
    `Total cadastrados: ${allClients.length}\n\n${lines}`,
    { parse_mode: "Markdown", ...reportsMenuInline() }
  );
}
