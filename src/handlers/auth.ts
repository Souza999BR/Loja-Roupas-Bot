import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import { mainMenuKeyboard, cancelKeyboard, cancelSkipKeyboard } from "../keyboards.js";
import {
  findUserByTelegramId,
  createUser,
  verifyPassword,
} from "../services.js";

export async function handleStart(ctx: BotContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await findUserByTelegramId(telegramId);

  if (user) {
    ctx.session.userId = user.id;
    ctx.session.telegramId = user.telegramId;
    ctx.session.storeName = user.storeName;
    ctx.session.userName = user.name;
    ctx.session.state = STATES.IDLE;
    await ctx.reply(
      `👋 Bem-vindo de volta, *${user.name}*!\n🏪 Loja: *${user.storeName}*\n\nEscolha uma opção no menu abaixo:`,
      { parse_mode: "Markdown", ...mainMenuKeyboard }
    );
  } else {
    ctx.session.state = STATES.REGISTER_NAME;
    ctx.session.data = {};
    await ctx.reply(
      `🛍️ *Bem-vindo ao LojaRoupasBot!*\n\nSistema completo de gestão para sua loja de roupas.\n\nVamos criar sua conta. Qual é o seu *nome completo*?`,
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }
}

export async function handleRegisterName(ctx: BotContext, text: string) {
  if (text.trim().length < 2) {
    return ctx.reply("❌ Nome muito curto. Digite seu nome completo:");
  }
  ctx.session.data.name = text.trim();
  ctx.session.state = STATES.REGISTER_STORE;
  await ctx.reply(
    `✅ Ótimo, *${text.trim()}*!\n\nAgora, qual é o *nome da sua loja*?`,
    { parse_mode: "Markdown", ...cancelKeyboard }
  );
}

export async function handleRegisterStore(ctx: BotContext, text: string) {
  if (text.trim().length < 2) {
    return ctx.reply("❌ Nome da loja muito curto. Digite novamente:");
  }
  ctx.session.data.storeName = text.trim();
  ctx.session.state = STATES.REGISTER_PHONE;
  await ctx.reply(
    `🏪 Loja: *${text.trim()}*\n\nDigite seu *telefone* (com DDD) ou ⏭ Pular:`,
    { parse_mode: "Markdown", ...cancelSkipKeyboard }
  );
}

export async function handleRegisterPhone(ctx: BotContext, text: string) {
  if (text !== "⏭ Pular") {
    ctx.session.data.phone = text.trim();
  }
  ctx.session.state = STATES.REGISTER_EMAIL;
  await ctx.reply(
    `📱 Telefone salvo!\n\nDigite seu *e-mail* ou ⏭ Pular:`,
    { parse_mode: "Markdown", ...cancelSkipKeyboard }
  );
}

export async function handleRegisterEmail(ctx: BotContext, text: string) {
  if (text !== "⏭ Pular") {
    ctx.session.data.email = text.trim().toLowerCase();
  }
  ctx.session.state = STATES.REGISTER_PASSWORD;
  await ctx.reply(
    `📧 E-mail salvo!\n\nAgora crie uma *senha* para sua conta (mínimo 6 caracteres):`,
    { parse_mode: "Markdown", ...cancelKeyboard }
  );
}

export async function handleRegisterPassword(ctx: BotContext, text: string) {
  if (text.trim().length < 6) {
    return ctx.reply("❌ Senha muito curta. Mínimo 6 caracteres:");
  }
  ctx.session.data.password = text.trim();
  ctx.session.state = STATES.REGISTER_CONFIRM;
  await ctx.reply(
    `🔒 Confirme sua senha digitando-a novamente:`,
    { ...cancelKeyboard }
  );
}

export async function handleRegisterConfirm(ctx: BotContext, text: string) {
  if (text.trim() !== ctx.session.data.password) {
    return ctx.reply(
      "❌ As senhas não coincidem. Digite a senha novamente para confirmar:"
    );
  }

  try {
    const telegramId = ctx.from!.id;
    const user = await createUser({
      telegramId,
      name: String(ctx.session.data.name ?? ""),
      storeName: String(ctx.session.data.storeName ?? ""),
      phone: ctx.session.data.phone ? String(ctx.session.data.phone) : undefined,
      email: ctx.session.data.email ? String(ctx.session.data.email) : undefined,
      password: String(ctx.session.data.password ?? ""),
    });

    ctx.session.userId = user.id;
    ctx.session.telegramId = user.telegramId;
    ctx.session.storeName = user.storeName;
    ctx.session.userName = user.name;
    ctx.session.state = STATES.IDLE;
    ctx.session.data = {};

    await ctx.reply(
      `🎉 *Conta criada com sucesso!*\n\n👤 Nome: ${user.name}\n🏪 Loja: ${user.storeName}\n\nSeu sistema está pronto para usar. Escolha uma opção:`,
      { parse_mode: "Markdown", ...mainMenuKeyboard }
    );
  } catch (err) {
    ctx.session.state = STATES.IDLE;
    ctx.session.data = {};
    await ctx.reply(
      "❌ Erro ao criar conta. Tente novamente com /start",
      mainMenuKeyboard
    );
  }
}

export async function handleLoginPassword(ctx: BotContext, text: string) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await findUserByTelegramId(telegramId);
  if (!user) {
    ctx.session.state = STATES.IDLE;
    return ctx.reply(
      "❌ Usuário não encontrado. Use /start para se cadastrar."
    );
  }

  const valid = await verifyPassword(user.passwordHash, text.trim());
  if (!valid) {
    return ctx.reply(
      "❌ Senha incorreta. Tente novamente ou use /start para resetar:"
    );
  }

  ctx.session.userId = user.id;
  ctx.session.telegramId = user.telegramId;
  ctx.session.storeName = user.storeName;
  ctx.session.userName = user.name;
  ctx.session.state = STATES.IDLE;

  await ctx.reply(
    `✅ *Login realizado com sucesso!*\n\n👤 ${user.name}\n🏪 ${user.storeName}\n\nEscolha uma opção:`,
    { parse_mode: "Markdown", ...mainMenuKeyboard }
  );
}

export async function requireAuth(ctx: BotContext): Promise<boolean> {
  if (ctx.session.userId) return true;

  const telegramId = ctx.from?.id;
  if (!telegramId) return false;

  const user = await findUserByTelegramId(telegramId);
  if (user) {
    ctx.session.userId = user.id;
    ctx.session.telegramId = user.telegramId;
    ctx.session.storeName = user.storeName;
    ctx.session.userName = user.name;
    return true;
  }

  ctx.session.state = STATES.LOGIN_PASSWORD;
  await ctx.reply(
    "🔐 Digite sua senha para continuar:",
    cancelKeyboard
  );
  return false;
}
