import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import {
  cancelKeyboard,
  cancelSkipKeyboard,
  clientsMenuInline,
} from "../keyboards.js";
import { getClients, createClient, fmtDate } from "../services.js";
import { requireAuth } from "./auth.js";

export async function showClientsMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("👥 *Menu de Clientes*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...clientsMenuInline(),
  });
}

export async function handleClientAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "client:add") {
    ctx.session.state = STATES.CLIENT_ADD_NAME;
    ctx.session.data = {};
    return ctx.reply(
      "➕ *Novo Cliente*\n\n1️⃣ Digite o *nome* do cliente:",
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data === "client:list") return showClientList(ctx);
}

async function showClientList(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allClients = await getClients(userId);

  if (allClients.length === 0) {
    return ctx.reply(
      "👥 Nenhum cliente cadastrado ainda.\n\nUse *➕ Novo Cliente* para adicionar.",
      { parse_mode: "Markdown", ...clientsMenuInline() }
    );
  }

  const lines = allClients
    .map(
      (c) =>
        `👤 *${c.name}*${c.phone ? `\n   📱 ${c.phone}` : ""}${c.email ? `\n   📧 ${c.email}` : ""}`
    )
    .join("\n\n");

  await ctx.reply(
    `👥 *Clientes* (${allClients.length})\n\n${lines}`,
    { parse_mode: "Markdown", ...clientsMenuInline() }
  );
}

export async function handleTextInClientState(
  ctx: BotContext,
  text: string,
  state: string
) {
  const skip = text === "⏭ Pular";

  switch (state) {
    case STATES.CLIENT_ADD_NAME: {
      if (text.trim().length < 2)
        return ctx.reply("❌ Nome muito curto. Digite o nome do cliente:");
      ctx.session.data.name = text.trim();
      ctx.session.state = STATES.CLIENT_ADD_PHONE;
      return ctx.reply(
        `✅ *${text.trim()}*\n\n2️⃣ Telefone do cliente (ou ⏭ Pular):`,
        { parse_mode: "Markdown", ...cancelSkipKeyboard }
      );
    }

    case STATES.CLIENT_ADD_PHONE: {
      if (!skip) ctx.session.data.phone = text.trim();
      ctx.session.state = STATES.CLIENT_ADD_EMAIL;
      return ctx.reply("3️⃣ E-mail do cliente (ou ⏭ Pular):", {
        ...cancelSkipKeyboard,
      });
    }

    case STATES.CLIENT_ADD_EMAIL: {
      if (!skip) ctx.session.data.email = text.trim().toLowerCase();

      try {
        const client = await createClient({
          userId: ctx.session.userId!,
          name: String(ctx.session.data.name ?? ""),
          phone: ctx.session.data.phone ? String(ctx.session.data.phone) : null,
          email: ctx.session.data.email ? String(ctx.session.data.email) : null,
        });

        ctx.session.state = STATES.IDLE;
        ctx.session.data = {};

        await ctx.reply(
          `✅ *Cliente cadastrado!*\n\n👤 *${client.name}*\n${client.phone ? `📱 ${client.phone}\n` : ""}${client.email ? `📧 ${client.email}\n` : ""}📅 ${fmtDate(client.createdAt)}`,
          { parse_mode: "Markdown", ...clientsMenuInline() }
        );
      } catch (err) {
        ctx.session.state = STATES.IDLE;
        ctx.session.data = {};
        await ctx.reply("❌ Erro ao cadastrar cliente. Tente novamente.", {
          ...clientsMenuInline(),
        });
      }
      return;
    }
  }
}
