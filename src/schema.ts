import {
  pgTable,
  serial,
  text,
  bigint,
  integer,
  numeric,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const botUsers = pgTable("bot_users", {
  id: serial("id").primaryKey(),
  telegramId: bigint("telegram_id", { mode: "number" }).notNull().unique(),
  name: text("name").notNull(),
  storeName: text("store_name").notNull(),
  phone: text("phone"),
  email: text("email"),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => botUsers.id),
  name: text("name").notNull(),
  code: text("code"),
  category: text("category"),
  brand: text("brand"),
  color: text("color"),
  size: text("size"),
  description: text("description"),
  quantityAvailable: integer("quantity_available").notNull().default(0),
  quantityMin: integer("quantity_min").notNull().default(5),
  costPrice: numeric("cost_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  salePrice: numeric("sale_price", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  bagCost: numeric("bag_cost", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  giftCost: numeric("gift_cost", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  shippingCost: numeric("shipping_cost", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  commission: numeric("commission", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  otherCosts: numeric("other_costs", { precision: 10, scale: 2 })
    .notNull()
    .default("0"),
  photoFileId: text("photo_file_id"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => botUsers.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  type: text("type").notNull(), // 'entry' | 'exit' | 'correction' | 'sale'
  quantity: integer("quantity").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const clients = pgTable("clients", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => botUsers.id),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const suppliers = pgTable("suppliers", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => botUsers.id),
  name: text("name").notNull(),
  contact: text("contact"),
  phone: text("phone"),
  email: text("email"),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => botUsers.id),
  clientId: integer("client_id").references(() => clients.id),
  clientName: text("client_name"),
  paymentMethod: text("payment_method").notNull(),
  totalAmount: numeric("total_amount", { precision: 10, scale: 2 }).notNull(),
  totalCost: numeric("total_cost", { precision: 10, scale: 2 }).notNull(),
  profit: numeric("profit", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const saleItems = pgTable("sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id")
    .notNull()
    .references(() => sales.id),
  productId: integer("product_id")
    .notNull()
    .references(() => products.id),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  unitCost: numeric("unit_cost", { precision: 10, scale: 2 }).notNull(),
  subtotalPrice: numeric("subtotal_price", {
    precision: 10,
    scale: 2,
  }).notNull(),
  subtotalCost: numeric("subtotal_cost", { precision: 10, scale: 2 }).notNull(),
});

export type BotUser = typeof botUsers.$inferSelect;
export type Product = typeof products.$inferSelect;
export type StockMovement = typeof stockMovements.$inferSelect;
export type Client = typeof clients.$inferSelect;
export type Supplier = typeof suppliers.$inferSelect;
export type Sale = typeof sales.$inferSelect;
export type SaleItem = typeof saleItems.$inferSelect;
