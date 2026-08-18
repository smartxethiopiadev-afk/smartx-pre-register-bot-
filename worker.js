import { Telegraf, Markup } from 'telegraf';

// In-memory session tracking and fallback state
const userStates = {};
const registeredUsers = {};
const broadcastDrafts = {};
const lastBotMessages = {};

// Helper: Escape HTML special characters for Telegram HTML parse mode
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Robust Markdown to Telegram HTML Converter & Sanitizer
 */
function markdownToTelegramHtml(markdown) {
  if (!markdown) return '';
  let text = String(markdown);

  const codeBlocks = [];
  text = text.replace(/```([\s\S]*?)```/g, (match, code) => {
    const token = `__CODE_BLOCK_${codeBlocks.length}__`;
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return token;
  });

  const inlineCodes = [];
  text = text.replace(/`([^`]+)`/g, (match, code) => {
    const token = `__INLINE_CODE_${inlineCodes.length}__`;
    inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
    return token;
  });

  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');
  text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__(.*?)__/g, '<b>$1</b>');
  text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
  text = text.replace(/(^|\s)_(.*?)_($|\s)/g, '$1<i>$2</i>$3');
  text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');
  text = text.replace(/^\s*[\*\-]\s+/gm, '• ');

  inlineCodes.forEach((codeHtml, idx) => {
    text = text.replace(`__INLINE_CODE_${idx}__`, codeHtml);
  });

  codeBlocks.forEach((blockHtml, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, blockHtml);
  });

  return text.trim();
}

// Helper: Dynamically get Bot Username
function getBotUsername(ctx, env) {
  if (ctx?.botInfo?.username) return ctx.botInfo.username;
  if (ctx?.me?.username) return ctx.me.username;
  if (env?.BOT_USERNAME) return env.BOT_USERNAME.replace('@', '');
  if (process.env.BOT_USERNAME) return process.env.BOT_USERNAME.replace('@', '');
  return 'testing_pent_bot';
}

// Helper: Dynamically fetch channel or group handles from D1
async function getDynamicConfig(env, key, defaultVal) {
  if (env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?').bind(key).first();
      if (row?.value) return row.value;
      const infoRow = await env.DB.prepare('SELECT value FROM app_info WHERE key = ?').bind(key).first();
      if (infoRow?.value) return infoRow.value;
    } catch (err) {
      console.warn(`[DynamicConfig ${key} Error]:`, err.message);
    }
  }
  return defaultVal;
}

// Multi-language Translations Dictionary (Clean, Motivational, ZERO Brackets / Parentheses)
const i18n = {
  am: {
    diagnostic_question: (name) => `👋 <b>ሰላም ${escapeHtml(name)}!</b> 🇪🇹
እንኳን ወደ <b>Smart X Ethiopian</b> በደህና መጡ!

🎯 <b>አጭር ጥያቄ:</b>
በትምህርትህ ወቅት የከበደህን ትምህርት ለመረዳት፣ ማጠቃለያ ለማግኘት ወይም ለፈተና ለመዘጋጀት ተቸግረህ ታውቃለህ?`,

    welcome_start: (name) => `👋 <b>ሰላም ${escapeHtml(name)}!</b>

እንኳን ወደ <b>Smart X Ethiopian</b> በደህና መጡ! 🇪🇹
<i>የ 9-12ኛ ክፍል ተማሪዎች የትምህርት ውጤታቸውን ለማሻሻል የተዘጋጀ የጥናት መድረክ ነው።</i>

👇 <b>የትምህርት ክፍልህን ምረጥ:</b>`,

    welcome_back: (name, phone, grade, refCount = 0, points = 0, group = '@SmartX_Discussion') => `👋 <b>እንኳን በደህና ተመለሱ ${escapeHtml(name)}!</b> 🇪🇹

• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b> | <b>ስልክ:</b> <code>${escapeHtml(phone)}</code>
• <b>ሁኔታ:</b> 💎 <b>ነፃ የቪአይፒ አባልነት</b>
• <b>የጋበዝካቸው:</b> <code>${refCount}</code> ሰዎች (${points} ነጥብ)

አገልግሎቶችን ከታች ይምረጡ ⬇️`,

    channel_verify_step: (grade, group = '@SmartX_Discussion') => `✅ ክፍል: <b>${escapeHtml(grade)}</b>

📢 <b>የውይይት ግሩፕ:</b>
ሁሉንም የትምህርት ማጠቃለያዎች ለማግኘት <b>${escapeHtml(group)}</b> ግሩፕ ይቀላቀሉ።`,

    phone_request_step: `✅ የውይይት ግሩፕ ተረጋግጧል!

📱 <b>የስልክ ቁጥር:</b>
ምዝገባውን ለማጠናቀቅ የስልክ ቁጥርህን ላክ:`,

    reg_success: (name, phone, grade, group = '@SmartX_Discussion') => `🎉 <b>ምዝገባህ በተሳካ ሁኔታ ተጠናቋል!</b> 🚀

• <b>ስም:</b> ${escapeHtml(name)}
• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b>
• <b>ሁኔታ:</b> 💎 <b>ነፃ የቪአይፒ አባልነት</b>

አገልግሎቶችን ከታች ይምረጡ ⬇️`,

    menu: [
      ['📲 አፕሊኬሽን አውርድ', '👤 የእኔ ፕሮፋይል'],
      ['🔗 ለጓደኞችህ አጋራ', 'ℹ️ ስለ አፕሊኬሽኑ']
    ],

    app_hub_text: `📱 <b>Smart X Ethiopian አፕሊኬሽን በመስከረም 5 ይለቀቃል!</b>

👉 አፑ እንደተለቀቀ የቀጥታ ማውረጃ ሊንክ እና የ .apk ፋይል በዚህ ቦት ይላክልሃል። በትዕግስት ጠብቁን! 🚀`,

    about_text: `ℹ️ <b>Smart X Ethiopian</b> 🇪🇹

