import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import { mainMenuKeyboard } from "../keyboards.js";
import { getDashboardStats, fmt } from "../services.js";
import { requireAuth } from "./auth.js";

export async function showDashboard(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;

  await ctx.reply("⏳ Carregando dashboard...");

  const stats = await getDashboardStats(ctx.session.userId!);
  const store = ctx.session.storeName ?? "Sua Loja";

  const avgTicket =
    stats.todaySales.count > 0
      ? stats.todaySales.total / stats.todaySales.count
      : 0;

  const monthAvgTicket =
    stats.monthSales.count > 0
      ? stats.monthSales.total / stats.monthSales.count
      : 0;

  const msg =
    `📈 *Dashboard — ${store}*\n` +
    `━━━━━━━━━━━━━━━━━━\n\n` +
    `🌅 *Hoje:*\n` +
    `• Vendas: ${stats.todaySales.count}\n` +
    `• Faturamento: *${fmt(stats.todaySales.total)}*\n` +
    `• Lucro: *${fmt(stats.todaySales.profit)}*\n` +
    `• Ticket médio: ${fmt(avgTicket)}\n\n` +
    `📅 *Este Mês:*\n` +
    `• Vendas: ${stats.monthSales.count}\n` +
    `• Faturamento: *${fmt(stats.monthSales.total)}*\n` +
    `• Lucro: *${fmt(stats.monthSales.profit)}*\n` +
    `• Ticket médio: ${fmt(monthAvgTicket)}\n\n` +
    `📦 *Estoque:*\n` +
    `• Produtos cadastrados: ${stats.stock.totalProducts}\n` +
    `• Total em estoque: ${stats.stock.totalQty} un\n` +
    `${stats.stock.lowStockCount > 0 ? `• ⚠️ Baixo estoque: *${stats.stock.lowStockCount} produto(s)*\n` : "• ✅ Estoque OK\n"}` +
    `\n👥 *Clientes:* ${stats.clients}`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    ...mainMenuKeyboard,
  });
}
