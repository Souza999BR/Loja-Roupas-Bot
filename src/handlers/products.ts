import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import {
  cancelKeyboard,
  cancelSkipKeyboard,
  mainMenuKeyboard,
  productActionsInline,
  productsMenuInline,
} from "../keyboards.js";
import {
  getProducts,
  getProductById,
  createProduct,
  deactivateProduct,
  getLowStockProducts,
  computeProductFinancials,
  fmt,
  fmtDate,
} from "../services.js";
import { requireAuth } from "./auth.js";

export async function showProductsMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("📦 *Menu de Produtos*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...productsMenuInline(),
  });
}

export async function handleProductAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "product:start_add") {
    ctx.session.state = STATES.PRODUCT_ADD_NAME;
    ctx.session.data = {};
    return ctx.reply(
      "➕ *Novo Produto*\n\n1️⃣ Digite o *nome* do produto:",
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data.startsWith("product:list:")) {
    const page = parseInt(data.split(":")[2] ?? "0") || 0;
    return showProductList(ctx, page);
  }

  if (data.startsWith("product:view:")) {
    const id = parseInt(data.split(":")[2] ?? "0");
    return showProductDetail(ctx, id);
  }

  if (data.startsWith("product:delete:")) {
    const id = parseInt(data.split(":")[2] ?? "0");
    return confirmDeleteProduct(ctx, id);
  }

  if (data.startsWith("product:delete_ok:")) {
    const id = parseInt(data.split(":")[2] ?? "0");
    return executeDeleteProduct(ctx, id);
  }

  if (data === "product:low_stock") {
    return showLowStockProducts(ctx);
  }
}

async function showProductList(ctx: BotContext, page = 0) {
  const userId = ctx.session.userId!;
  const allProducts = await getProducts(userId);
  const pageSize = 8;
  const start = page * pageSize;
  const slice = allProducts.slice(start, start + pageSize);

  if (allProducts.length === 0) {
    return ctx.reply(
      "📦 Você ainda não tem produtos cadastrados.\n\nUse *➕ Novo Produto* para adicionar.",
      {
        parse_mode: "Markdown",
        ...productsMenuInline(),
      }
    );
  }

  const buttons = slice.map((p) => [
    {
      text: `${p.quantityAvailable <= p.quantityMin ? "⚠️" : "✅"} ${p.name} (${p.quantityAvailable} un)`,
      callback_data: `product:view:${p.id}`,
    },
  ]);

  const nav = [];
  if (page > 0)
    nav.push({ text: "« Anterior", callback_data: `product:list:${page - 1}` });
  if (start + pageSize < allProducts.length)
    nav.push({ text: "Próxima »", callback_data: `product:list:${page + 1}` });
  if (nav.length) buttons.push(nav);

  await ctx.reply(
    `📦 *Produtos* (${allProducts.length} total)\nPágina ${page + 1}:`,
    {
      parse_mode: "Markdown",
      reply_markup: { inline_keyboard: buttons },
    }
  );
}

async function showProductDetail(ctx: BotContext, productId: number) {
  const userId = ctx.session.userId!;
  const product = await getProductById(productId, userId);
  if (!product) return ctx.reply("❌ Produto não encontrado.");

  const fin = computeProductFinancials(product);

  const msg =
    `📦 *${product.name}*\n` +
    `━━━━━━━━━━━━━━━━━━\n` +
    (product.code ? `🏷️ Código: ${product.code}\n` : "") +
    (product.category ? `📂 Categoria: ${product.category}\n` : "") +
    (product.brand ? `🏷️ Marca: ${product.brand}\n` : "") +
    (product.color ? `🎨 Cor: ${product.color}\n` : "") +
    (product.size ? `📐 Tamanho: ${product.size}\n` : "") +
    `\n📊 *Estoque:*\n` +
    `• Disponível: *${product.quantityAvailable} unidades*\n` +
    `• Mínimo: ${product.quantityMin} un\n` +
    `${product.quantityAvailable <= product.quantityMin ? "⚠️ *ESTOQUE BAIXO!*\n" : ""}` +
    `\n💰 *Financeiro:*\n` +
    `• Custo: ${fmt(fin.costPrice)}\n` +
    `• Preço de venda: *${fmt(fin.salePrice)}*\n` +
    `• Custo total: ${fmt(fin.totalCost)}\n` +
    `• Lucro bruto: ${fmt(fin.grossProfit)}\n` +
    `• Lucro líquido: *${fmt(fin.netProfit)}*\n` +
    `• Margem: ${fin.profitMargin.toFixed(1)}%\n` +
    `\n📅 Cadastrado: ${fmtDate(product.createdAt)}`;

  if (product.photoFileId) {
    await ctx.replyWithPhoto(product.photoFileId, {
      caption: msg,
      parse_mode: "Markdown",
      ...productActionsInline(productId),
    });
  } else {
    await ctx.reply(msg, {
      parse_mode: "Markdown",
      ...productActionsInline(productId),
    });
  }
}