ለ 9-12ኛ ክፍል ተማሪዎች አዲሱን የስርዓተ ትምህርት መሰረት በማድረግ የተዘጋጀ የጥናት አፕሊኬሽን ነው።

• የምዕራፍ ማጠቃለያዎች
• የፈተና ጥያቄዎች እና መልሶች
• የሞዴል ፈተናዎች
• የመልቀቂያ ቀን: መስከረም 5 2019 ዓ.ም`
  }
};

// Helper: Check if user is a member of the discussion group/channel
async function checkDiscussionGroupMember(ctx, userId, env) {
  const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
  try {
    const member = await ctx.telegram.getChatMember(groupHandle, userId);
    if (['creator', 'administrator', 'member'].includes(member.status)) {
      return true;
    }
  } catch (err) {
    console.warn('[Discussion Group Member Check Warning]:', err.message);
  }
  return false;
}

// Helper: Verify if user is an Administrator
function isAdmin(userId, env) {
  if (!userId) return false;
  const uidStr = String(userId);
  const adminIdsStr = env?.ADMIN_IDS || env?.ADMIN_ID || env?.BROADCAST_ADMIN_ID || process.env.ADMIN_IDS || process.env.ADMIN_ID || process.env.BROADCAST_ADMIN_ID || '12345678';
  const configuredAdmins = adminIdsStr
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return configuredAdmins.includes(uidStr) || uidStr === '12345678';
}

// Helper: Extract rich media payload for broadcasts
function extractMessagePayload(msg) {
  if (!msg) return { type: 'text', text: '' };

  if (msg.photo && msg.photo.length > 0) {
    const bestPhoto = msg.photo[msg.photo.length - 1];
    return {
      type: 'photo',
      file_id: bestPhoto.file_id,
      caption: msg.caption || ''
    };
  }

  if (msg.video) {
    return {
      type: 'video',
      file_id: msg.video.file_id,
      caption: msg.caption || ''
    };
  }

  if (msg.audio) {
    return {
      type: 'audio',
      file_id: msg.audio.file_id,
      caption: msg.caption || ''
    };
  }

  if (msg.voice) {
    return {
      type: 'voice',
      file_id: msg.voice.file_id,
      caption: msg.caption || ''
    };
  }

  if (msg.document) {
    return {
      type: 'document',
      file_id: msg.document.file_id,
      caption: msg.caption || ''
    };
  }

  return {
    type: 'text',
    text: msg.text || ''
  };
}

// Broadcast Processor: Dispatches queued messages safely
async function processBroadcastQueueBatch(bot, env, batchSize = 25) {
  if (!env.DB) return { sent: 0, failed: 0, blocked: 0 };

  try {
    const queueRows = await env.DB.prepare(`
      SELECT q.id, q.broadcast_id, q.telegram_id, b.payload_json
      FROM broadcast_queue q
      JOIN broadcasts b ON q.broadcast_id = b.id
      WHERE q.status = 'pending'
      LIMIT ?
    `).bind(batchSize).all();

    if (!queueRows?.results || queueRows.results.length === 0) {
      return { sent: 0, failed: 0, blocked: 0 };
    }

    let sent = 0;
    let failed = 0;
    let blocked = 0;

    for (const item of queueRows.results) {
      let payload = {};
      try {
        payload = JSON.parse(item.payload_json);
      } catch (e) {
        payload = { type: 'text', text: item.payload_json };
      }

      let extra = { parse_mode: payload.parse_mode || 'HTML' };
      if (payload.button && payload.button.text && payload.button.url) {
        extra.reply_markup = {
          inline_keyboard: [[{ text: payload.button.text, url: payload.button.url }]]
        };
      }

      try {
        if (payload.type === 'photo') {
          await bot.telegram.sendPhoto(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'video') {
          await bot.telegram.sendVideo(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'audio') {
          await bot.telegram.sendAudio(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'voice') {
          await bot.telegram.sendVoice(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'document') {
          await bot.telegram.sendDocument(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else {
          await bot.telegram.sendMessage(item.telegram_id, payload.text || 'Notification from Smart X', extra);
        }

        sent++;
        await env.DB.prepare(`
          UPDATE broadcast_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(item.id).run();

        await env.DB.prepare(`
          UPDATE broadcasts 
          SET sent_count = sent_count + 1, 
              pending_count = MAX(0, pending_count - 1),
              updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `).bind(item.broadcast_id).run();

      } catch (err) {
        const msg = (err?.message || '').toLowerCase();
        const isBlocked = msg.includes('blocked') || msg.includes('deactivated') || msg.includes('user is deactivated') || msg.includes('bot was blocked');

        if (isBlocked) {
          blocked++;
          await env.DB.prepare(`
            UPDATE broadcast_queue SET status = 'blocked', error = ?, sent_at = CURRENT_TIMESTAMP WHERE id = ?
          `).bind(err.message, item.id).run();

          await env.DB.prepare(`
            UPDATE broadcasts 
            SET blocked_count = blocked_count + 1, 
                pending_count = MAX(0, pending_count - 1),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(item.broadcast_id).run();

          await env.DB.prepare(`
            UPDATE users SET is_active = 0, is_blocked = 1 WHERE telegram_id = ?
          `).bind(item.telegram_id).run();
        } else {
          failed++;
          await env.DB.prepare(`
            UPDATE broadcast_queue SET status = 'failed', error = ?, attempts = attempts + 1 WHERE id = ?
          `).bind(err.message, item.id).run();

          await env.DB.prepare(`
            UPDATE broadcasts 
            SET failed_count = failed_count + 1, 
                pending_count = MAX(0, pending_count - 1),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(item.broadcast_id).run();
        }
      }
    }

    return { sent, failed, blocked };
  } catch (err) {
    console.error('Broadcast Queue Error:', err);
    return { sent: 0, failed: 0, blocked: 0 };
  }
}

