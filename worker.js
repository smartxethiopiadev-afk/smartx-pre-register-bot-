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

// Multi-language Translations & 5 Step Diagnostic Questions
const i18n = {
  am: {
    select_language: '🌐 <b>እባክዎን ቋንቋ ይምረጡ / Please select your language:</b>',
    select_grade: '🎓 <b>የትምህርት ክፍልህን ምረጥ:</b>',
    grades: [
      { text: '9ኛ ክፍል', id: '9' },
      { text: '10ኛ ክፍል', id: '10' },
      { text: '11ኛ ክፍል', id: '11' },
      { text: '12ኛ ክፍል', id: '12' }
    ],
    questions: [
      '📚 <b>ጥያቄ 1 ከ 5:</b>\n\nየሁሉንም ትምህርቶች አጫጭር ማጠቃለያዎች (Short Notes) ማግኘት ትፈልጋለህ?',
      '📝 <b>ጥያቄ 2 ከ 5:</b>\n\nየሞዴል ፈተናዎች እና የ Worksheet ጥያቄዎችን በየምዕራፉ መለማመድ ትፈልጋለህ?',
      '💡 <b>ጥያቄ 3 ከ 5:</b>\n\nአስቸጋሪ እና ውስብስብ የፈተና ጥያቄዎችን በቀላሉ ለመረዳት አጋዥ ትፈልጋለህ?',
      '📱 <b>ጥያቄ 4 ከ 5:</b>\n\nያለ ኢንተርኔት በ Offline የሚሰራ የጥናት መተግበሪያ መጠቀም ትፈልጋለህ?',
      '🎯 <b>ጥያቄ 5 ከ 5:</b>\n\nበዚህ አመት ከፍተኛ የትምህርት ውጤት (High Score) ለማምጣት ቆርጠሃል?'
    ],
    yes: '✅ አዎ',
    no: '❌ አይ',
    channel_step: (grade, channel) => `✅ ክፍል: <b>${escapeHtml(grade)}</b>\n\n📢 <b>ቴሌግራም ቻናል:</b>\nሁሉንም የትምህርት ቁሳቁሶች ለማግኘት <b>${escapeHtml(channel)}</b> ይቀላቀሉ:`,
    join_channel: '💬 ቻናሉን ተቀላቀል',
    verify_channel: '✅ አረጋግጥ',
    channel_joined_alert: '✅ ቻናል አባልነትዎ ተረጋግጧል!',
    channel_not_joined_alert: (channel) => `⚠️ እባክዎን መጀመሪያ ${channel} ይቀላቀሉ!`,
    phone_step: '📱 <b>የስልክ ቁጥር:</b>\n\nምዝገባውን ለማጠናቀቅ ከታች ያለውን አዝራር በመጫን ስልክ ቁጥርህን ላክ:',
    share_contact_btn: '📱 ስልክ ቁጥር አጋራ',
    notify_prompt: '🔔 <b>የሞባይል አፕሊኬሽን ማሳወቂያ:</b>\n\nየ Smart X Ethiopian ሞባይል አፕሊኬሽን በመስከረም 5 ሲለቀቅ ማሳወቂያ (Notification) እንዲደርስህ ትፈልጋለህ?',
    notify_yes: '🔔 አዎ፣ ይድረሰኝ',
    notify_no: '🔕 አይ፣ አልፈልግም',
    reg_success: (name) => `🎉 <b>እንኳን ደስ አለህ ${escapeHtml(name)}! ምዝገባህ ተጠናቋል!</b> 🚀\n\nShort Notes እና Worksheets እንደተለቀቁ ወዲያውኑ ይደርሱሃል።\n\nከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,
    welcome_back: (name) => `👋 <b>እንኳን በደህና ተመለሱ ${escapeHtml(name)}!</b> 🇪🇹\n\nከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,
    menu: [
      ['🔗 ለጓደኞች አጋራ', '⚙️ ቅንብሮች']
    ],
    share_title: '🔗 <b>ጓደኞችን ጋብዝ — Smart X Ethiopian</b> 🇪🇹',
    share_btn: '📲 ለጓደኞች አጋራ',
    settings_title: '⚙️ <b>ቅንብሮች</b>',
    change_lang_btn: '🌐 ቋንቋ ቀይር',
    change_grade_btn: '🎓 ክፍል ቀይር'
  },
  en: {
    select_language: '🌐 <b>Please select your language:</b>',
    select_grade: '🎓 <b>Please select your grade:</b>',
    grades: [
      { text: 'Grade 9', id: '9' },
      { text: 'Grade 10', id: '10' },
      { text: 'Grade 11', id: '11' },
      { text: 'Grade 12', id: '12' }
    ],
    questions: [
      '📚 <b>Question 1 of 5:</b>\n\nDo you want to access concise Chapter Short Notes for all subjects?',
      '📝 <b>Question 2 of 5:</b>\n\nDo you want to practice Model Exams and Worksheets chapter by chapter?',
      '💡 <b>Question 3 of 5:</b>\n\nDo you need help easily solving challenging and complex exam problems?',
      '📱 <b>Question 4 of 5:</b>\n\nDo you want to use an Offline study application without needing the internet?',
      '🎯 <b>Question 5 of 5:</b>\n\nAre you determined to achieve a High Score this academic year?'
    ],
    yes: '✅ Yes',
    no: '❌ No',
    channel_step: (grade, channel) => `✅ Grade: <b>${escapeHtml(grade)}</b>\n\n📢 <b>Telegram Channel:</b>\nJoin <b>${escapeHtml(channel)}</b> to receive all educational resources:`,
    join_channel: '💬 Join Channel',
    verify_channel: '✅ Verify',
    channel_joined_alert: '✅ Channel membership confirmed!',
    channel_not_joined_alert: (channel) => `⚠️ Please join ${channel} first!`,
    phone_step: '📱 <b>Phone Number:</b>\n\nClick the button below to share your phone number and complete registration:',
    share_contact_btn: '📱 Share Contact',
    notify_prompt: '🔔 <b>Mobile App Notification:</b>\n\nWould you like to receive a notification when the Smart X Ethiopian mobile app is released on Meskerem 5?',
    notify_yes: '🔔 Yes, Notify Me',
    notify_no: '🔕 No, Skip',
    reg_success: (name) => `🎉 <b>Congratulations ${escapeHtml(name)}! Registration Completed!</b> 🚀\n\nYou will receive Short Notes and Worksheets as soon as they are published.\n\nChoose an option below ⬇️`,
    welcome_back: (name) => `👋 <b>Welcome back ${escapeHtml(name)}!</b> 🇪🇹\n\nChoose an option below ⬇️`,
    menu: [
      ['🔗 Share with Friends', '⚙️ Settings']
    ],
    share_title: '🔗 <b>Invite Friends — Smart X Ethiopian</b> 🇪🇹',
    share_btn: '📲 Share Now',
    settings_title: '⚙️ <b>Settings</b>',
    change_lang_btn: '🌐 Change Language',
    change_grade_btn: '🎓 Change Grade'
  },
  om: {
    select_language: '🌐 <b>Afaan keessan filadhaa:</b>',
    select_grade: '🎓 <b>Kutaa barumsaa keessan filadhaa:</b>',
    grades: [
      { text: 'Kutaa 9', id: '9' },
      { text: 'Kutaa 10', id: '10' },
      { text: 'Kutaa 11', id: '11' },
      { text: 'Kutaa 12', id: '12' }
    ],
    questions: [
      '📚 <b>Gaaffii 1 / 5:</b>\n\nCuunfaa barumsaa (Short Notes) gosa barnoota hundaaf argachuu barbaaddaa?',
      '📝 <b>Gaaffii 2 / 5:</b>\n\nQorumsa moodeelaa fi gaaffilee Worksheet boqonnaa boqonnaan hojjechuu barbaaddaa?',
      '💡 <b>Gaaffii 3 / 5:</b>\n\nGaaffilee qorumsaa ciccimoo ta\'an salphaatti hubachuuf gargaarsa barbaaddaa?',
      '📱 <b>Gaaffii 4 / 5:</b>\n\nTajaajila barnootaa toora intarneetiin ala (Offline) hojjetu fayyadamuu barbaaddaa?',
      '🎯 <b>Gaaffii 5 / 5:</b>\n\nBarana qabxii olaanaa fiduuf qophiidhaa?'
    ],
    yes: '✅ Eeyyee',
    no: '❌ Lakki',
    channel_step: (grade, channel) => `✅ Kutaa: <b>${escapeHtml(grade)}</b>\n\n📢 <b>Chaanaalii Telegram:</b>\nQophiiwwan barnootaa hunda argachuuf <b>${escapeHtml(channel)}</b> seenaa:`,
    join_channel: '💬 Chaanaalii Seeni',
    verify_channel: '✅ Mirkaneessi',
    channel_joined_alert: '✅ Chaanaalii seenuun keessan mirkanaa\'eera!',
    channel_not_joined_alert: (channel) => `⚠️ Mee dura ${channel} seenaa!`,
    phone_step: '📱 <b>Lakkoofsa Bilbilaa:</b>\n\nGalmee xumuruuf lakkoofsa bilbila keessanii ergaa:',
    share_contact_btn: '📱 Lakkoofsa Bilbilaa Ergi',
    notify_prompt: '🔔 <b>Beeksisa Appilikeeshinii:</b>\n\nAppilikeeshiniin Smart X Ethiopian yeroo gadhiifamu beeksisni akka isin ga\'u barbaadduu?',
    notify_yes: '🔔 Eeyyee, Na Ga\'i',
    notify_no: '🔕 Lakki, Hin Barbaadu',
    reg_success: (name) => `🎉 <b>Baga gammaddan ${escapeHtml(name)}! Galmeen keessan xumurameera!</b> 🚀\n\nCuunfaan barumsaa fi Worksheet qophaa\'ee yeroo dhiyootti isin ga\'a.\n\nTajaajiloota armaan gadii filadhaa ⬇️`,
    welcome_back: (name) => `👋 <b>Baga nagaan deebitan ${escapeHtml(name)}!</b> 🇪🇹\n\nTajaajiloota armaan gadii filadhaa ⬇️`,
    menu: [
      ['🔗 Hiriyyootaaf Qoodi', '⚙️ Qindaa\'inoota']
    ],
    share_title: '🔗 <b>Hiriyyoota Waami — Smart X Ethiopian</b> 🇪🇹',
    share_btn: '📲 Amma Qoodi',
    settings_title: '⚙️ <b>Qindaa\'inoota</b>',
    change_lang_btn: '🌐 Afaan Jijjiiri',
    change_grade_btn: '🎓 Kutaa Jijjiiri'
  }
};

