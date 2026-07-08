import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import {
  cancelKeyboard,
  mainMenuKeyboard,
  paymentMethodsInline,
  saleConfirmInline,
  salesMenuInline,
} from "../keyboards.js";
import {
  getProducts,
  getProductById,
  createSale,
  getSales,
  getSaleItems,
  fmt,
  fmtDate,
  paymentLabel,
  computeProductFinancials,
} from "../services.js";
import { requireAuth } from "./auth.js";
import { Markup } from "telegraf";

export async function showSalesMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("💰 *Menu de Vendas*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...salesMenuInline(),
  });
}

export async function handleSaleAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "sale:start") return startNewSale(ctx);
  if (data === "sale:history") return showSaleHistory(ctx);
  if (data === "sale:today") return showTodaySales(ctx);
  if (data === "sale:add_more") return addMoreItems(ctx);
  if (data === "sale:confirm") return finalizeSale(ctx);
  if (data === "sale:cancel") return cancelSale(ctx);

  if (data.startsWith("sale:pay:")) {
    const method = data.split(":")[2] ?? "";
    return handlePaymentSelected(ctx, method);
  }

  if (data.startsWith("sale:prod:")) {
    const id = parseInt(data.split(":")[2] ?? "0");
    return handleProductSelected(ctx, id);
  }
}

async function startNewSale(ctx: BotContext) {
  ctx.session.saleItems = [];
  ctx.session.data = {};
  return addMoreItems(ctx);
}

async function addMoreItems(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allProducts = await getProducts(userId);

  if (allProducts.length === 0) {
    return ctx.reply(
      "❌ Nenhum produto cadastrado. Cadastre produtos primeiro.",
      { ...salesMenuInline() }
    );
  }

  const available = allProducts.filter((p) => p.quantityAvailable > 0);
  if (available.length === 0) {
    return ctx.reply("❌ Nenhum produto com estoque disponível.", {
      ...salesMenuInline(),
    });
  }

  const buttons = available.slice(0, 20).map((p) => [
    Markup.button.callback(
      `${p.name} — ${fmt(parseFloat(p.salePrice ?? "0"))} (${p.quantityAvailable} un)`,
      `sale:prod:${p.id}`
    ),
  ]);

  const items = ctx.session.saleItems ?? [];
  const headerMsg =
    items.length > 0
      ? `🛒 *Itens adicionados:* ${items.length}\n💰 Subtotal: ${fmt(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))}\n\n`
      : "";

  ctx.session.state = STATES.SALE_ADD_PRODUCT;
  await ctx.reply(
    `${headerMsg}💰 *Nova Venda*\nSelecione o produto:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );
}

async function handleProductSelected(ctx: BotContext, productId: number) {
  const product = await getProductById(productId, ctx.session.userId!);
  if (!product) return ctx.reply("❌ Produto não encontrado.");

  ctx.session.data.selectedProductId = productId;
  ctx.session.state = STATES.SALE_ADD_QTY;

  await ctx.reply(
    `📦 *${product.name}*\nPreço: ${fmt(parseFloat(product.salePrice ?? "0"))}\nDisponível: ${product.quantityAvailable} un\n\nQuantidade:`,
    { parse_mode: "Markdown", ...cancelKeyboard }
  );
}

export async function handleTextInSaleState(
  ctx: BotContext,
  text: string,
  state: string
) {
  if (state === STATES.SALE_ADD_QTY) {
    const qty = parseInt(text);
    if (isNaN(qty) || qty <= 0)
      return ctx.reply("❌ Quantidade inválida. Digite um número inteiro positivo:");

    const productId = Number(ctx.session.data.selectedProductId);
    const product = await getProductById(productId, ctx.session.userId!);
    if (!product) {
      ctx.session.state = STATES.IDLE;
      return ctx.reply("❌ Produto não encontrado.", { ...mainMenuKeyboard });
    }

    if (qty > product.quantityAvailable) {
      return ctx.reply(
        `❌ Estoque insuficiente!\nDisponível: ${product.quantityAvailable} un\nTente uma quantidade menor:`
      );
    }

    const fin = computeProductFinancials(product);
    const items = ctx.session.saleItems ?? [];
    items.push({
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: fin.salePrice,
      unitCost: fin.totalCost,
    });
    ctx.session.saleItems = items;

    const subtotal = items.reduce(
      (s, i) => s + i.unitPrice * i.quantity,
      0
    );

    ctx.session.state = STATES.IDLE;
    await ctx.reply(
      `✅ *${product.name}* x${qty} adicionado!\n💰 Subtotal: ${fmt(subtotal)}\n\nO que deseja fazer?`,
      { parse_mode: "Markdown", ...saleConfirmInline() }
    );
    return;
  }

  if (state === STATES.SALE_ADD_CLIENT) {
    const skip = text === "⏭ Pular";
    if (!skip) ctx.session.data.clientName = text.trim();
    ctx.session.state = STATES.SALE_ADD_NOTES;
    return ctx.reply(
      "📝 Observações sobre a venda (ou ⏭ Pular):",
      {
        reply_markup: {
          keyboard: [["⏭ Pular", "❌ Cancelar"]],
          resize_keyboard: true,
        },
      }
    );
  }

  if (state === STATES.SALE_ADD_NOTES) {
    const skip = text === "⏭ Pular";
    if (!skip) ctx.session.data.saleNotes = text.trim();
    return showSaleConfirmation(ctx);
  }
}

async function handlePaymentSelected(ctx: BotContext, method: string) {
  ctx.session.data.paymentMethod = method;
  ctx.session.state = STATES.SALE_ADD_CLIENT;
  await ctx.reply(
    `💳 Pagamento: *${paymentLabel(method)}*\n\nNome do cliente (ou ⏭ Pular):`,
    {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [["⏭ Pular", "❌ Cancelar"]],
        resize_keyboard: true,
      },
    }
  );
}

async function showSaleConfirmation(ctx: BotContext) {
  const items = ctx.session.saleItems ?? [];
  const paymentMethod = String(ctx.session.data.paymentMethod ?? "");
  const clientName = ctx.session.data.clientName
    ? String(ctx.session.data.clientName)
    : null;

  const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const profit = totalAmount - totalCost;

  const itemLines = items
    .map((i) => `• ${i.productName} x${i.quantity} = ${fmt(i.unitPrice * i.quantity)}`)
    .join("\n");

  await ctx.reply(
    `📋 *Confirmar Venda*\n━━━━━━━━━━━━━\n${itemLines}\n━━━━━━━━━━━━━\n💰 Total: *${fmt(totalAmount)}*\n💳 Pagamento: ${paymentLabel(paymentMethod)}\n${clientName ? `👤 Cliente: ${clientName}\n` : ""}📈 Lucro: ${fmt(profit)}`,
    { parse_mode: "Markdown", ...saleConfirmInline() }
  );
}

async function finalizeSale(ctx: BotContext) {
  const items = ctx.session.saleItems ?? [];
  if (items.length === 0) {
    return ctx.reply("❌ Nenhum item na venda.", { ...salesMenuInline() });
  }

  const paymentMethod = String(ctx.session.data.paymentMethod ?? "");
  if (!paymentMethod) {
    ctx.session.state = STATES.IDLE;
    await ctx.reply("💳 Selecione a forma de pagamento:", paymentMethodsInline());
    return;
  }

  const clientName = ctx.session.data.clientName
    ? String(ctx.session.data.clientName)
    : null;
  const notes = ctx.session.data.saleNotes
    ? String(ctx.session.data.saleNotes)
    : null;

  const totalAmount = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const totalCost = items.reduce((s, i) => s + i.unitCost * i.quantity, 0);
  const profit = totalAmount - totalCost;

  try {
    const sale = await createSale(
      {
        userId: ctx.session.userId!,
        clientName,
        paymentMethod,
        totalAmount: String(totalAmount),
        totalCost: String(totalCost),
        profit: String(profit),
        notes,
      },
      items
    );

    ctx.session.saleItems = [];
    ctx.session.data = {};
    ctx.session.state = STATES.IDLE;

    await ctx.reply(
      `🎉 *Venda Registrada com Sucesso!*\n\n📋 Venda #${sale.id}\n💰 Total: *${fmt(totalAmount)}*\n💳 ${paymentLabel(paymentMethod)}\n${clientName ? `👤 ${clientName}\n` : ""}📈 Lucro: *${fmt(profit)}*\n\n✅ Estoque atualizado automaticamente!`,
      { parse_mode: "Markdown", ...salesMenuInline() }
    );
  } catch (err) {
    ctx.session.state = STATES.IDLE;
    await ctx.reply("❌ Erro ao registrar venda. Tente novamente.", {
      ...mainMenuKeyboard,
    });
  }
}