// Helper: Build Admin Dashboard Data
async function buildAdminDashboardData(env) {
  let userCount = 0;
  let activeUserCount = 0;
  let blockedCount = 0;
  let gradeBreakdown = {};
  let totalReferrals = 0;

  if (env?.DB) {
    try {
      const uRes = await env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive, SUM(referral_count) as refs FROM users`).first();
      userCount = uRes?.total || 0;
      activeUserCount = uRes?.active || 0;
      blockedCount = uRes?.inactive || 0;
      totalReferrals = uRes?.refs || 0;

      const gRes = await env.DB.prepare(`SELECT grade, COUNT(*) as cnt FROM users GROUP BY grade`).all();
      if (gRes?.results) {
        gRes.results.forEach(r => { gradeBreakdown[r.grade] = r.cnt; });
      }
    } catch (e) {
      console.error('Admin stats error:', e);
    }
  } else {
    userCount = Object.keys(registeredUsers).length;
    activeUserCount = userCount;
  }

  const text =
`👑 <b>Smart X Ethiopian — Admin Dashboard</b> 🇪🇹

━━━━━━━━━━━━━━━━━━━━
• 👥 <b>ተመዝጋቢ ተማሪዎች:</b> <code>${userCount}</code>
• 🟢 <b>ንቁ ተጠቃሚዎች:</b> <code>${activeUserCount}</code>
• 🔴 <b>ቦት ያቆሙ (Blocked):</b> <code>${blockedCount}</code>
• 🔗 <b>ጠቅላላ የጥቆማ ግብዣዎች:</b> <code>${totalReferrals}</code>

🎓 <b>የክፍል ክፍፍል:</b>
• 9ኛ ክፍል: <code>${gradeBreakdown['Grade 9'] || 0}</code>
• 10ኛ ክፍል: <code>${gradeBreakdown['Grade 10'] || 0}</code>
• 11ኛ ክፍል: <code>${gradeBreakdown['Grade 11'] || 0}</code>
• 12ኛ ክፍል: <code>${gradeBreakdown['Grade 12'] || 0}</code>
━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📢 New Broadcast', 'admin_new_broadcast'),
      Markup.button.callback('👥 Recent Users', 'admin_recent_users')
    ],
    [
      Markup.button.callback('🔄 Refresh Stats', 'admin_refresh_stats')
    ]
  ]);

  return { text, keyboard };
}