// Helper: Get user's saved or session language
async function getUserLang(userId, env) {
  if (userStates[userId]?.lang) return userStates[userId].lang;
  if (env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT language FROM users WHERE telegram_id = ?').bind(userId).first();
      if (row?.language && i18n[row.language]) return row.language;
    } catch (e) {}
  }
  return 'am';
}

// Helper: Check if user is a member of the discussion group/channel
async function checkChannelMember(ctx, userId, env) {
  const channelHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
  try {
    const member = await ctx.telegram.getChatMember(channelHandle, userId);
    if (['creator', 'administrator', 'member'].includes(member.status)) {
      return true;
    }
  } catch (err) {
    console.warn('[Channel Member Check Warning]:', err.message);
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
• 🔴 <b>ቦት ያቆሙ:</b> <code>${blockedCount}</code>
• 🔗 <b>ጠቅላላ የጥቆማ ግብዣዎች:</b> <code>${totalReferrals}</code>

🎓 <b>የክፍል ክፍፍል:</b>
• 9ኛ ክፍል: <code>${gradeBreakdown['9ኛ ክፍል'] || gradeBreakdown['Grade 9'] || 0}</code>
• 10ኛ ክፍል: <code>${gradeBreakdown['10ኛ ክፍል'] || gradeBreakdown['Grade 10'] || 0}</code>
• 11ኛ ክፍል: <code>${gradeBreakdown['11ኛ ክፍል'] || gradeBreakdown['Grade 11'] || 0}</code>
• 12ኛ ክፍል: <code>${gradeBreakdown['12ኛ ክፍል'] || gradeBreakdown['Grade 12'] || 0}</code>
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
        q_answers TEXT,
        app_notification INTEGER DEFAULT 1,
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

    // Seed default system configs
    const sysItems = [
      ['bot_version', 'v4.2-clean'],
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

          // Case A: User is ALREADY REGISTERED -> Show Welcome Back & Menu
          if (existingUser && existingUser.phone && existingUser.phone !== 'N/A' && existingUser.phone !== 'Pending') {
            const lang = existingUser.language || 'am';
            const langObj = i18n[lang] || i18n.am;
            const name = existingUser.full_name || userName;
            const welcomeBackMsg = langObj.welcome_back(name);
            const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

            return sendCleanMessage(ctx, welcomeBackMsg, {
              parse_mode: 'HTML',
              ...mainDashboardKeyboard
            });
          }

          // Case B: User is NOT YET REGISTERED -> Step 1: Language Selection
          userStates[chatId] = {
            step: 'AWAITING_LANGUAGE',
            data: {
              fullName: userName,
              telegramId: userId,
              referredBy: referredBy,
              qAnswers: []
            }
          };

          const langKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
              Markup.button.callback('🇬🇧 English', 'set_lang_en')
            ],
            [
              Markup.button.callback('🔴 Afaan Oromoo', 'set_lang_om')
            ]
          ]);

          return sendCleanMessage(ctx, i18n.am.select_language, {
            parse_mode: 'HTML',
            ...langKeyboard
          });
        };

        bot.start(handleStartOrRegister);
        bot.command(['register', 'onboarding', 'signup'], handleStartOrRegister);

        // --- Step 1 Action: Language Selected -> Step 2: Grade Selection ---
        bot.action(['set_lang_am', 'set_lang_en', 'set_lang_om'], async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const lang = ctx.callbackQuery.data.replace('set_lang_', '');
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_GRADE', data: { telegramId: userId, fullName: ctx.from?.first_name || 'ተማሪ' } };
          }
          userStates[chatId].lang = lang;
          userStates[chatId].step = 'AWAITING_GRADE';
          userStates[chatId].data.qAnswers = [];

          const langObj = i18n[lang] || i18n.am;

          const gradeButtons = langObj.grades.map(g => Markup.button.callback(g.text, `set_grade_${g.id}`));
          const gradeKeyboard = Markup.inlineKeyboard([
            [gradeButtons[0], gradeButtons[1]],
            [gradeButtons[2], gradeButtons[3]]
          ]);

          return sendCleanMessage(ctx, langObj.select_grade, {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        // --- Step 2 Action: Grade Selected -> Step 3: Question 1 of 5 ---
        bot.action(/set_grade_(\d+)/, async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const gradeNum = ctx.match[1];
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          const selectedGradeObj = langObj.grades.find(g => g.id === gradeNum) || { text: `${gradeNum}ኛ ክፍል` };
          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_Q1', data: {} };
          }
          userStates[chatId].data.grade = selectedGradeObj.text;
          userStates[chatId].data.qAnswers = [];
          userStates[chatId].step = 'AWAITING_Q1';

          const q1Text = langObj.questions[0];
          const q1Keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(langObj.yes, 'answer_q_1_yes'),
              Markup.button.callback(langObj.no, 'answer_q_1_no')
            ]
          ]);

          return sendCleanMessage(ctx, q1Text, {
            parse_mode: 'HTML',
            ...q1Keyboard
          });
        });

        // --- Helper for 5 Sequential Diagnostic Questions ---
        for (let qIndex = 1; qIndex <= 5; qIndex++) {
          bot.action([`answer_q_${qIndex}_yes`, `answer_q_${qIndex}_no`], async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const chatId = ctx.chat.id;
            const userId = ctx.from.id;
            const lang = userStates[chatId]?.lang || 'am';
            const langObj = i18n[lang] || i18n.am;
            const isYes = ctx.callbackQuery.data.endsWith('_yes');

            if (!userStates[chatId]) {
              userStates[chatId] = { step: `AWAITING_Q${qIndex}`, data: { qAnswers: [] } };
            }
            if (!userStates[chatId].data.qAnswers) {
              userStates[chatId].data.qAnswers = [];
            }
            userStates[chatId].data.qAnswers.push(isYes ? 'Yes' : 'No');

            // If more questions remain (Q1 -> Q2, Q2 -> Q3, Q3 -> Q4, Q4 -> Q5)
            if (qIndex < 5) {
              const nextQ = qIndex + 1;
              userStates[chatId].step = `AWAITING_Q${nextQ}`;
              const nextQText = langObj.questions[qIndex];
              const nextQKeyboard = Markup.inlineKeyboard([
                [
                  Markup.button.callback(langObj.yes, `answer_q_${nextQ}_yes`),
                  Markup.button.callback(langObj.no, `answer_q_${nextQ}_no`)
                ]
              ]);

              return sendCleanMessage(ctx, nextQText, {
                parse_mode: 'HTML',
                ...nextQKeyboard
              });
            }

            // All 5 Questions Completed -> Step 4: Telegram Channel / Group Verification
            userStates[chatId].step = 'AWAITING_CHANNEL_VERIFY';
            const channelHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
            const grade = userStates[chatId].data.grade || '10ኛ ክፍል';

            const isMember = await checkChannelMember(ctx, userId, env);
            if (isMember) {
              userStates[chatId].step = 'AWAITING_PHONE';
              const phoneKeyboard = Markup.keyboard([
                [Markup.button.contactRequest(langObj.share_contact_btn)]
              ]).resize().oneTime();

              return sendCleanMessage(ctx, langObj.phone_step, {
                parse_mode: 'HTML',
                ...phoneKeyboard
              });
            }

            const channelUrl = `https://t.me/${channelHandle.replace('@', '')}`;
            const verifyKeyboard = Markup.inlineKeyboard([
              [Markup.button.url(langObj.join_channel, channelUrl)],
              [Markup.button.callback(langObj.verify_channel, 'verify_channel_step')]
            ]);

            return sendCleanMessage(ctx, langObj.channel_step(grade, channelHandle), {
              parse_mode: 'HTML',
              ...verifyKeyboard
            });
          });
        }

        // --- Step 4 Action: Discussion Group Verification Callback ---
        bot.action('verify_channel_step', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;
          const channelHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          const isMember = await checkChannelMember(ctx, userId, env);

          if (!isMember) {
            return ctx.answerCbQuery(langObj.channel_not_joined_alert(channelHandle), { show_alert: true }).catch(() => {});
          }

          await ctx.answerCbQuery(langObj.channel_joined_alert).catch(() => {});

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_PHONE', data: { grade: '10ኛ ክፍል' } };
          }
          userStates[chatId].step = 'AWAITING_PHONE';

          const phoneKeyboard = Markup.keyboard([
            [Markup.button.contactRequest(langObj.share_contact_btn)]
          ]).resize().oneTime();

          return sendCleanMessage(ctx, langObj.phone_step, {
            parse_mode: 'HTML',
            ...phoneKeyboard
          });
        });

        // --- Step 5 Action: Phone Number Received -> Step 6: App Notification Prompt ---
        const handlePhoneSubmission = async (ctx, phone) => {
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          if (!userStates[chatId]) {
            userStates[chatId] = { data: {} };
          }
          userStates[chatId].data.phone = phone || 'N/A';
          userStates[chatId].step = 'AWAITING_NOTIFICATION_OPTIN';

          const notifyKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(langObj.notify_yes, 'notify_optin_yes'),
              Markup.button.callback(langObj.notify_no, 'notify_optin_no')
            ]
          ]);

          return sendCleanMessage(ctx, langObj.notify_prompt, {
            parse_mode: 'HTML',
            ...notifyKeyboard
          });
        };

        bot.on('contact', async (ctx) => {
          const phone = ctx.message.contact?.phone_number || '';
          return handlePhoneSubmission(ctx, phone);
        });

        // --- Step 6 Action: Notification Opt-in Response -> Save to D1 & Finish ---
        bot.action(['notify_optin_yes', 'notify_optin_no'], async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const wantsNotify = ctx.callbackQuery.data === 'notify_optin_yes' ? 1 : 0;
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const stateData = userStates[chatId]?.data || {};
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          const fullName = stateData.fullName || ctx.from?.first_name || 'ተማሪ';
          const grade = stateData.grade || '10ኛ ክፍል';
          const phone = stateData.phone || 'N/A';
          const referredBy = stateData.referredBy || null;
          const qAnswersJson = JSON.stringify(stateData.qAnswers || []);

          if (env.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO users (telegram_id, full_name, phone, grade, stream, language, referred_by, q_answers, app_notification, is_channel_member, is_active, registered_at)
                VALUES (?, ?, ?, ?, 'General', ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(telegram_id) DO UPDATE SET
                  full_name = excluded.full_name,
                  phone = excluded.phone,
                  grade = excluded.grade,
                  language = excluded.language,
                  q_answers = excluded.q_answers,
                  app_notification = excluded.app_notification,
                  is_channel_member = 1,
                  is_active = 1,
                  registered_at = CURRENT_TIMESTAMP
              `).bind(userId, fullName, phone, grade, lang, referredBy, qAnswersJson, wantsNotify).run();

              // Credit referrer
              if (referredBy && referredBy !== userId) {
                await env.DB.prepare(`
                  UPDATE users 
                  SET referral_count = COALESCE(referral_count, 0) + 1,
                      points = COALESCE(points, 0) + 10,
                      updated_at = CURRENT_TIMESTAMP
                  WHERE telegram_id = ?
                `).bind(referredBy).run();

                try {
                  const refRow = await env.DB.prepare('SELECT referral_count, points FROM users WHERE telegram_id = ?').bind(referredBy).first();
                  const updatedCount = refRow?.referral_count || 1;
                  const updatedPoints = refRow?.points || 10;

                  const refMsg = `🎉 <b>አዲስ ተማሪ በጥቆማዎ ተመዝግቧል!</b>\n\n• 👤 <b>ተማሪ:</b> ${escapeHtml(fullName)}\n• 🎁 <b>ነጥብ:</b> <code>+10</code> (ጠቅላላ: ${updatedPoints} pts / ${updatedCount} ተማሪዎች)`;
                  await bot.telegram.sendMessage(referredBy, refMsg, { parse_mode: 'HTML' });
                } catch (e) {}
              }
            } catch (err) {
              console.error('D1 Save User Error:', err);
            }
          }

          registeredUsers[userId] = {
            telegram_id: userId,
            full_name: fullName,
            phone,
            grade,
            language: lang,
            referred_by: referredBy,
            referral_count: 0,
            points: 0,
            is_active: 1,
            registered_at: new Date().toISOString()
          };

          if (userStates[chatId]) userStates[chatId].step = null;

          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return sendCleanMessage(ctx, langObj.reg_success(fullName), {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
        });

        // --- DASHBOARD BUTTON 1: 🔗 Share / Invite Friends ---
        const handleShareInvite = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
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

          const shareText =
`${langObj.share_title}

• <b>የተጋበዙ:</b> <code>${refCount}</code> ሰዎች
• <b>ያገኙት ነጥብ:</b> <code>${points}</code> ነጥብ

🎁 <b>የመጋበዣ ሊንክ:</b>
<code>${shareLink}</code>

ከታች ያለውን አዝራር በመጫን ለጓደኞችህ ወይም በግሩፖች አጋራ!`;

          const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.switchToChat(langObj.share_btn, '')]
          ]);

          return sendCleanMessage(ctx, shareText, {
            parse_mode: 'HTML',
            ...shareKeyboard
          });
        };

        bot.hears([
          '🔗 ለጓደኞች አጋራ',
          '🔗 Share with Friends',
          '🔗 Hiriyyootaaf Qoodi',
          'Share',
          'Invite'
        ], handleShareInvite);
        bot.command(['share', 'invite'], handleShareInvite);

        // --- DASHBOARD BUTTON 2: ⚙️ Settings (Language & Grade) ---
        const handleSettings = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          const settingsKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(langObj.change_lang_btn, 'settings_change_lang')],
            [Markup.button.callback(langObj.change_grade_btn, 'settings_change_grade')]
          ]);

          return sendCleanMessage(ctx, langObj.settings_title, {
            parse_mode: 'HTML',
            ...settingsKeyboard
          });
        };

        bot.hears([
          '⚙️ ቅንብሮች',
          '⚙️ Settings',
          '⚙️ Qindaa\'inoota',
          'Settings'
        ], handleSettings);
        bot.command(['settings'], handleSettings);

        bot.action('settings_change_lang', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const langKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🇪🇹 አማርኛ', 'update_lang_am'),
              Markup.button.callback('🇬🇧 English', 'update_lang_en')
            ],
            [
              Markup.button.callback('🔴 Afaan Oromoo', 'update_lang_om')
            ]
          ]);

          return sendCleanMessage(ctx, i18n.am.select_language, {
            parse_mode: 'HTML',
            ...langKeyboard
          });
        });

        bot.action(['update_lang_am', 'update_lang_en', 'update_lang_om'], async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const newLang = ctx.callbackQuery.data.replace('update_lang_', '');
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;

          if (userStates[chatId]) userStates[chatId].lang = newLang;
          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET language = ? WHERE telegram_id = ?').bind(newLang, userId).run();
            } catch (e) {}
          }

          const langObj = i18n[newLang] || i18n.am;
          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return sendCleanMessage(ctx, langObj.welcome_back(ctx.from?.first_name || 'ተማሪ'), {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
        });

        bot.action('settings_change_grade', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          const gradeButtons = langObj.grades.map(g => Markup.button.callback(g.text, `update_grade_${g.id}`));
          const gradeKeyboard = Markup.inlineKeyboard([
            [gradeButtons[0], gradeButtons[1]],
            [gradeButtons[2], gradeButtons[3]]
          ]);

          return sendCleanMessage(ctx, langObj.select_grade, {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        bot.action(/update_grade_(\d+)/, async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const gradeNum = ctx.match[1];
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          const gradeText = `${gradeNum}ኛ ክፍል`;

          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET grade = ? WHERE telegram_id = ?').bind(gradeText, userId).run();
            } catch (e) {}
          }

          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();
          return sendCleanMessage(ctx, `✅ ክፍል ተቀይሯል: <b>${gradeText}</b>`, {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
        });

        // --- ACTION HANDLER: User clicks '✨ አዎ! እንፈልጋለን' Button in Group ---
        bot.action(/want_notes_ref_(\d+)/, async (ctx) => {
          const refUserId = ctx.match[1];
          const botUsername = getBotUsername(ctx, env);
          const deepLink = `https://t.me/${botUsername}?start=ref_${refUserId}`;

          try {
            await ctx.answerCbQuery(
              `💡 የ 9-12ኛ ክፍል Short Notes እና Worksheets ለማግኘት ቦቱን Start ይበሉ!`,
              {
                show_alert: true,
                url: deepLink
              }
            );
          } catch (err) {
            await ctx.answerCbQuery(
              `💡 የ 9-12ኛ ክፍል Short Notes እና Worksheets ለማግኘት @${botUsername} ን Start ይበሉ!`,
              { show_alert: true }
            ).catch(() => {});
          }
        });

        // --- INLINE QUERY HANDLER (NO USERNAME TEXT IN BODY + CUSTOM MESSAGE SUPPORT + MOTIVATIONAL BUTTON) ---
        bot.on('inline_query', async (ctx) => {
          const userId = ctx.from?.id || 0;
          const botUsername = getBotUsername(ctx, env);
          const customQuery = (ctx.inlineQuery?.query || '').trim();

          // If the user typed a custom message in inline mode, use it; otherwise use the default high-converting question
          let promoText = '';
          if (customQuery.length > 0) {
            promoText = escapeHtml(customQuery);
          } else {
            promoText =
`✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?

የሁሉንም ትምህርቶች ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!`;
          }

          // Normal Telegram Callback Button (No Link Arrow)
          const normalCallbackMarkup = {
            inline_keyboard: [
              [
                { text: '✨ አዎ! እንፈልጋለን', callback_data: `want_notes_ref_${userId}` }
              ]
            ]
          };

          const results = [
            {
              type: 'article',
              id: `smartx_promo_${userId}_${Date.now()}`,
              title: customQuery.length > 0 ? `✉️ Custom: "${customQuery.slice(0, 30)}..."` : '📚 Short Note & Worksheet — አዎ! እንፈልጋለን',
              description: 'ለ 9-12ኛ ክፍል ተማሪዎች የሚጋበዝ አነቃቂ መልዕክት',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
              input_message_content: {
                message_text: promoText,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              },
              reply_markup: normalCallbackMarkup
            }
          ];

          try {
            return await ctx.answerInlineQuery(results, {
              cache_time: 1,
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
              const rowsRes = await env.DB.prepare('SELECT telegram_id, full_name, phone, grade, language, referral_count, points, registered_at FROM users ORDER BY registered_at DESC LIMIT 10').all();
              userRows = rowsRes?.results || [];
            } catch (e) {
              console.error('Fetch users error:', e);
            }
          }

          let listText = userRows.map((u, i) => 
            `${i + 1}. <b>${escapeHtml(u.full_name)}</b> (<code>#${u.telegram_id}</code>)\n   • 🎓 ${escapeHtml(u.grade)} | 📱 <code>${escapeHtml(u.phone)}</code> | 🌐 ${u.language} | 🔗 ${u.referral_count || 0} refs`
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
            return handlePhoneSubmission(ctx, text);
          }

          // Fallback: polite guidance to main menu
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          return sendCleanMessage(ctx, `👋 ሰላም! ከታች ካሉት አገልግሎቶች አንዱን ይምረጡ:`, {
            parse_mode: 'HTML',
            ...Markup.keyboard(langObj.menu).resize()
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
