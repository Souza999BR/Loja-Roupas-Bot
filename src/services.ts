
import { db } from "./db.js";
import {
  botUsers,
  products,
  stockMovements,
  clients,
  suppliers,
  sales,
  saleItems,
} from "./schema.js";
import { eq, and, desc, gte, sql, count } from "drizzle-orm";
import bcrypt from "bcryptjs";
import type { SaleItemTemp } from "./types.js";

export async function findUserByTelegramId(telegramId: number) {
  const rows = await db
    .select()
    .from(botUsers)
    .where(eq(botUsers.telegramId, telegramId))
    .limit(1);
  return rows[0] ?? null;
}

export async function createUser(data: {
  telegramId: number;
  name: string;
  storeName: string;
  phone?: string;
  email?: string;
  password: string;
}) {
  const passwordHash = await bcrypt.hash(data.password, 10);
  const [user] = await db
    .insert(botUsers)
    .values({
      telegramId: data.telegramId,
      name: data.name,
      storeName: data.storeName,
      phone: data.phone,
      email: data.email,
      passwordHash,
    })
    .returning();
  return user!;
}

export async function verifyPassword(hash: string, password: string) {
  return bcrypt.compare(password, hash);
}

export async function updatePassword(userId: number, newPassword: string) {
  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db
    .update(botUsers)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(botUsers.id, userId));
}

export async function getProducts(userId: number) {
  return db
    .select()
    .from(products)
    .where(and(eq(products.userId, userId), eq(products.isActive, true)))
    .orderBy(desc(products.createdAt));
}

export async function getProductById(productId: number, userId: number) {
  const rows = await db
    .select()
    .from(products)
    .where(and(eq(products.id, productId), eq(products.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createProduct(data: typeof products.$inferInsert) {
  const [product] = await db.insert(products).values(data).returning();
  return product!;
}

export async function updateProductQuantity(productId: number, newQty: number) {
  await db
    .update(products)
    .set({ quantityAvailable: newQty, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

export async function deactivateProduct(productId: number) {
  await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(products.id, productId));
}

export async function getLowStockProducts(userId: number) {
  return db
    .select()
    .from(products)
    .where(
      and(
        eq(products.userId, userId),
        eq(products.isActive, true),
        sql`${products.quantityAvailable} <= ${products.quantityMin}`
      )
    )
    .orderBy(products.quantityAvailable);
}

export async function addStockMovement(
  data: typeof stockMovements.$inferInsert
) {
  const [row] = await db.insert(stockMovements).values(data).returning();
  return row!;
}

export async function getStockHistory(productId: number, limit = 5) {
  return db
    .select()
    .from(stockMovements)
    .where(eq(stockMovements.productId, productId))
    .orderBy(desc(stockMovements.createdAt))
    .limit(limit);
}

export async function getClients(userId: number) {
  return db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.isActive, true)))
    .orderBy(clients.name);
}

export async function createClient(data: typeof clients.$inferInsert) {
  const [client] = await db.insert(clients).values(data).returning();
  return client!;
}

export async function getSuppliers(userId: number) {
  return db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.userId, userId), eq(suppliers.isActive, true)))
    .orderBy(suppliers.name);
}

export async function createSupplier(data: typeof suppliers.$inferInsert) {
  const [supplier] = await db.insert(suppliers).values(data).returning();
  return supplier!;
}

export async function createSale(
  saleData: typeof sales.$inferInsert,
  items: SaleItemTemp[]
) {
  const [sale] = await db.insert(sales).values(saleData).returning();
  const savedSale = sale!;

  if (items.length > 0) {
    await db.insert(saleItems).values(
      items.map((i) => ({
        saleId: savedSale.id,
        productId: i.productId,
        productName: i.productName,
        quantity: i.quantity,
        unitPrice: String(i.unitPrice),
        unitCost: String(i.unitCost),
        subtotalPrice: String(i.unitPrice * i.quantity),
        subtotalCost: String(i.unitCost * i.quantity),
      }))
    );

    for (const item of items) {
      const [prod] = await db
        .select()
        .from(products)
        .where(eq(products.id, item.productId))
        .limit(1);
      if (prod) {
        const newQty = prod.quantityAvailable - item.quantity;
        await updateProductQuantity(item.productId, Math.max(0, newQty));
        await addStockMovement({
          userId: saleData.userId,
          productId: item.productId,
          type: "sale",
          quantity: -item.quantity,
          notes: `Venda #${savedSale.id}`,
        });
      }
    }
  }

  return savedSale;
}

export async function getSales(userId: number, limit = 20) {
  return db
    .select()
    .from(sales)
    .where(eq(sales.userId, userId))
    .orderBy(desc(sales.createdAt))
    .limit(limit);
}