async function confirmDeleteProduct(ctx: BotContext, productId: number) {
  const userId = ctx.session.userId!;
  const product = await getProductById(productId, userId);
  if (!product) return ctx.reply("❌ Produto não encontrado.");

  await ctx.reply(`⚠️ Deseja remover o produto *${product.name}*?\n\nEssa ação não pode ser desfeita.`, {
    parse_mode: "Markdown",
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Sim, remover", callback_data: `product:delete_ok:${productId}` },
          { text: "❌ Cancelar", callback_data: "product:list:0" },
        ],
      ],
    },
  });
}

async function executeDeleteProduct(ctx: BotContext, productId: number) {
  const userId = ctx.session.userId!;
  const product = await getProductById(productId, userId);
  if (!product) return ctx.reply("❌ Produto não encontrado.");

  await deactivateProduct(productId);
  await ctx.reply(`✅ Produto *${product.name}* removido com sucesso!`, {
    parse_mode: "Markdown",
    ...productsMenuInline(),
  });
}

async function showLowStockProducts(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const lowProducts = await getLowStockProducts(userId);

  if (lowProducts.length === 0) {
    return ctx.reply(
      "✅ *Estoque OK!*\n\nNenhum produto com estoque baixo.",
      { parse_mode: "Markdown", ...productsMenuInline() }
    );
  }

  const lines = lowProducts
    .map(
      (p) =>
        `⚠️ *${p.name}*: ${p.quantityAvailable} un (mín: ${p.quantityMin})`
    )
    .join("\n");

  await ctx.reply(
    `⚠️ *Produtos com Estoque Baixo* (${lowProducts.length})\n\n${lines}`,
    { parse_mode: "Markdown", ...productsMenuInline() }
  );
}

