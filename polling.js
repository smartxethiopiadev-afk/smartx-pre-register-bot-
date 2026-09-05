import 'dotenv/config';
import { Telegraf } from 'telegraf';
import worker from './worker.js';

const token = process.env.TELEGRAM_BOT_TOKEN || process.env.BOT_TOKEN;

if (!token || token.startsWith('SIMULATOR_') || token.startsWith('8343942004:AAGs5bJ8_8F6lMv0_example')) {
  console.error('❌ Error: TELEGRAM_BOT_TOKEN is not configured with a valid token in .env');
  console.error('👉 Please open .env and set your real bot token from @BotFather:');
  console.error('   TELEGRAM_BOT_TOKEN=1234567890:ABC-DEF1234ghIkl-zyx57W2v1u123ew11');
  process.exit(1);
}

console.log('🚀 Starting Smart X Telegram Bot in Long Polling mode...');

const env = {
  TELEGRAM_BOT_TOKEN: token,
  BOT_TOKEN: token,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || process.env.GEMINI_API_KEYS,
  ADMIN_IDS: process.env.ADMIN_IDS || '12345678,7486847253',
  BROADCAST_ADMIN_ID: process.env.BROADCAST_ADMIN_ID || '7486847253'
};

const bot = new Telegraf(token);

// Route incoming updates from Telegram Long Polling directly into the Worker logic
bot.on('message', async (ctx) => {
  const req = new Request('http://localhost/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx.update)
  });
  await worker.fetch(req, env);
});

bot.on('callback_query', async (ctx) => {
  const req = new Request('http://localhost/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx.update)
  });
  await worker.fetch(req, env);
});

bot.on('inline_query', async (ctx) => {
  const req = new Request('http://localhost/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx.update)
  });
  await worker.fetch(req, env);
});

// Any other update type
bot.use(async (ctx) => {
  const req = new Request('http://localhost/webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ctx.update)
  });
  await worker.fetch(req, env);
});

bot.catch((err, ctx) => {
  console.error(`[Polling Bot Error for update ${ctx?.update?.update_id}]:`, err);
});

bot.launch({
  dropPendingUpdates: true
}).then(() => {
  console.log('✅ Smart X Telegram Bot is now LIVE and listening to messages!');
  console.log('👉 Open Telegram and test /start or /quiz on your bot.');
}).catch((err) => {
  console.error('❌ Failed to launch Telegram bot polling:', err.message);
  if (err.message.includes('404: Not Found') || err.message.includes('401: Unauthorized')) {
    console.error('👉 The provided TELEGRAM_BOT_TOKEN is invalid. Check @BotFather token.');
  } else if (err.message.includes('409: Conflict')) {
    console.error('👉 Another instance or Webhook is currently active. Remove webhook or stop other instances.');
  }
});

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