export async function getSaleItems(saleId: number) {
  return db.select().from(saleItems).where(eq(saleItems.saleId, saleId));
}

export async function getDashboardStats(userId: number) {
  const now = new Date();
  const todayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [todaySales] = await db
    .select({
      cnt: count(),
      total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.userId, userId), gte(sales.createdAt, todayStart)));

  const [monthSales] = await db
    .select({
      cnt: count(),
      total: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(and(eq(sales.userId, userId), gte(sales.createdAt, monthStart)));

  const [stockStats] = await db
    .select({
      totalProducts: count(),
      totalQty: sql<string>`coalesce(sum(${products.quantityAvailable}), 0)`,
    })
    .from(products)
    .where(and(eq(products.userId, userId), eq(products.isActive, true)));

  const lowStock = await getLowStockProducts(userId);

  const [clientStats] = await db
    .select({ cnt: count() })
    .from(clients)
    .where(and(eq(clients.userId, userId), eq(clients.isActive, true)));

  return {
    todaySales: {
      count: todaySales?.cnt ?? 0,
      total: parseFloat(String(todaySales?.total ?? "0")),
      profit: parseFloat(String(todaySales?.profit ?? "0")),
    },
    monthSales: {
      count: monthSales?.cnt ?? 0,
      total: parseFloat(String(monthSales?.total ?? "0")),
      profit: parseFloat(String(monthSales?.profit ?? "0")),
    },
    stock: {
      totalProducts: stockStats?.totalProducts ?? 0,
      totalQty: parseInt(String(stockStats?.totalQty ?? "0")),
      lowStockCount: lowStock.length,
    },
    clients: clientStats?.cnt ?? 0,
  };
}

export async function getFinancialSummary(
  userId: number,
  period: "day" | "week" | "month" | "all" = "month"
) {
  const now = new Date();
  let startDate: Date | null = null;

  if (period === "day")
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  else if (period === "week")
    startDate = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    );
  else if (period === "month")
    startDate = new Date(now.getFullYear(), now.getMonth(), 1);

  const conditions = startDate
    ? and(eq(sales.userId, userId), gte(sales.createdAt, startDate))
    : eq(sales.userId, userId);

  const [summary] = await db
    .select({
      totalSales: count(),
      revenue: sql<string>`coalesce(sum(${sales.totalAmount}), 0)`,
      totalCost: sql<string>`coalesce(sum(${sales.totalCost}), 0)`,
      profit: sql<string>`coalesce(sum(${sales.profit}), 0)`,
    })
    .from(sales)
    .where(conditions);

  return {
    totalSales: summary?.totalSales ?? 0,
    revenue: parseFloat(String(summary?.revenue ?? "0")),
    totalCost: parseFloat(String(summary?.totalCost ?? "0")),
    profit: parseFloat(String(summary?.profit ?? "0")),
  };
}

export function computeProductFinancials(product: {
  costPrice: string | null;
  salePrice: string | null;
  bagCost: string | null;
  giftCost: string | null;
  shippingCost: string | null;
  commission: string | null;
  otherCosts: string | null;
}) {
  const costPrice = parseFloat(String(product.costPrice ?? "0")) || 0;
  const salePrice = parseFloat(String(product.salePrice ?? "0")) || 0;
  const bagCost = parseFloat(String(product.bagCost ?? "0")) || 0;
  const giftCost = parseFloat(String(product.giftCost ?? "0")) || 0;
  const shippingCost = parseFloat(String(product.shippingCost ?? "0")) || 0;
  const commission = parseFloat(String(product.commission ?? "0")) || 0;
  const otherCosts = parseFloat(String(product.otherCosts ?? "0")) || 0;

  const totalCost =
    costPrice + bagCost + giftCost + shippingCost + commission + otherCosts;
  const grossProfit = salePrice - costPrice;
  const netProfit = salePrice - totalCost;
  const profitMargin = salePrice > 0 ? (netProfit / salePrice) * 100 : 0;
  const profitPercent = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;

  return {
    costPrice,
    salePrice,
    totalCost,
    grossProfit,
    netProfit,
    profitMargin,
    profitPercent,
  };
}

export function fmt(value: number) {
  return `R$ ${value.toFixed(2).replace(".", ",")}`;
}

export function fmtDate(date: Date) {
  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function paymentLabel(method: string) {
  const map: Record<string, string> = {
    pix: "PIX",
    cash: "Dinheiro",
    debit: "Cartão Débito",
    credit: "Cartão Crédito",
    transfer: "Transferência",
    boleto: "Boleto",
  };
  return map[method] ?? method;
}
