import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import {
  mainMenuKeyboard,
  cancelKeyboard,
  settingsMenuInline,
} from "../keyboards.js";
import { findUserByTelegramId, updatePassword, fmtDate } from "../services.js";
import { requireAuth } from "./auth.js";

export async function showSettingsMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("⚙️ *Configurações*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...settingsMenuInline(),
  });
}

export async function handleSettingsAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "settings:profile") return showProfile(ctx);
  if (data === "settings:change_password") return startChangePassword(ctx);

  if (data === "settings:logout") {
    ctx.session.userId = undefined;
    ctx.session.telegramId = undefined;
    ctx.session.storeName = undefined;
    ctx.session.userName = undefined;
    ctx.session.state = STATES.IDLE;
    ctx.session.data = {};
    return ctx.reply(
      "🚪 *Você saiu da sua conta.*\n\nUse /start para entrar novamente.",
      { parse_mode: "Markdown", reply_markup: { remove_keyboard: true } }
    );
  }
}

async function showProfile(ctx: BotContext) {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const user = await findUserByTelegramId(telegramId);
  if (!user) return ctx.reply("❌ Usuário não encontrado.");

  await ctx.reply(
    `👤 *Meu Perfil*\n` +
    `━━━━━━━━━━━━━━\n` +
    `👤 Nome: *${user.name}*\n` +
    `🏪 Loja: *${user.storeName}*\n` +
    `${user.phone ? `📱 Telefone: ${user.phone}\n` : ""}` +
    `${user.email ? `📧 E-mail: ${user.email}\n` : ""}` +
    `📅 Cadastrado em: ${fmtDate(user.createdAt)}`,
    { parse_mode: "Markdown", ...settingsMenuInline() }
  );
}

async function startChangePassword(ctx: BotContext) {
  ctx.session.state = STATES.SETTINGS_NEW_PASSWORD;
  ctx.session.data = {};
  await ctx.reply(
    "🔑 *Alterar Senha*\n\nDigite sua *nova senha* (mínimo 6 caracteres):",
    { parse_mode: "Markdown", ...cancelKeyboard }
  );
}

export async function handleTextInSettingsState(
  ctx: BotContext,
  text: string,
  state: string
) {
  switch (state) {
    case STATES.SETTINGS_NEW_PASSWORD: {
      if (text.trim().length < 6)
        return ctx.reply("❌ Senha muito curta. Mínimo 6 caracteres:");
      ctx.session.data.newPassword = text.trim();
      ctx.session.state = STATES.SETTINGS_CONFIRM_PASSWORD;
      return ctx.reply("🔒 Confirme a nova senha:", { ...cancelKeyboard });
    }

    case STATES.SETTINGS_CONFIRM_PASSWORD: {
      if (text.trim() !== String(ctx.session.data.newPassword)) {
        return ctx.reply(
          "❌ Senhas não coincidem. Digite a nova senha novamente para confirmar:"
        );
      }

      await updatePassword(ctx.session.userId!, String(ctx.session.data.newPassword));
      ctx.session.state = STATES.IDLE;
      ctx.session.data = {};

      await ctx.reply(
        "✅ *Senha alterada com sucesso!*",
        { parse_mode: "Markdown", ...mainMenuKeyboard }
      );
      return;
    }
  }
}
