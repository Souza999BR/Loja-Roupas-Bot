import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import { cancelKeyboard, mainMenuKeyboard, stockMenuInline } from "../keyboards.js";
import {
  getProducts,
  getProductById,
  updateProductQuantity,
  addStockMovement,
  getLowStockProducts,
  fmt,
} from "../services.js";
import { requireAuth } from "./auth.js";
import { Markup } from "telegraf";

export async function showStockMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("📊 *Menu de Estoque*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...stockMenuInline(),
  });
}

export async function handleStockAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "stock:list") return showStockList(ctx);
  if (data === "stock:low") return showLowStock(ctx);
  if (data === "stock:entry") return startStockEntry(ctx);
  if (data === "stock:exit") return startStockExit(ctx);

  if (data.startsWith("stock:entry:prod:")) {
    const id = parseInt(data.split(":")[3] ?? "0");
    ctx.session.data.productId = id;
    ctx.session.data.movementType = "entry";
    ctx.session.state = STATES.STOCK_ENTRY_QTY;
    const prod = await getProductById(id, ctx.session.userId!);
    return ctx.reply(
      `➕ *Entrada de Estoque*\n📦 Produto: *${prod?.name}*\nEstoque atual: ${prod?.quantityAvailable} un\n\nQuantidade a adicionar:`,
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data.startsWith("stock:exit:prod:")) {
    const id = parseInt(data.split(":")[3] ?? "0");
    ctx.session.data.productId = id;
    ctx.session.data.movementType = "exit";
    ctx.session.state = STATES.STOCK_EXIT_QTY;
    const prod = await getProductById(id, ctx.session.userId!);
    return ctx.reply(
      `➖ *Saída de Estoque*\n📦 Produto: *${prod?.name}*\nEstoque atual: ${prod?.quantityAvailable} un\n\nQuantidade a remover:`,
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data.startsWith("stock:select:entry:")) {
    const id = parseInt(data.split(":")[3] ?? "0");
    ctx.session.data.productId = id;
    ctx.session.data.movementType = "entry";
    ctx.session.state = STATES.STOCK_ENTRY_QTY;
    const prod = await getProductById(id, ctx.session.userId!);
    return ctx.reply(
      `➕ *Entrada de Estoque*\n📦 *${prod?.name}*\nEstoque atual: ${prod?.quantityAvailable} un\n\nQuantidade a adicionar:`,
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data.startsWith("stock:select:exit:")) {
    const id = parseInt(data.split(":")[3] ?? "0");
    ctx.session.data.productId = id;
    ctx.session.data.movementType = "exit";
    ctx.session.state = STATES.STOCK_EXIT_QTY;
    const prod = await getProductById(id, ctx.session.userId!);
    return ctx.reply(
      `➖ *Saída de Estoque*\n📦 *${prod?.name}*\nEstoque atual: ${prod?.quantityAvailable} un\n\nQuantidade a remover:`,
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }
}

async function showStockList(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allProducts = await getProducts(userId);

  if (allProducts.length === 0) {
    return ctx.reply(
      "📦 Nenhum produto cadastrado ainda.",
      { ...stockMenuInline() }
    );
  }

  const lines = allProducts
    .map((p) => {
      const icon = p.quantityAvailable <= p.quantityMin ? "⚠️" : "✅";
      return `${icon} *${p.name}*: ${p.quantityAvailable} un`;
    })
    .join("\n");

  const total = allProducts.reduce((s, p) => s + p.quantityAvailable, 0);
  const low = allProducts.filter((p) => p.quantityAvailable <= p.quantityMin).length;

  await ctx.reply(
    `📊 *Estoque Atual*\n━━━━━━━━━━━━━━\n${lines}\n━━━━━━━━━━━━━━\n📦 Total: ${total} unidades\n⚠️ Baixo estoque: ${low} produto(s)`,
    { parse_mode: "Markdown", ...stockMenuInline() }
  );
}

async function showLowStock(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const low = await getLowStockProducts(userId);

  if (low.length === 0) {
    return ctx.reply(
      "✅ *Estoque OK!*\nNenhum produto com estoque abaixo do mínimo.",
      { parse_mode: "Markdown", ...stockMenuInline() }
    );
  }

  const lines = low
    .map((p) => `⚠️ *${p.name}*: ${p.quantityAvailable}/${p.quantityMin} un`)
    .join("\n");

  await ctx.reply(
    `⚠️ *Produtos com Estoque Baixo* (${low.length})\n\n${lines}\n\nReponha o estoque o quanto antes!`,
    { parse_mode: "Markdown", ...stockMenuInline() }
  );
}

async function startStockEntry(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allProducts = await getProducts(userId);

  if (allProducts.length === 0) {
    return ctx.reply("❌ Nenhum produto cadastrado.", { ...stockMenuInline() });
  }

  const buttons = allProducts.slice(0, 20).map((p) => [
    Markup.button.callback(
      `${p.name} (${p.quantityAvailable} un)`,
      `stock:select:entry:${p.id}`
    ),
  ]);

  await ctx.reply("➕ *Entrada de Estoque*\n\nSelecione o produto:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

async function startStockExit(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allProducts = await getProducts(userId);

  if (allProducts.length === 0) {
    return ctx.reply("❌ Nenhum produto cadastrado.", { ...stockMenuInline() });
  }

  const buttons = allProducts.slice(0, 20).map((p) => [
    Markup.button.callback(
      `${p.name} (${p.quantityAvailable} un)`,
      `stock:select:exit:${p.id}`
    ),
  ]);

  await ctx.reply("➖ *Saída de Estoque*\n\nSelecione o produto:", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons },
  });
}

export async function handleTextInStockState(
  ctx: BotContext,
  text: string,
  state: string
) {
  if (
    state !== STATES.STOCK_ENTRY_QTY &&
    state !== STATES.STOCK_EXIT_QTY
  )
    return;

  const qty = parseInt(text);
  if (isNaN(qty) || qty <= 0) {
    return ctx.reply("❌ Quantidade inválida. Digite um número inteiro positivo:");
  }

  const productId = Number(ctx.session.data.productId);
  const movementType = String(ctx.session.data.movementType);
  const userId = ctx.session.userId!;

  const product = await getProductById(productId, userId);
  if (!product) {
    ctx.session.state = STATES.IDLE;
    return ctx.reply("❌ Produto não encontrado.", { ...mainMenuKeyboard });
  }

  let newQty: number;
  if (movementType === "entry") {
    newQty = product.quantityAvailable + qty;
  } else {
    newQty = product.quantityAvailable - qty;
    if (newQty < 0) {
      return ctx.reply(
        `❌ Estoque insuficiente!\nDisponível: ${product.quantityAvailable} un\nVocê tentou remover: ${qty} un\n\nDigite uma quantidade válida:`
      );
    }
  }

  await updateProductQuantity(productId, newQty);
  await addStockMovement({
    userId,
    productId,
    type: movementType === "entry" ? "entry" : "exit",
    quantity: movementType === "entry" ? qty : -qty,
    notes: movementType === "entry" ? "Entrada manual" : "Saída manual",
  });

  ctx.session.state = STATES.IDLE;
  ctx.session.data = {};

  const icon = movementType === "entry" ? "➕" : "➖";
  await ctx.reply(
    `${icon} *Estoque atualizado!*\n\n📦 *${product.name}*\n• ${movementType === "entry" ? "Adicionado" : "Removido"}: ${qty} un\n• Novo estoque: *${newQty} un*\n${newQty <= product.quantityMin ? "\n⚠️ Atenção: estoque abaixo do mínimo!" : ""}`,
    { parse_mode: "Markdown", ...stockMenuInline() }
  );
}