async function cancelSale(ctx: BotContext) {
  ctx.session.saleItems = [];
  ctx.session.data = {};
  ctx.session.state = STATES.IDLE;
  await ctx.reply("❌ Venda cancelada.", { ...salesMenuInline() });
}

async function showSaleHistory(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const recentSales = await getSales(userId, 10);

  if (recentSales.length === 0) {
    return ctx.reply(
      "📋 Nenhuma venda registrada ainda.\n\nUse *💰 Nova Venda* para registrar.",
      { parse_mode: "Markdown", ...salesMenuInline() }
    );
  }

  const lines = recentSales
    .map(
      (s) =>
        `#${s.id} • ${fmtDate(s.createdAt)}\n   ${fmt(parseFloat(String(s.totalAmount)))} • ${paymentLabel(s.paymentMethod)}\n   📈 ${fmt(parseFloat(String(s.profit)))}`
    )
    .join("\n\n");

  await ctx.reply(
    `📋 *Últimas ${recentSales.length} Vendas*\n\n${lines}`,
    { parse_mode: "Markdown", ...salesMenuInline() }
  );
}

async function showTodaySales(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allSales = await getSales(userId, 100);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todaySales = allSales.filter((s) => new Date(s.createdAt) >= today);

  const total = todaySales.reduce(
    (s, v) => s + parseFloat(String(v.totalAmount)),
    0
  );
  const profit = todaySales.reduce(
    (s, v) => s + parseFloat(String(v.profit)),
    0
  );

  const lines =
    todaySales.length > 0
      ? todaySales
          .map(
            (s) =>
              `• #${s.id} ${fmt(parseFloat(String(s.totalAmount)))} — ${paymentLabel(s.paymentMethod)}`
          )
          .join("\n")
      : "_Nenhuma venda hoje_";

  await ctx.reply(
    `📊 *Resumo do Dia*\n━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━\n🛒 Vendas: ${todaySales.length}\n💰 Total: *${fmt(total)}*\n📈 Lucro: *${fmt(profit)}*`,
    { parse_mode: "Markdown", ...salesMenuInline() }
  );
}

export async function handleSalePaymentPrompt(ctx: BotContext) {
  const items = ctx.session.saleItems ?? [];
  if (items.length === 0) return;

  const subtotal = items.reduce(
    (s, i) => s + i.unitPrice * i.quantity,
    0
  );
  ctx.session.state = STATES.IDLE;
  await ctx.reply(
    `💰 Subtotal: *${fmt(subtotal)}*\n\n💳 Selecione a forma de pagamento:`,
    { parse_mode: "Markdown", ...paymentMethodsInline() }
  );
}
