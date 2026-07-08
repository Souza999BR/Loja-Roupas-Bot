import type { Context } from "telegraf";

export interface SaleItemTemp {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;
  unitCost: number;
}

export interface SessionData {
  userId?: number;
  telegramId?: number;
  storeName?: string;
  userName?: string;
  state: string;
  data: Record<string, string | number | boolean | null | undefined>;
  saleItems?: SaleItemTemp[];
  lastBotMessageId?: number;
  prevBotMessageId?: number;
}

export interface BotContext extends Context {
  session: SessionData;
}

export const STATES = {
  IDLE: "idle",
  REGISTER_NAME: "register:name",
  REGISTER_STORE: "register:store",
  REGISTER_PHONE: "register:phone",
  REGISTER_EMAIL: "register:email",
  REGISTER_PASSWORD: "register:password",
  REGISTER_CONFIRM: "register:confirm",
  LOGIN_PASSWORD: "login:password",

  PRODUCT_ADD_NAME: "product:add:name",
  PRODUCT_ADD_CATEGORY: "product:add:category",
  PRODUCT_ADD_CODE: "product:add:code",
  PRODUCT_ADD_COST: "product:add:cost",
  PRODUCT_ADD_PRICE: "product:add:price",
  PRODUCT_ADD_QTY: "product:add:qty",
  PRODUCT_ADD_MIN: "product:add:min",
  PRODUCT_ADD_EXTRAS: "product:add:extras",

  STOCK_ENTRY_SELECT: "stock:entry:select",
  STOCK_ENTRY_QTY: "stock:entry:qty",
  STOCK_EXIT_SELECT: "stock:exit:select",
  STOCK_EXIT_QTY: "stock:exit:qty",

  SALE_ADD_PRODUCT: "sale:add:product",
  SALE_ADD_QTY: "sale:add:qty",
  SALE_ADD_CLIENT: "sale:add:client",
  SALE_ADD_NOTES: "sale:add:notes",

  CLIENT_ADD_NAME: "client:add:name",
  CLIENT_ADD_PHONE: "client:add:phone",
  CLIENT_ADD_EMAIL: "client:add:email",

  SUPPLIER_ADD_NAME: "supplier:add:name",
  SUPPLIER_ADD_CONTACT: "supplier:add:contact",
  SUPPLIER_ADD_PHONE: "supplier:add:phone",

  SETTINGS_NEW_PASSWORD: "settings:new:password",
  SETTINGS_CONFIRM_PASSWORD: "settings:confirm:password",
} as const;
