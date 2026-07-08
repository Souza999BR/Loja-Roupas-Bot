import type { BotContext } from "../types.js";
import { STATES } from "../types.js";
import {
  cancelKeyboard,
  cancelSkipKeyboard,
  suppliersMenuInline,
} from "../keyboards.js";
import { getSuppliers, createSupplier } from "../services.js";
import { requireAuth } from "./auth.js";

export async function showSuppliersMenu(ctx: BotContext) {
  if (!(await requireAuth(ctx))) return;
  ctx.session.state = STATES.IDLE;
  await ctx.reply("🏭 *Menu de Fornecedores*\n\nEscolha uma opção:", {
    parse_mode: "Markdown",
    ...suppliersMenuInline(),
  });
}

export async function handleSupplierAction(ctx: BotContext, data: string) {
  if (!(await requireAuth(ctx))) return;

  if (data === "supplier:add") {
    ctx.session.state = STATES.SUPPLIER_ADD_NAME;
    ctx.session.data = {};
    return ctx.reply(
      "➕ *Novo Fornecedor*\n\n1️⃣ Digite o *nome* do fornecedor:",
      { parse_mode: "Markdown", ...cancelKeyboard }
    );
  }

  if (data === "supplier:list") return showSupplierList(ctx);
}

async function showSupplierList(ctx: BotContext) {
  const userId = ctx.session.userId!;
  const allSuppliers = await getSuppliers(userId);

  if (allSuppliers.length === 0) {
    return ctx.reply(
      "🏭 Nenhum fornecedor cadastrado ainda.\n\nUse *➕ Novo Fornecedor* para adicionar.",
      { parse_mode: "Markdown", ...suppliersMenuInline() }
    );
  }

  const lines = allSuppliers
    .map(
      (s) =>
        `🏭 *${s.name}*${s.contact ? `\n   👤 ${s.contact}` : ""}${s.phone ? `\n   📱 ${s.phone}` : ""}${s.email ? `\n   📧 ${s.email}` : ""}`
    )
    .join("\n\n");

  await ctx.reply(
    `🏭 *Fornecedores* (${allSuppliers.length})\n\n${lines}`,
    { parse_mode: "Markdown", ...suppliersMenuInline() }
  );
}

export async function handleTextInSupplierState(
  ctx: BotContext,
  text: string,
  state: string
) {
  const skip = text === "⏭ Pular";

  switch (state) {
    case STATES.SUPPLIER_ADD_NAME: {
      if (text.trim().length < 2)
        return ctx.reply("❌ Nome muito curto. Digite o nome do fornecedor:");
      ctx.session.data.name = text.trim();
      ctx.session.state = STATES.SUPPLIER_ADD_CONTACT;
      return ctx.reply(
        `✅ *${text.trim()}*\n\n2️⃣ Nome do contato (ou ⏭ Pular):`,
        { parse_mode: "Markdown", ...cancelSkipKeyboard }
      );
    }

    case STATES.SUPPLIER_ADD_CONTACT: {
      if (!skip) ctx.session.data.contact = text.trim();
      ctx.session.state = STATES.SUPPLIER_ADD_PHONE;
      return ctx.reply("3️⃣ Telefone do fornecedor (ou ⏭ Pular):", {
        ...cancelSkipKeyboard,
      });
    }

    case STATES.SUPPLIER_ADD_PHONE: {
      if (!skip) ctx.session.data.phone = text.trim();

      try {
        const supplier = await createSupplier({
          userId: ctx.session.userId!,
          name: String(ctx.session.data.name ?? ""),
          contact: ctx.session.data.contact ? String(ctx.session.data.contact) : null,
          phone: ctx.session.data.phone ? String(ctx.session.data.phone) : null,
        });

        ctx.session.state = STATES.IDLE;
        ctx.session.data = {};

        await ctx.reply(
          `✅ *Fornecedor cadastrado!*\n\n🏭 *${supplier.name}*\n${supplier.contact ? `👤 ${supplier.contact}\n` : ""}${supplier.phone ? `📱 ${supplier.phone}\n` : ""}`,
          { parse_mode: "Markdown", ...suppliersMenuInline() }
        );
      } catch (err) {
        ctx.session.state = STATES.IDLE;
        ctx.session.data = {};
        await ctx.reply("❌ Erro ao cadastrar fornecedor.", {
          ...suppliersMenuInline(),
        });
      }
      return;
    }
  }
}
