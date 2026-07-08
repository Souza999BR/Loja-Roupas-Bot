import "dotenv/config";
import { createBot } from "./bot.js";
import { logger } from "./logger.js";

const required = ["TELEGRAM_BOT_TOKEN", "DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    logger.error(`Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const bot = createBot();

bot.launch({ dropPendingUpdates: true }).then(() => {
  logger.info("LojaRoupasBot iniciado com sucesso!");
}).catch((err) => {
  logger.error({ err }, "Falha ao iniciar o bot");
  process.exit(1);
});

process.once("SIGINT", () => { bot.stop("SIGINT"); process.exit(0); });
process.once("SIGTERM", () => { bot.stop("SIGTERM"); process.exit(0); });
