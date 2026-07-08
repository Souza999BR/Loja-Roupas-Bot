import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import { financialPeriodsInline, mainMenuKeyboard } from "../keyboards.js";
import { getFinancialSummary, fmt } from "../services.js";
import { requireAuth } from "./auth.js";

export async function showFinancialMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply(
    "💵 *Controle Financeiro*\n\nSelecione o período de análise:",
    { parse_mode: "Markdown", ...financialPeriodsInline() }
  );
}

export async function handleFinancialAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  const periodMap: Record<string, "day" | "week" | "month" | "all"> = {
    "financial:day": "day",
    "financial:week": "week",
    "financial:month": "month",
    "financial:all": "all",
  };

  const periodLabel: Record<string, string> = {
    "financial:day": "Hoje",
    "financial:week": "Esta Semana",
    "financial:month": "Este Mês",
    "financial:all": "Total Geral",
  };

  const period = periodMap[data];
  if (!period) return;

  const summary = await getFinancialSummary(ctx.session.userId!, period);
  const label = periodLabel[data] ?? "";

  const margin =
    summary.revenue > 0
      ? ((summary.profit / summary.revenue) * 100).toFixed(1)
      : "0.0";

  const msg =
    `💵 *Financeiro — ${label}*\n` +
    `━━━━━━━━━━━━━━━━━\n\n` +
    `🛒 Vendas realizadas: ${summary.totalSales}\n\n` +
    `💰 *Receita bruta: ${fmt(summary.revenue)}*\n` +
    `📦 Custo das mercadorias: ${fmt(summary.totalCost)}\n` +
    `━━━━━━━━━━━━━━━━━\n` +
    `📈 *Lucro líquido: ${fmt(summary.profit)}*\n` +
    `📊 Margem de lucro: ${margin}%\n\n` +
    `${summary.profit >= 0 ? "✅ Resultado positivo!" : "❌ Resultado negativo!"}`;

  await ctx.reply(msg, {
    parse_mode: "Markdown",
    ...financialPeriodsInline(),
  });
}
