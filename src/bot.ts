import { Telegraf, session } from "telegraf";
import type { BotContext, SessionData } from "./types.js";
import { STATES } from "./types.js";
import { mainMenuKeyboard, cancelKeyboard } from "./keyboards.js";
import { logger } from "./logger.js";

import { handleStart, handleRegisterName, handleRegisterStore, handleRegisterPhone, handleRegisterEmail, handleRegisterPassword, handleRegisterConfirm, handleLoginPassword, requireAuth } from "./handlers/auth.js";
import { showProductsMenu, handleProductAction, handleTextInProductState } from "./handlers/products.js";
import { showStockMenu, handleStockAction, handleTextInStockState } from "./handlers/stock.js";
import { showSalesMenu, handleSaleAction, handleTextInSaleState } from "./handlers/sales.js";
import { showClientsMenu, handleClientAction, handleTextInClientState } from "./handlers/clients.js";
import { showSuppliersMenu, handleSupplierAction, handleTextInSupplierState } from "./handlers/suppliers.js";
import { showDashboard } from "./handlers/dashboard.js";
import { showFinancialMenu, handleFinancialAction } from "./handlers/financial.js";
import { showReportsMenu, handleReportAction } from "./handlers/reports.js";
import { showSettingsMenu, handleSettingsAction, handleTextInSettingsState } from "./handlers/settings.js";

function defaultSession(): SessionData {
  return { state: STATES.IDLE, data: {} };
}

async function safeDelete(ctx: BotContext, chatId: number, messageId: number) {
  try {
    await ctx.telegram.deleteMessage(chatId, messageId);
  } catch {
    // Ignore: message already deleted, too old, or no permission
  }
}