export async function handleTextInProductState(
  ctx: BotContext,
  text: string,
  state: string
) {
  const skip = text === "⏭ Pular";

  switch (state) {
    case STATES.PRODUCT_ADD_NAME: {
      if (text.trim().length < 2)
        return ctx.reply("❌ Nome muito curto. Digite o nome do produto:");
      ctx.session.data.name = text.trim();
      ctx.session.state = STATES.PRODUCT_ADD_CATEGORY;
      return ctx.reply(
        `✅ *${text.trim()}*\n\n2️⃣ Digite a *categoria* (ex: Blusas, Calças, Vestidos) ou ⏭ Pular:`,
        { parse_mode: "Markdown", ...cancelSkipKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_CATEGORY: {
      if (!skip) ctx.session.data.category = text.trim();
      ctx.session.state = STATES.PRODUCT_ADD_CODE;
      return ctx.reply(
        `3️⃣ Digite o *código interno* do produto ou ⏭ Pular:`,
        { parse_mode: "Markdown", ...cancelSkipKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_CODE: {
      if (!skip) ctx.session.data.code = text.trim();
      ctx.session.state = STATES.PRODUCT_ADD_COST;
      return ctx.reply(
        `4️⃣ Digite o *preço de custo* (R$):\nExemplo: 35,50 ou 35.50`,
        { ...cancelKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_COST: {
      const val = parseFloat(text.replace(",", "."));
      if (isNaN(val) || val < 0)
        return ctx.reply("❌ Valor inválido. Digite o preço de custo (ex: 35,50):");
      ctx.session.data.costPrice = val;
      ctx.session.state = STATES.PRODUCT_ADD_PRICE;
      return ctx.reply(
        `5️⃣ Digite o *preço de venda* (R$):`,
        { ...cancelKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_PRICE: {
      const val = parseFloat(text.replace(",", "."));
      if (isNaN(val) || val < 0)
        return ctx.reply("❌ Valor inválido. Digite o preço de venda (ex: 89,90):");
      ctx.session.data.salePrice = val;
      ctx.session.state = STATES.PRODUCT_ADD_QTY;
      return ctx.reply(
        `6️⃣ Digite a *quantidade inicial* em estoque:`,
        { ...cancelKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_QTY: {
      const val = parseInt(text);
      if (isNaN(val) || val < 0)
        return ctx.reply("❌ Quantidade inválida. Digite um número inteiro:");
      ctx.session.data.quantity = val;
      ctx.session.state = STATES.PRODUCT_ADD_MIN;
      return ctx.reply(
        `7️⃣ Digite a *quantidade mínima* para alerta de estoque baixo (ou ⏭ Pular para usar 5):`,
        { ...cancelSkipKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_MIN: {
      const val = skip ? 5 : parseInt(text);
      if (!skip && (isNaN(val) || val < 0))
        return ctx.reply("❌ Quantidade inválida. Digite um número inteiro:");
      ctx.session.data.quantityMin = val;
      ctx.session.state = STATES.PRODUCT_ADD_EXTRAS;
      return ctx.reply(
        `8️⃣ Custos adicionais (opcional).\nDigite no formato:\n\`sacola:5 mimo:2 frete:10 comissao:3\`\n\nOu ⏭ Pular:`,
        { parse_mode: "Markdown", ...cancelSkipKeyboard }
      );
    }

    case STATES.PRODUCT_ADD_EXTRAS: {
      let bagCost = 0, giftCost = 0, shippingCost = 0, commission = 0, otherCosts = 0;

      if (!skip) {
        const parts = text.toLowerCase().split(/\s+/);
        for (const part of parts) {
          const [k, v] = part.split(":");
          const n = parseFloat((v ?? "").replace(",", ".")) || 0;
          if (k === "sacola") bagCost = n;
          else if (k === "mimo") giftCost = n;
          else if (k === "frete") shippingCost = n;
          else if (k === "comissao" || k === "comissão") commission = n;
          else if (k === "outros") otherCosts = n;
        }
      }

      ctx.session.state = STATES.IDLE;

      try {
        const product = await createProduct({
          userId: ctx.session.userId!,
          name: String(ctx.session.data.name ?? ""),
          code: ctx.session.data.code ? String(ctx.session.data.code) : null,
          category: ctx.session.data.category ? String(ctx.session.data.category) : null,
          costPrice: String(ctx.session.data.costPrice ?? "0"),
          salePrice: String(ctx.session.data.salePrice ?? "0"),
          quantityAvailable: Number(ctx.session.data.quantity ?? 0),
          quantityMin: Number(ctx.session.data.quantityMin ?? 5),
          bagCost: String(bagCost),
          giftCost: String(giftCost),
          shippingCost: String(shippingCost),
          commission: String(commission),
          otherCosts: String(otherCosts),
        });

        const fin = computeProductFinancials(product);
        ctx.session.data = {};

        await ctx.reply(
          `✅ *Produto cadastrado com sucesso!*\n\n` +
          `📦 *${product.name}*\n` +
          (product.category ? `📂 ${product.category}\n` : "") +
          `\n💰 *Financeiro:*\n` +
          `• Custo: ${fmt(fin.costPrice)}\n` +
          `• Venda: ${fmt(fin.salePrice)}\n` +
          `• Custo total: ${fmt(fin.totalCost)}\n` +
          `• Lucro líquido: *${fmt(fin.netProfit)}*\n` +
          `• Margem: ${fin.profitMargin.toFixed(1)}%\n` +
          `\n📊 Estoque inicial: ${product.quantityAvailable} un`,
          { parse_mode: "Markdown", ...productsMenuInline() }
        );
      } catch (err) {
        ctx.session.data = {};
        await ctx.reply("❌ Erro ao cadastrar produto. Tente novamente.", {
          ...mainMenuKeyboard,
        });
      }
      return;
    }
  }
}