// Initialize Database Schema
async function initDb(db) {
  if (!db) return;
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        grade TEXT NOT NULL,
        stream TEXT NOT NULL,
        language TEXT DEFAULT 'am',
        referred_by INTEGER,
        referral_count INTEGER DEFAULT 0,
        points INTEGER DEFAULT 0,
        is_vip INTEGER DEFAULT 0,
        is_channel_member INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        is_blocked INTEGER DEFAULT 0,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS app_info (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS system_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS broadcasts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        message_type TEXT DEFAULT 'text',
        payload_json TEXT NOT NULL,
        total_recipients INTEGER DEFAULT 0,
        sent_count INTEGER DEFAULT 0,
        failed_count INTEGER DEFAULT 0,
        blocked_count INTEGER DEFAULT 0,
        pending_count INTEGER DEFAULT 0,
        status TEXT DEFAULT 'queued',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS broadcast_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broadcast_id INTEGER,
        telegram_id INTEGER,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        sent_at DATETIME,
        error TEXT,
        FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
      );
    `);

    // Seed defaults
    const seedItems = [
      ['app_name', 'Smart X Ethiopian'],
      ['release_date', 'መስከረም 5 2019 ዓ.ም'],
      ['target_audience', '9ኛ - 12ኛ ክፍል ተማሪዎች'],
      ['official_channel', '@SmartXEthiopia'],
      ['discussion_group', '@SmartX_Discussion']
    ];

    for (const [k, v] of seedItems) {
      await db.prepare(`
        INSERT INTO app_info (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).bind(k, v).run();
    }

    const sysItems = [
      ['bot_version', 'v4.0-clean'],
      ['required_channel', '@SmartX_Discussion'],
      ['official_channel', '@SmartXEthiopia']
    ];

    for (const [k, v] of sysItems) {
      await db.prepare(`
        INSERT INTO system_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).bind(k, v).run();
    }
  } catch (err) {
    console.error('D1 Init Error:', err);
  }
}

// Clean message sender using HTML parse mode by default and deleting prior message
async function sendCleanMessage(ctx, text, extra = {}) {
  const chatId = ctx.chat?.id;
  if (!chatId) {
    try {
      return await ctx.reply(text, { parse_mode: 'HTML', ...extra });
    } catch (err) {
      console.warn('[sendCleanMessage fallback error]:', err.message);
      return null;
    }
  }

  if (lastBotMessages[chatId]) {
    try {
      await ctx.telegram.deleteMessage(chatId, lastBotMessages[chatId]);
    } catch (err) {}
  }

  try {
    const sentMsg = await ctx.reply(text, { parse_mode: 'HTML', ...extra });
    if (sentMsg?.message_id) {
      lastBotMessages[chatId] = sentMsg.message_id;
    }
    return sentMsg;
  } catch (err) {
    console.warn('[sendCleanMessage error]:', err.message);
    return null;
  }
}

export default {
  async scheduled(event, env, ctx) {
    const apiKey = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!apiKey || !env.DB) return;

    const bot = new Telegraf(apiKey);
    bot.catch((err) => {
      console.warn('[Telegraf Scheduled Global Catch]:', err?.message || err);
    });
    ctx.waitUntil(processBroadcastQueueBatch(bot, env, 25));
  },

  async fetch(request, env) {
    const apiKey = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!apiKey) {
      return new Response('Error: TELEGRAM_BOT_TOKEN is not set in environment or secrets.', { status: 500 });
    }

    const bot = new Telegraf(apiKey);
    bot.catch((err) => {
      console.warn('[Telegraf Worker Global Catch]:', err?.message || err);
    });
    const url = new URL(request.url);

    if (env.DB) {
      await initDb(env.DB);
    }

    if (url.pathname === '/register') {
      try {
        const webhookUrl = `${url.origin}/webhook`;
        if (apiKey.startsWith('SIMULATOR_') || apiKey.startsWith('YOUR_')) {
          return new Response(`Notice: Bot token is in simulator/demo mode. Live webhook registration at Telegram skipped.`, { status: 200 });
        }
        await bot.telegram.setWebhook(webhookUrl);
        return new Response(`Webhook successfully registered at: ${webhookUrl}`, { status: 200 });
      } catch (err) {
        console.warn('Webhook Registration Warning:', err.message);
        return new Response(`Registration Notice: ${err.message}`, { status: 200 });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        // --- 1. /start & /register Handler ---
        const handleStartOrRegister = async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const userName = ctx.from?.first_name || 'ተማሪ';
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          const startPayload = ctx.startPayload || '';
          let referredBy = null;

          if (startPayload.startsWith('ref_')) {
            const parsedId = parseInt(startPayload.replace('ref_', ''), 10);
            if (parsedId && parsedId !== userId) {
              referredBy = parsedId;
            }
          }

          // Check if user is ALREADY registered in D1 database or memory cache
          let existingUser = registeredUsers[userId];
          if (!existingUser && env.DB) {
            try {
              const row = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(userId).first();
              if (row && row.phone && row.phone !== 'N/A' && row.phone !== 'Pending') {
                existingUser = row;
                registeredUsers[userId] = row;
              }
            } catch (err) {
              console.error('Check existing user error:', err);
            }
          }

          // Case A: User is ALREADY REGISTERED -> Show "Welcome Back!" & Unlock Dashboard
          if (existingUser && existingUser.phone && existingUser.phone !== 'N/A' && existingUser.phone !== 'Pending') {
            const name = existingUser.full_name || userName;
            const phone = existingUser.phone;
            const grade = existingUser.grade || '10ኛ ክፍል';
            const refCount = existingUser.referral_count || 0;
            const points = existingUser.points || 0;
            const welcomeBackMsg = i18n.am.welcome_back(name, phone, grade, refCount, points, groupHandle);
            const mainDashboardKeyboard = Markup.keyboard(i18n.am.menu).resize();

            return sendCleanMessage(ctx, welcomeBackMsg, {
              parse_mode: 'HTML',
              ...mainDashboardKeyboard
            });
          }

          // Case B: User is NOT YET REGISTERED -> Step 0: Psychology / Study Diagnostic Question (No Brackets)
          userStates[chatId] = {
            step: 'AWAITING_DIAGNOSTIC',
            data: {
              fullName: ctx.from?.first_name ? `${ctx.from.first_name} ${ctx.from?.last_name || ''}`.trim() : 'ተማሪ',
              telegramId: userId,
              referredBy: referredBy
            }
          };

          const diagMsg = i18n.am.diagnostic_question(userName);
          const diagKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ አዎ፣ ይከብደኛል', 'diag_answer_yes'),
              Markup.button.callback('❌ አይ፣ ዝግጁ ነኝ', 'diag_answer_no')
            ]
          ]);

          return sendCleanMessage(ctx, diagMsg, {
            parse_mode: 'HTML',
            ...diagKeyboard
          });
        };

        bot.start(handleStartOrRegister);
        bot.command(['register', 'onboarding', 'signup'], handleStartOrRegister);

        // --- Step 0 Action: Diagnostic Psychology Response -> Step 1: Grade Selection ---
        bot.action(['diag_answer_yes', 'diag_answer_no'], async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const isYes = ctx.callbackQuery.data === 'diag_answer_yes';
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;

          if (!userStates[chatId]) {
            userStates[chatId] = {
              step: 'AWAITING_GRADE',
              data: {
                fullName: ctx.from?.first_name ? `${ctx.from.first_name} ${ctx.from?.last_name || ''}`.trim() : 'ተማሪ',
                telegramId: userId
              }
            };
          }
          userStates[chatId].step = 'AWAITING_GRADE';
          userStates[chatId].data.diagAnswer = isYes ? 'Yes' : 'No';

          const transitionMsg = isYes
            ? '💡 <b>አይዞህ! Smart X Ethiopian በምዕራፍ ማጠቃለያዎች እና በሺዎች በሚቆጠሩ የፈተና ጥያቄዎች ሁሉንም ያቀልልሃል!</b>\n\n👇 <b>የትምህርት ክፍልህን ምረጥ:</b>'
            : '🔥 <b>በጣም ጎበዝ! Smart X Ethiopian በፈተናዎችህ ከፍተኛ ውጤት እንድታስመዘግብ ያግዝሃል!</b>\n\n👇 <b>የትምህርት ክፍልህን ምረጥ:</b>';

          const gradeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('9ኛ ክፍል', 'set_grade_9'),
              Markup.button.callback('10ኛ ክፍል', 'set_grade_10')
            ],
            [
              Markup.button.callback('11ኛ ክፍል', 'set_grade_11'),
              Markup.button.callback('12ኛ ክፍል', 'set_grade_12')
            ]
          ]);

          return sendCleanMessage(ctx, transitionMsg, {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        // --- Step 1 Action: Grade Selection -> Step 2: Discussion Group Check ---
        bot.action(/set_grade_(\d+)/, async (ctx) => {
          const gradeNum = ctx.match[1];
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          const grade = `${gradeNum}ኛ ክፍል`;
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_GRADE', data: {} };
          }
          userStates[chatId].data.grade = grade;
          userStates[chatId].data.fullName = ctx.from?.first_name ? `${ctx.from.first_name} ${ctx.from?.last_name || ''}`.trim() : 'ተማሪ';

          await ctx.answerCbQuery(`ክፍል ${gradeNum} ተመርጧል! ✅`).catch(() => {});

          // Verify if already a member of the required group
          const isMember = await checkDiscussionGroupMember(ctx, userId, env);

          if (isMember) {
            userStates[chatId].step = 'AWAITING_PHONE';
            const phoneKeyboard = Markup.keyboard([
              [Markup.button.contactRequest('📱 ስልክ ቁጥር አጋራ')]
            ]).resize().oneTime();

            return sendCleanMessage(ctx, i18n.am.phone_request_step, {
              parse_mode: 'HTML',
              ...phoneKeyboard
            });
          }

          userStates[chatId].step = 'AWAITING_CHANNEL_VERIFY';
          const groupUrl = `https://t.me/${groupHandle.replace('@', '')}`;
          const verifyKeyboard = Markup.inlineKeyboard([
            [Markup.button.url(`💬 ግሩፑን ተቀላቀል`, groupUrl)],
            [Markup.button.callback('✅ አረጋግጥ', 'verify_channel_step')]
          ]);

          return sendCleanMessage(ctx, i18n.am.channel_verify_step(grade, groupHandle), {
            parse_mode: 'HTML',
            ...verifyKeyboard
          });
        });

        // --- Step 2 Action: Discussion Group Verification Callback ---
        bot.action('verify_channel_step', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          const isMember = await checkDiscussionGroupMember(ctx, userId, env);

          if (!isMember) {
            return ctx.answerCbQuery(`⚠️ እባክዎን መጀመሪያ ${groupHandle} ግሩፕ ይቀላቀሉ!`, { show_alert: true }).catch(() => {});
          }

          await ctx.answerCbQuery('✅ የውይይት ግሩፕ አባልነትዎ ተረጋግጧል! 🎉').catch(() => {});

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_PHONE', data: { grade: '10ኛ ክፍል' } };
          }
          userStates[chatId].step = 'AWAITING_PHONE';

          const phoneKeyboard = Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥር አጋራ')]
          ]).resize().oneTime();

          return sendCleanMessage(ctx, i18n.am.phone_request_step, {
            parse_mode: 'HTML',
            ...phoneKeyboard
          });
        });

        // --- Step 3 Helper: Save to Cloudflare D1, Credit Referrer & Unlock Dashboard ---
        const completeRegistrationAndUnlockDashboard = async (ctx, phone) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const stateData = userStates[chatId]?.data || {};

          const fullName = stateData.fullName || ctx.from?.first_name || 'ተማሪ';
          const grade = stateData.grade || '10ኛ ክፍል';
          const cleanPhone = phone || 'N/A';
          const referredBy = stateData.referredBy || null;
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          if (env.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO users (telegram_id, full_name, phone, grade, stream, language, referred_by, is_channel_member, is_active, registered_at)
                VALUES (?, ?, ?, ?, 'General', 'am', ?, 1, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(telegram_id) DO UPDATE SET
                  full_name = excluded.full_name,
                  phone = excluded.phone,
                  grade = excluded.grade,
                  language = 'am',
                  is_channel_member = 1,
                  is_active = 1,
                  registered_at = CURRENT_TIMESTAMP
              `).bind(userId, fullName, cleanPhone, grade, referredBy).run();

              // Credit referrer if joined via referral link
              if (referredBy && referredBy !== userId) {
                await env.DB.prepare(`
                  UPDATE users 
                  SET referral_count = COALESCE(referral_count, 0) + 1,
                      points = COALESCE(points, 0) + 10,
                      is_vip = CASE WHEN (COALESCE(referral_count, 0) + 1) >= 5 THEN 1 ELSE is_vip END,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE telegram_id = ?
                `).bind(referredBy).run();

                try {
                  const refRow = await env.DB.prepare('SELECT full_name, referral_count, points FROM users WHERE telegram_id = ?').bind(referredBy).first();
                  const updatedCount = refRow?.referral_count || 1;
                  const updatedPoints = refRow?.points || 10;

                  const refNotifyMsg =
`🎉 <b>አዲስ ተማሪ በጥቆማዎ ተመዘገበ!</b> 🚀

• <b>የተመዘገበው ተማሪ:</b> ${escapeHtml(fullName)}
• <b>ክፍል:</b> ${escapeHtml(grade)}
• <b>ሽልማት:</b> <code>+10 ነጥብ</code> አግኝተዋል!
• <b>ጠቅላላ የተጋበዙ:</b> <code>${updatedCount}</code> ሰዎች (${updatedPoints} ነጥብ)`;

                  await bot.telegram.sendMessage(referredBy, refNotifyMsg, { parse_mode: 'HTML' });
                } catch (notifyErr) {
                  console.warn('[Referrer Notification Log]:', notifyErr.message);
                }
              }
            } catch (err) {
              console.error('D1 Save User Error:', err);
            }
          }

          registeredUsers[userId] = {
            telegram_id: userId,
            full_name: fullName,
            phone: cleanPhone,
            grade,
            language: 'am',
            referred_by: referredBy,
            referral_count: 0,
            points: 0,
            is_active: 1,
            registered_at: new Date().toISOString()
          };

          if (userStates[chatId]) userStates[chatId].step = null;

          const mainDashboardKeyboard = Markup.keyboard(i18n.am.menu).resize();

          return sendCleanMessage(ctx, i18n.am.reg_success(fullName, cleanPhone, grade, groupHandle), {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
        };

        bot.on('contact', async (ctx) => {
          const phone = ctx.message.contact?.phone_number || '';
          return completeRegistrationAndUnlockDashboard(ctx, phone);
        });

        // --- DASHBOARD BUTTON 1: 📲 አፕሊኬሽን አውርድ ---
        const handleDownloadApp = async (ctx) => {
          return sendCleanMessage(ctx, i18n.am.app_hub_text, {
            parse_mode: 'HTML',
            ...Markup.keyboard(i18n.am.menu).resize()
          });
        };

        bot.hears(['📲 አፕሊኬሽን አውርድ', 'አፕ አውርድ', 'Download App', 'Download', 'App'], handleDownloadApp);
        bot.command(['download', 'app', 'apk'], handleDownloadApp);

        // --- DASHBOARD BUTTON 2: 👤 የእኔ ፕሮፋይል ---
        const handleMyProfile = async (ctx) => {
          const userId = ctx.from.id;
          const botUsername = getBotUsername(ctx, env);
          let user = registeredUsers[userId];

          if (env.DB) {
            try {
              const row = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(userId).first();
              if (row) user = row;
            } catch (err) {}
          }

          const name = user?.full_name || ctx.from?.first_name || 'ተማሪ';
          const phone = user?.phone || 'N/A';
          const grade = user?.grade || '10ኛ ክፍል';
          const refCount = user?.referral_count || 0;
          const points = user?.points || 0;

          const profileText =
`👤 <b>የተጠቃሚ መረጃ</b> 🇪🇹

• <b>ስም:</b> ${escapeHtml(name)}
• <b>ስልክ:</b> <code>${escapeHtml(phone)}</code>
• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b>
• <b>የተጋበዙ:</b> <code>${refCount}</code> ሰዎች
• <b>ያገኙት ነጥብ:</b> <code>${points}</code> ነጥብ
• <b>ሁኔታ:</b> 💎 <b>ነፃ የቪአይፒ አባልነት</b>

🔗 <b>የመጋበዣ ሊንክ:</b>
<code>https://t.me/${botUsername}?start=ref_${userId}</code>`;

          const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${userId}&text=${encodeURIComponent('🔥 ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ የጥናት እና የፈተና ጥያቄዎች መተግበሪያ! አሁኑኑ ይመዝገቡ!')}`;

          const profileKeyboard = Markup.inlineKeyboard([
            [Markup.button.url('📲 ሊንክ አጋራ', shareUrl)],
            [Markup.button.callback('✏️ ክፍል ቀይር', 'change_grade_action')]
          ]);

          return sendCleanMessage(ctx, profileText, {
            parse_mode: 'HTML',
            ...profileKeyboard
          });
        };

        bot.hears(['👤 የእኔ ፕሮፋይል', 'የእኔ ፕሮፋይል', 'My Profile', 'Profile'], handleMyProfile);
        bot.command(['profile', 'myprofile'], handleMyProfile);

        bot.action('change_grade_action', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const gradeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('9ኛ ክፍል', 'set_grade_9'),
              Markup.button.callback('10ኛ ክፍል', 'set_grade_10')
            ],
            [
              Markup.button.callback('11ኛ ክፍል', 'set_grade_11'),
              Markup.button.callback('12ኛ ክፍል', 'set_grade_12')
            ]
          ]);

          return sendCleanMessage(ctx, '🔹 <b>የትምህርት ክፍልህን ምረጥ:</b>', {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        // --- DASHBOARD BUTTON 3: 🔗 ለጓደኞችህ አጋራ ---
        const handleShareInvite = async (ctx) => {
          const userId = ctx.from.id;
          const botUsername = getBotUsername(ctx, env);
          let user = registeredUsers[userId];

          if (env.DB) {
            try {
              const row = await env.DB.prepare('SELECT referral_count, points FROM users WHERE telegram_id = ?').bind(userId).first();
              if (row) user = row;
            } catch (err) {}
          }

          const refCount = user?.referral_count || 0;
          const points = user?.points || 0;
          const shareLink = `https://t.me/${botUsername}?start=ref_${userId}`;
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('🔥 ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ የጥናት እና የፈተና ጥያቄዎች መተግበሪያ! አሁኑኑ ይመዝገቡ!')}`;

          const shareText =
`🔗 <b>ጓደኞችን ጋብዝ — Smart X Ethiopian</b> 🇪🇹

• <b>የተጋበዙ:</b> <code>${refCount}</code> ሰዎች
• <b>ያገኙት ነጥብ:</b> <code>${points}</code> ነጥብ
• <b>ሁኔታ:</b> 💎 <b>ነፃ የቪአይፒ አባልነት</b>

🎁 <b>የመጋበዣ ሊንክ:</b>
<code>${shareLink}</code>

ጓደኞችህን በመጋበዝ ተጨማሪ ነጥብ አግኝ!`;

          const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.url('📲 ለጓደኞች አጋራ', shareUrl)],
            [Markup.button.callback('👤 የእኔ ፕሮፋይል', 'view_my_profile_callback')]
          ]);

          return sendCleanMessage(ctx, shareText, {
            parse_mode: 'HTML',
            ...shareKeyboard
          });
        };

        bot.hears(['🔗 ለጓደኞችህ አጋራ', 'ለጓደኞችህ አጋራ', 'ጓደኞችን ጋብዝ', 'Share', 'Invite'], handleShareInvite);
        bot.command(['share', 'invite', 'referral'], handleShareInvite);

        bot.action('view_my_profile_callback', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          return handleMyProfile(ctx);
        });

        // --- DASHBOARD BUTTON 4: ℹ️ ስለ አፕሊኬሽኑ ---
        const handleAboutApp = async (ctx) => {
          const officialChannel = await getDynamicConfig(env, 'official_channel', '@SmartXEthiopia');
          const discussionGroup = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          return sendCleanMessage(ctx, i18n.am.about_text, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.url('📢 ቻናል', `https://t.me/${officialChannel.replace('@', '')}`)],
              [Markup.button.url('💬 ውይይት', `https://t.me/${discussionGroup.replace('@', '')}`)]
            ])
          });
        };

        bot.hears(['ℹ️ ስለ አፕሊኬሽኑ', 'ስለ አፕሊኬሽኑ', 'About', 'መረጃ'], handleAboutApp);
        bot.command(['about', 'info', 'faq'], handleAboutApp);

        // --- OPTIMIZED INLINE QUERY HANDLER (PROMOTIONAL & MOTIVATIONAL - NO BRACKETS) ---
        bot.on('inline_query', async (ctx) => {
          const userId = ctx.from?.id || 0;
          const botUsername = getBotUsername(ctx, env);
          const inviteDeepLink = `https://t.me/${botUsername}?start=ref_${userId}`;

          // Motivational Promotional Call for Grades 9-12 Students (Zero Parentheses / Brackets)
          const promoShareText =
`✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል እና ለፈተና በብቃት ለመዘጋጀት ዝግጁ ናችሁ?

የምዕራፍ ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና አጋዥ የጥናት ቁሳቁሶች ተዘጋጅተውላችኋል!

🎁 <b>የቅድመ ምዝገባ እድሉን ተጠቅመው አሁኑኑ ይመዝገቡ!</b>`;

          const singleRegisterMarkup = {
            inline_keyboard: [
              [
                { text: '🚀 አሁኑኑ ይመዝገቡ', url: inviteDeepLink }
              ]
            ]
          };

          const results = [
            {
              type: 'article',
              id: `smartx_promo_${userId}`,
              title: '🇪🇹 Smart X Ethiopian — ለ 9-12ኛ ክፍል ተማሪዎች',
              description: 'የቅድመ ምዝገባ ጥሪ • የምዕራፍ ማጠቃለያዎች እና የፈተና ጥያቄዎች',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
              input_message_content: {
                message_text: promoShareText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              },
              reply_markup: singleRegisterMarkup
            }
          ];

          try {
            return await ctx.answerInlineQuery(results, {
              cache_time: 10,
              is_personal: true
            });
          } catch (err) {
            console.error('Inline Query Error:', err.message);
          }
        });

        // --- ADMIN DASHBOARD COMMANDS ---
        const handleAdminDashboard = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ <b>Access Denied!</b> Admin authorization required.', { parse_mode: 'HTML' });
          }

          const { text, keyboard } = await buildAdminDashboardData(env);
          return sendCleanMessage(ctx, text, {
            parse_mode: 'HTML',
            ...keyboard
          });
        };

        bot.command(['admin', 'dashboard', 'panel'], handleAdminDashboard);

        bot.action('admin_refresh_stats', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery('Refreshing stats...').catch(() => {});
          const { text, keyboard } = await buildAdminDashboardData(env);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        bot.action('admin_recent_users', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery().catch(() => {});
          let userRows = [];
          let totalCount = 0;

          if (env?.DB) {
            try {
              const cRes = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first();
              totalCount = cRes?.total || 0;
              const rowsRes = await env.DB.prepare('SELECT telegram_id, full_name, phone, grade, referral_count, points, registered_at FROM users ORDER BY registered_at DESC LIMIT 10').all();
              userRows = rowsRes?.results || [];
            } catch (e) {
              console.error('Fetch users error:', e);
            }
          }

          let listText = userRows.map((u, i) => 
            `${i + 1}. <b>${escapeHtml(u.full_name)}</b> (<code>#${u.telegram_id}</code>)\n   • 🎓 ${escapeHtml(u.grade)} | 📱 <code>${escapeHtml(u.phone)}</code> | 🔗 ${u.referral_count || 0} refs (${u.points || 0} pts)`
          ).join('\n\n');

          const responseText = 
`👥 <b>የቅርብ ጊዜ ተመዝጋቢዎች (ጠቅላላ: ${totalCount}):</b>

━━━━━━━━━━━━━━━━━━━━
${listText || '<i>ምንም ተማሪ አልተገኘም።</i>'}
━━━━━━━━━━━━━━━━━━━━`;

          const backKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback('⬅️ Back to Admin Dashboard', 'admin_refresh_stats')]
          ]);

          return sendCleanMessage(ctx, responseText, {
            parse_mode: 'HTML',
            ...backKeyboard
          });
        });

        // Admin Action: Trigger New Broadcast Flow
        bot.action('admin_new_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery().catch(() => {});
          const chatId = ctx.chat.id;
          userStates[chatId] = { step: 'AWAITING_BROADCAST_CONTENT' };

          return sendCleanMessage(ctx,
            `📢 <b>Admin Broadcast Creation</b>\n\n` +
            `Send or forward the message you want to broadcast to all pre-registered users in Cloudflare D1.\n\n` +
            `Send <code>/cancel_broadcast</code> to cancel.`,
            { parse_mode: 'HTML' }
          );
        });

        bot.command('broadcast', (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ <b>Access Denied!</b> Admin command only.', { parse_mode: 'HTML' });

          userStates[chatId] = { step: 'AWAITING_BROADCAST_CONTENT' };
          return sendCleanMessage(ctx,
            `📢 <b>Admin Broadcast Creation</b>\n\nSend or forward the broadcast message to all registered users:`,
            { parse_mode: 'HTML' }
          );
        });

        bot.command('cancel_broadcast', (ctx) => {
          const chatId = ctx.chat.id;
          if (userStates[chatId]?.step === 'AWAITING_BROADCAST_CONTENT' || userStates[chatId]?.step === 'AWAITING_BROADCAST_BUTTON') {
            userStates[chatId].step = null;
            delete broadcastDrafts[chatId];
            return sendCleanMessage(ctx, '❌ Broadcast creation cancelled.');
          }
          return sendCleanMessage(ctx, 'No active broadcast session.');
        });

        bot.action('start_broadcast_confirm', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          const draft = broadcastDrafts[chatId];
          if (!draft) {
            await ctx.answerCbQuery('⚠️ Draft not found.').catch(() => {});
            return ctx.reply('⚠️ Draft not found.');
          }

          await ctx.answerCbQuery('🚀 Starting Broadcast...').catch(() => {});
          delete broadcastDrafts[chatId];

          return startBroadcastProcess(ctx, draft);
        });

        bot.action('cancel_broadcast_draft', async (ctx) => {
          const chatId = ctx.chat.id;
          delete broadcastDrafts[chatId];
          if (userStates[chatId]) userStates[chatId].step = null;
          await ctx.answerCbQuery('Cancelled.').catch(() => {});
          return ctx.editMessageText('❌ Broadcast draft cancelled.');
        });

        async function startBroadcastProcess(ctx, payload) {
          const adminId = ctx.from.id;
          let recipientIds = [];

          if (env.DB) {
            try {
              const res = await env.DB.prepare(`SELECT telegram_id FROM users WHERE is_active = 1`).all();
              recipientIds = (res.results || []).map(r => r.telegram_id);
            } catch (err) {
              console.error('Fetch users error:', err);
            }
          }

          if (recipientIds.length === 0) {
            recipientIds = Object.keys(registeredUsers)
              .filter(id => registeredUsers[id].is_active !== false && registeredUsers[id].is_active !== 0)
              .map(id => Number(id));
          }

          if (recipientIds.length === 0) recipientIds = [adminId];

          const totalRecipients = recipientIds.length;
          let broadcastId = Date.now();

          if (env.DB) {
            try {
              const bRes = await env.DB.prepare(`
                INSERT INTO broadcasts (admin_id, message_type, payload_json, total_recipients, pending_count, status)
                VALUES (?, ?, ?, ?, ?, 'in_progress')
              `).bind(adminId, payload.type, JSON.stringify(payload), totalRecipients, totalRecipients).run();

              if (bRes.meta?.last_row_id) broadcastId = bRes.meta.last_row_id;

              const statements = recipientIds.map(tgId =>
                env.DB.prepare(`
                  INSERT INTO broadcast_queue (broadcast_id, telegram_id, status)
                  VALUES (?, ?, 'pending')
                `).bind(broadcastId, tgId)
              );

              await env.DB.batch(statements);
            } catch (err) {
              console.error('Queue error:', err);
            }
          }

          await sendCleanMessage(ctx,
            `🚀 <b>Broadcast queued in Cloudflare D1!</b>\n\n🆔 <b>ID:</b> #${broadcastId}\n📬 <b>Total:</b> ${totalRecipients}`,
            { parse_mode: 'HTML' }
          );

          const batchRes = await processBroadcastQueueBatch(bot, env, 25);

          return sendCleanMessage(ctx,
            `📊 <b>First Batch Result:</b>\n• Delivered: ${batchRes.sent || 0}\n• Blocked: ${batchRes.blocked || 0}\n• Failed: ${batchRes.failed || 0}`,
            { parse_mode: 'HTML' }
          );
        }

        // --- Catch-all Message Handler ---
        bot.on(['message'], async (ctx) => {
          const chatId = ctx.chat.id;
          const msg = ctx.message;
          const text = (msg.text || msg.caption || '').trim();
          const userId = ctx.from.id;

          if (text.startsWith('/')) return;

          // Admin Broadcast Content Draft Handler
          if (userStates[chatId]?.step === 'AWAITING_BROADCAST_CONTENT') {
            if (!isAdmin(userId, env)) {
              userStates[chatId].step = null;
              return ctx.reply('⛔ Admin command only.');
            }

            const payload = extractMessagePayload(msg);
            broadcastDrafts[chatId] = payload;
            userStates[chatId].step = 'AWAITING_BROADCAST_BUTTON';

            return sendCleanMessage(ctx,
              `🔗 <b>Add Inline URL Button to Broadcast (Optional)</b>\n\n` +
              `<b>Format:</b> <code>Button Text | https://your-link.com</code>\n\n` +
              `Send <code>/skip_button</code> or <code>skip</code> to broadcast without a button.`,
              { parse_mode: 'HTML' }
            );
          }

          // Admin Broadcast Button Input Handler
          if (userStates[chatId]?.step === 'AWAITING_BROADCAST_BUTTON') {
            if (!isAdmin(userId, env)) {
              userStates[chatId].step = null;
              return ctx.reply('⛔ Admin command only.');
            }

            userStates[chatId].step = null;
            const draft = broadcastDrafts[chatId] || {};

            const cleanText = text.trim();
            if (cleanText.toLowerCase() === 'skip' || cleanText.startsWith('/skip')) {
              draft.button = null;
            } else if (cleanText.includes('|')) {
              const parts = cleanText.split('|');
              const label = parts[0].trim();
              let url = parts.slice(1).join('|').trim();
              if (!url.startsWith('http://') && !url.startsWith('https://')) {
                url = 'https://' + url;
              }
              draft.button = { text: label, url };
            } else {
              draft.button = null;
            }

            draft.parse_mode = 'HTML';

            const btnPreview = draft.button ? `• <b>Inline Button:</b> <a href="${draft.button.url}">${escapeHtml(draft.button.text)}</a>` : `• <b>Inline Button:</b> None`;
            const contentPreview = draft.text || draft.caption || '(No text content)';

            const previewKeyboard = [];
            if (draft.button) {
              previewKeyboard.push([Markup.button.url(draft.button.text, draft.button.url)]);
            }
            previewKeyboard.push([
              Markup.button.callback('🚀 Start Broadcast', 'start_broadcast_confirm'),
              Markup.button.callback('❌ Cancel Draft', 'cancel_broadcast_draft')
            ]);

            return sendCleanMessage(ctx,
              `🔍 <b>Broadcast Message Preview:</b>\n\n` +
              `• <b>Type:</b> ${draft.type.toUpperCase()}\n` +
              `${btnPreview}\n\n` +
              `<b>Content:</b>\n` +
              `${markdownToTelegramHtml(contentPreview)}`,
              {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(previewKeyboard)
              }
            );
          }

          // Phone Number Input in Registration Flow
          const state = userStates[chatId];
          if (state && state.step === 'AWAITING_PHONE' && text) {
            return completeRegistrationAndUnlockDashboard(ctx, text);
          }

          // Fallback: polite guidance to main menu
          return sendCleanMessage(ctx, `👋 ሰላም! ከታች ካሉት አገልግሎቶች አንዱን ይምረጡ:`, {
            parse_mode: 'HTML',
            ...Markup.keyboard(i18n.am.menu).resize()
          });
        });

        const update = await request.json();
        await bot.handleUpdate(update);
        return new Response('OK', { status: 200 });
      } catch (err) {
        console.error('Update Error:', err);
        return new Response('OK', { status: 200 });
      }
    }

    return new Response('Smart X Ethiopian Telegram Bot Worker is Active. Path: /webhook', { status: 200 });
  }
};