export function createBot() {
  const token = process.env["TELEGRAM_BOT_TOKEN"];
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN is not set");

  const bot = new Telegraf<BotContext>(token);

  bot.use(session({ defaultSession }));

  // ─── Auto-cleanup middleware ───────────────────────────────────────────────
  // Wraps ctx.reply / ctx.replyWithPhoto so that:
  //  • The previous bot message is deleted before sending a new one
  //  • The new bot message ID is saved to session for next cleanup
  // After the handler runs, the user's own message is also deleted.
  bot.use(async (ctx, next) => {
    const chatId = ctx.chat?.id;
    if (!chatId) return next();

    // Capture the incoming message ID for deletion after handler runs
    const userMsgId =
      "message" in ctx.update ? ctx.update.message?.message_id : undefined;

    // Wrap ctx.reply
    const origReply = ctx.reply.bind(ctx);
    ctx.reply = async (text, extra) => {
      if (ctx.session?.prevBotMessageId) {
        await safeDelete(ctx, chatId, ctx.session.prevBotMessageId);
        ctx.session.prevBotMessageId = undefined;
      }
      const msg = await origReply(text, extra);
      if (ctx.session) {
        ctx.session.prevBotMessageId = ctx.session.lastBotMessageId;
        ctx.session.lastBotMessageId = msg.message_id;
      }
      return msg;
    };

    // Wrap ctx.replyWithPhoto
    const origReplyWithPhoto = ctx.replyWithPhoto.bind(ctx);
    ctx.replyWithPhoto = async (photo, extra) => {
      if (ctx.session?.prevBotMessageId) {
        await safeDelete(ctx, chatId, ctx.session.prevBotMessageId);
        ctx.session.prevBotMessageId = undefined;
      }
      const msg = await origReplyWithPhoto(photo, extra);
      if (ctx.session) {
        ctx.session.prevBotMessageId = ctx.session.lastBotMessageId;
        ctx.session.lastBotMessageId = msg.message_id;
      }
      return msg;
    };

    await next();

    // Delete the user's text message after the handler runs
    if (userMsgId) {
      await safeDelete(ctx, chatId, userMsgId);
    }
  });
  // ──────────────────────────────────────────────────────────────────────────

  bot.command("start", async (ctx) => {
    try {
      await handleStart(ctx);
    } catch (err) {
      logger.error({ err }, "Error in /start");
      await ctx.reply("❌ Ocorreu um erro. Tente novamente com /start");
    }
  });

  bot.command("menu", async (ctx) => {
    if (!(await requireAuth(ctx))) return;
    ctx.session.state = STATES.IDLE;
    await ctx.reply("🏠 Menu Principal:", mainMenuKeyboard);
  });

  bot.command("cancelar", async (ctx) => {
    ctx.session.state = STATES.IDLE;
    ctx.session.data = {};
    ctx.session.saleItems = [];
    await ctx.reply("❌ Ação cancelada.", mainMenuKeyboard);
  });

  bot.command("ajuda", async (ctx) => {
    await ctx.reply(
      `❓ *Ajuda — LojaRoupasBot*\n\n` +
      `Este bot gerencia sua loja de roupas pelo Telegram.\n\n` +
      `*Comandos:*\n` +
      `/start — Iniciar / Entrar\n` +
      `/menu — Voltar ao menu principal\n` +
      `/cancelar — Cancelar ação atual\n` +
      `/ajuda — Esta mensagem\n\n` +
      `*Módulos disponíveis:*\n` +
      `📦 Produtos — Cadastro e gestão\n` +
      `📊 Estoque — Entradas e saídas\n` +
      `💰 Vendas — Registrar e consultar\n` +
      `👥 Clientes — Cadastro\n` +
      `🏭 Fornecedores — Cadastro\n` +
      `💵 Financeiro — Resultados\n` +
      `📈 Dashboard — Resumo geral\n` +
      `📋 Relatórios — Análises\n` +
      `⚙️ Configurações — Perfil e senha`,
      { parse_mode: "Markdown", ...mainMenuKeyboard }
    );
  });

  bot.on("text", async (ctx) => {
    const text = ctx.message.text;
    const state = ctx.session.state ?? STATES.IDLE;

    try {
      if (text === "❌ Cancelar" || text === "/cancelar") {
        ctx.session.state = STATES.IDLE;
        ctx.session.data = {};
        ctx.session.saleItems = [];
        return ctx.reply("❌ Ação cancelada.", mainMenuKeyboard);
      }

      if (state.startsWith("register:")) {
        switch (state) {
          case STATES.REGISTER_NAME: return handleRegisterName(ctx, text);
          case STATES.REGISTER_STORE: return handleRegisterStore(ctx, text);
          case STATES.REGISTER_PHONE: return handleRegisterPhone(ctx, text);
          case STATES.REGISTER_EMAIL: return handleRegisterEmail(ctx, text);
          case STATES.REGISTER_PASSWORD: return handleRegisterPassword(ctx, text);
          case STATES.REGISTER_CONFIRM: return handleRegisterConfirm(ctx, text);
        }
      }

      if (state === STATES.LOGIN_PASSWORD) {
        return handleLoginPassword(ctx, text);
      }

      if (!(await requireAuth(ctx))) return;

      if (state.startsWith("product:")) {
        return handleTextInProductState(ctx, text, state);
      }

      if (state.startsWith("stock:")) {
        return handleTextInStockState(ctx, text, state);
      }

      if (state.startsWith("sale:")) {
        if (
          state === STATES.SALE_ADD_QTY ||
          state === STATES.SALE_ADD_CLIENT ||
          state === STATES.SALE_ADD_NOTES
        ) {
          return handleTextInSaleState(ctx, text, state);
        }
      }

      if (state.startsWith("client:")) {
        return handleTextInClientState(ctx, text, state);
      }

      if (state.startsWith("supplier:")) {
        return handleTextInSupplierState(ctx, text, state);
      }

      if (state.startsWith("settings:")) {
        return handleTextInSettingsState(ctx, text, state);
      }

      switch (text) {
        case "📦 Produtos": return showProductsMenu(ctx);
        case "📊 Estoque": return showStockMenu(ctx);
        case "💰 Vendas": return showSalesMenu(ctx);
        case "👥 Clientes": return showClientsMenu(ctx);
        case "🏭 Fornecedores": return showSuppliersMenu(ctx);
        case "💵 Financeiro": return showFinancialMenu(ctx);
        case "📈 Dashboard": return showDashboard(ctx);
        case "📋 Relatórios": return showReportsMenu(ctx);
        case "⚙️ Configurações": return showSettingsMenu(ctx);
        case "❓ Ajuda":
          return ctx.reply(
            `❓ Use o menu abaixo ou envie /ajuda para mais informações.`,
            mainMenuKeyboard
          );
        default:
          await ctx.reply("🏠 Use o menu abaixo para navegar:", mainMenuKeyboard);
      }
    } catch (err) {
      logger.error({ err }, "Error handling text message");
      ctx.session.state = STATES.IDLE;
      ctx.session.data = {};
      await ctx.reply("❌ Ocorreu um erro. Voltando ao menu principal.", mainMenuKeyboard);
    }
  });

  bot.on("callback_query", async (ctx) => {
    try {
      await ctx.answerCbQuery();
      const cbData = (ctx.callbackQuery as { data?: string }).data;
      if (!cbData) return;

      if (cbData.startsWith("auth:")) {
        if (cbData === "auth:register") {
          ctx.session.state = STATES.REGISTER_NAME;
          ctx.session.data = {};
          return ctx.reply(
            "📝 *Criar Conta*\n\n1️⃣ Digite seu *nome completo*:",
            { parse_mode: "Markdown", ...cancelKeyboard }
          );
        }
        if (cbData === "auth:login") {
          ctx.session.state = STATES.LOGIN_PASSWORD;
          return ctx.reply("🔐 Digite sua senha:", cancelKeyboard);
        }
        return;
      }

      if (cbData.startsWith("product:")) return handleProductAction(ctx, cbData);
      if (cbData.startsWith("stock:")) return handleStockAction(ctx, cbData);
      if (cbData.startsWith("sale:pay:")) return handleSaleAction(ctx, cbData);
      if (
        cbData === "sale:start" ||
        cbData === "sale:history" ||
        cbData === "sale:today" ||
        cbData === "sale:add_more" ||
        cbData === "sale:confirm" ||
        cbData === "sale:cancel"
      ) {
        return handleSaleAction(ctx, cbData);
      }
      if (cbData.startsWith("sale:prod:")) return handleSaleAction(ctx, cbData);
      if (cbData.startsWith("client:")) return handleClientAction(ctx, cbData);
      if (cbData.startsWith("supplier:")) return handleSupplierAction(ctx, cbData);
      if (cbData.startsWith("financial:")) return handleFinancialAction(ctx, cbData);
      if (cbData.startsWith("report:")) return handleReportAction(ctx, cbData);
      if (cbData.startsWith("settings:")) return handleSettingsAction(ctx, cbData);

      if (cbData.startsWith("menu:")) {
        const part = cbData.split(":")[1];
        switch (part) {
          case "products": return showProductsMenu(ctx);
          case "stock": return showStockMenu(ctx);
          case "sales": return showSalesMenu(ctx);
          case "clients": return showClientsMenu(ctx);
          case "suppliers": return showSuppliersMenu(ctx);
          case "financial": return showFinancialMenu(ctx);
          case "dashboard": return showDashboard(ctx);
          case "reports": return showReportsMenu(ctx);
          case "settings": return showSettingsMenu(ctx);
        }
      }
    } catch (err) {
      logger.error({ err }, "Error handling callback query");
      try {
        await ctx.reply("❌ Ocorreu um erro. Tente novamente.", mainMenuKeyboard);
      } catch {}
    }
  });

  bot.on("photo", async (ctx) => {
    try {
      if (
        ctx.session.state === STATES.PRODUCT_ADD_EXTRAS ||
        ctx.session.state === STATES.IDLE
      ) {
        const photo = ctx.message.photo;
        const fileId = photo[photo.length - 1]?.file_id;
        if (fileId) {
          ctx.session.data.photoFileId = fileId;
          await ctx.reply("📸 Foto recebida! Continue com o cadastro.");
        }
      }
    } catch (err) {
      logger.error({ err }, "Error handling photo");
    }
  });

  bot.catch((err, ctx) => {
    logger.error({ err }, `Bot error for update ${ctx.update.update_id}`);
  });

  return bot;
}
