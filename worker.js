import { Telegraf, Markup } from 'telegraf';
import { GoogleGenAI } from '@google/genai';

// --- STRICT GEMINI MODEL FALLBACK ARRAY ---
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash'
];

// In-memory caches for fast session tracking and fallback state
const userStates = {};
const registeredUsers = {};
const userLanguages = {};
const broadcastDrafts = {};
const activeQuizzes = {};
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
 * Transforms standard Markdown syntax to Telegram-compatible HTML tags:
 * <b>, <i>, <code>, <pre>, <a>, <u>, <s>, <tg-spoiler>
 */
function markdownToTelegramHtml(markdown) {
  if (!markdown) return '';
  let text = String(markdown);

  // Preserve pre/code blocks by temporarily replacing with tokens
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

  // Convert Markdown headers (### Header -> <b>Header</b>)
  text = text.replace(/^#{1,6}\s+(.+)$/gm, '<b>$1</b>');

  // Convert Markdown bold (**bold** or __bold__)
  text = text.replace(/\*\*(.*?)\*\*/g, '<b>$1</b>');
  text = text.replace(/__(.*?)__/g, '<b>$1</b>');

  // Convert Markdown italic (*italic* or _italic_)
  text = text.replace(/\*(.*?)\*/g, '<i>$1</i>');
  text = text.replace(/(^|\s)_(.*?)_($|\s)/g, '$1<i>$2</i>$3');

  // Convert Markdown strikethrough (~~text~~)
  text = text.replace(/~~(.*?)~~/g, '<s>$1</s>');

  // Convert Markdown links [text](url)
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2">$1</a>');

  // Convert bullet list markers (* or - item -> • item)
  text = text.replace(/^\s*[\*\-]\s+/gm, '• ');

  // Restore inline codes and code blocks
  inlineCodes.forEach((codeHtml, idx) => {
    text = text.replace(`__INLINE_CODE_${idx}__`, codeHtml);
  });

  codeBlocks.forEach((blockHtml, idx) => {
    text = text.replace(`__CODE_BLOCK_${idx}__`, blockHtml);
  });

  return text.trim();
}

// Helper: Extract all available Gemini API keys from environment
function getGeminiApiKeys(env) {
  const keysEnv = env?.GEMINI_API_KEYS || process.env.GEMINI_API_KEYS || '';
  let keys = [];

  if (keysEnv) {
    if (keysEnv.trim().startsWith('[')) {
      try {
        keys = JSON.parse(keysEnv);
      } catch (e) {
        keys = keysEnv.split(',').map(k => k.trim());
      }
    } else {
      keys = keysEnv.split(',').map(k => k.trim());
    }
  }

  const singleKey = env?.GEMINI_API_KEY || process.env.GEMINI_API_KEY;
  if (singleKey && !keys.includes(singleKey)) {
    keys.unshift(singleKey);
  }

  return keys.filter(k => k && k.length > 5);
}

/**
 * Multi-Key & Multi-Model Fallback Execution Engine
 * Retries across all available API keys and models in GEMINI_MODELS order
 * on 429 rate limit, quota depletion, or service errors.
 */
async function generateWithGeminiFallback(params, env) {
  const keys = getGeminiApiKeys(env);
  if (keys.length === 0) {
    throw new Error('No valid Gemini API key found in GEMINI_API_KEYS or GEMINI_API_KEY.');
  }

  let lastError = null;

  for (const model of GEMINI_MODELS) {
    for (const apiKey of keys) {
      try {
        const ai = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: {
            headers: {
              'User-Agent': 'aistudio-build'
            }
          }
        });

        const result = await ai.models.generateContent({
          ...params,
          model: model
        });

        if (result && result.text) {
          return {
            text: result.text,
            modelUsed: model,
            keyUsed: apiKey.slice(0, 6) + '...'
          };
        }
      } catch (err) {
        console.warn(`[Gemini Fallback Retry] Model '${model}' with key '${apiKey.slice(0, 6)}...' error: ${err.message}`);
        lastError = err;
      }
    }
  }

  throw lastError || new Error('All Gemini API keys and models failed.');
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

// Multi-language Translations Dictionary (Clean HTML Parse Mode & Concise Text)
const i18n = {
  am: {
    diagnostic_question: (name) => `👋 <b>ሰላም ${escapeHtml(name)}!</b> 🇪🇹
እንኳን ወደ <b>Smart X Ethiopian</b> በደህና መጡ!

🎯 <b>አጭር ጥያቄ:</b>
በትምህርትህ ወቅት የከበደህን ትምህርት ለመረዳት፣ ማጠቃለያ (Short Notes) ለማግኘት ወይም ለፈተና ለመዘጋጀት ተቸግረህ/ሽ ታውቃለህ/ሽ?`,

    welcome_start: (name) => `👋 <b>ሰላም ${escapeHtml(name)}!</b>

እንኳን ወደ <b>Smart X Ethiopian</b> በደህና መጡ! 🇪🇹
<i>የ 9ኛ - 12ኛ ክፍል የ AI የትምህርት ረዳት እና የፈተና መድረክ።</i>

👇 <b>እባክዎን የትምህርት ክፍልዎን ይምረጡ:</b>`,

    welcome_back: (name, phone, grade, refCount = 0, points = 0, group = '@SmartX_Discussion') => `👋 <b>እንኳን በደህና ተመለሱ ${escapeHtml(name)}!</b> 🇪🇹

• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b> | <b>ስልክ:</b> <code>${escapeHtml(phone)}</code>
• <b>ሁኔታ:</b> 💎 <b>VIP Early Access (100% Free)</b>
• <b>የተጋበዙ:</b> <code>${refCount}</code> ተማሪዎች (${points} pts)

ከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,

    channel_verify_step: (grade, group = '@SmartX_Discussion') => `✅ ክፍል: <b>${escapeHtml(grade)}</b>

📢 <b>የውይይት ግሩፕ ማረጋገጫ:</b>
አፑን 100% በነፃ ለመጠቀም እባክዎን <b>${escapeHtml(group)}</b> ይቀላቀሉ፣ ከዚያ <b>«✅ አረጋግጥ»</b> የሚለውን ይጫኑ።`,

    phone_request_step: `✅ የውይይት ግሩፕ ተረጋግጧል!

📱 <b>የስልክ ቁጥር ማረጋገጫ:</b>
ምዝገባዎን ለማጠናቀቅ ከታች ያለውን በተን ተጭነው ስልክ ቁጥርዎን ያጋሩ ወይም ይፃፉልን:`,

    reg_success: (name, phone, grade, group = '@SmartX_Discussion') => `🎉 <b>ምዝገባዎ በስኬት ተጠናቋል!</b> 🚀

• <b>ስም:</b> ${escapeHtml(name)}
• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b>
• <b>ሁኔታ:</b> 💎 <b>100% Free VIP Access</b>

ከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,

    menu: [
      ['🤖 Smart X AI Assistant', '📲 Download App'],
      ['🔗 Share & Invite Friends', '👤 My Profile']
    ],

    app_hub_text: `📱 <b>Smart X Ethiopian አፕሊኬሽን ገና አልተለቀቀም!</b>

👉 አፑ በቅርብ ቀን (መስከረም 5) ሲለቀቅ የቀጥታ ማውረጃ ሊንኩና የ .apk ፋይሉ በዚህ ቦት ይላክልዎታል። እባክዎን በትዕግስት ይጠብቁን! 🚀`,

    ai_intro: `🤖 <b>Smart X AI Assistant</b> 💡\n\nስለ 9ኛ - 12ኛ ክፍል ትምህርቶች ማንኛውንም ጥያቄ መጠየቅ ይችላሉ!\n\n<i>ጥያቄዎን ከታች ይፃፉ ወይም ወደ ዋናው ማውጫ ለመመለስ «🔙 ወደ ዋናው ማውጫ (Main Menu)» የሚለውን ይጫኑ።</i>`
  },

  om: {
    welcome_start: (name) => `👋 <b>Akkam ${escapeHtml(name)}!</b>

Baga gara <b>Smart X Ethiopian</b> nagaan dhuftan! 🇪🇹
<i>Gargaaraa AI fi Kutaalee 9-12 Itoophiyaa.</i>

👇 <b>Kutaa Barnootaa Filadhaa:</b>`,

    welcome_back: (name, phone, grade, refCount = 0, points = 0, group = '@SmartX_Discussion') => `👋 <b>Baga nagaan deebitan ${escapeHtml(name)}!</b> 🇪🇹

• <b>Kutaa:</b> <b>${escapeHtml(grade)}</b> | <b>Bilbila:</b> <code>${escapeHtml(phone)}</code>
• <b>Sadarkaa:</b> 💎 <b>VIP Access (100% Bilisa)</b>
• <b>Affeeraman:</b> <code>${refCount}</code> (${points} pts)

Tajaajila barbaaddan filadhaa ⬇️`,

    channel_verify_step: (grade, group = '@SmartX_Discussion') => `✅ Kutaa: <b>${escapeHtml(grade)}</b>

📢 <b>Garee Marii:</b>
Appii kana 100% bilisaan argachuuf <b>${escapeHtml(group)}</b> makamaa, sana booda <b>«✅ Mirkaneessi»</b> cuqqasaa.`,

    phone_request_step: `✅ Gareen marii mirkanaa'eera!

📱 <b>Lakk. Bilbilaa:</b>
Galmee xumuruuf lakk. bilbilaa keessan nuuf ergaa:`,

    reg_success: (name, phone, grade, group = '@SmartX_Discussion') => `🎉 <b>Galmeen keessan xumurameera!</b> 🚀

• <b>Maqaa:</b> ${escapeHtml(name)}
• <b>Kutaa:</b> <b>${escapeHtml(grade)}</b>
• <b>Sadarkaa:</b> 💎 <b>100% Bilisa (VIP Access)</b>

Tajaajila filadhaa ⬇️`,

    menu: [
      ['🤖 Smart X AI Assistant', '📲 Download App'],
      ['🔗 Share & Invite Friends', '👤 My Profile']
    ],

    app_hub_text: `📱 <b>Appilikeeshiniin Smart X Ethiopian ammayyuu hin gadhiifamne!</b>

👉 Appiin kun dhihootti (Fulbaana 5) yeroo gadhiifamu liankiin buufataa kallattii fi faayiliin .apk botii kanaan isiniif ergama. Maaloo obsaan nu eegaa! 🚀`,

    ai_intro: `🤖 <b>Smart X AI Assistant</b> 💡\n\nGaaffii barnootaa kutaalee 9-12 kamiyyuu na gaafachuu dandeessu! ⬇️`
  },

  en: {
    welcome_start: (name) => `👋 <b>Hello ${escapeHtml(name)}!</b>

Welcome to <b>Smart X Ethiopian</b>! 🇪🇹
<i>AI Study Assistant & Practice Platform for Grades 9-12.</i>

👇 <b>Select your Grade level:</b>`,

    welcome_back: (name, phone, grade, refCount = 0, points = 0, group = '@SmartX_Discussion') => `👋 <b>Welcome Back, ${escapeHtml(name)}!</b> 🇪🇹

• <b>Grade:</b> <b>${escapeHtml(grade)}</b> | <b>Phone:</b> <code>${escapeHtml(phone)}</code>
• <b>Status:</b> 💎 <b>100% Free VIP Access</b>
• <b>Referrals:</b> <code>${refCount}</code> (${points} pts)

Choose an option below ⬇️`,

    channel_verify_step: (grade, group = '@SmartX_Discussion') => `✅ Grade: <b>${escapeHtml(grade)}</b>

📢 <b>Discussion Group:</b>
Join <b>${escapeHtml(group)}</b> for 100% FREE access, then click <b>«✅ Verify»</b>.`,

    phone_request_step: `✅ Discussion group verified!

📱 <b>Phone Verification:</b>
Please share or enter your phone number to complete registration:`,

    reg_success: (name, phone, grade, group = '@SmartX_Discussion') => `🎉 <b>Registration Completed!</b> 🚀

• <b>Name:</b> ${escapeHtml(name)}
• <b>Grade:</b> <b>${escapeHtml(grade)}</b>
• <b>Status:</b> 💎 <b>100% Free VIP Pre-Registered</b>

Select a service below ⬇️`,

    menu: [
      ['🤖 Smart X AI Assistant', '📲 Download App'],
      ['🔗 Share & Invite Friends', '👤 My Profile']
    ],

    app_hub_text: `📱 <b>Smart X Ethiopian App is not released yet!</b>

👉 When the app is launched soon (September / Meskerem 5), the direct download link and .apk file will be sent directly in this bot. Please stay tuned! 🚀`,

    ai_intro: `🤖 <b>Smart X AI Assistant</b> 💡\n\nAsk me any Grade 9-12 curriculum question! ⬇️`
  }
};

// Helper: Get user's preferred language ('am', 'om', 'en')
async function getUserLanguage(userId, env) {
  if (userLanguages[userId]) return userLanguages[userId];

  if (env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT language FROM users WHERE telegram_id = ?').bind(userId).first();
      if (row?.language && ['am', 'om', 'en'].includes(row.language)) {
        userLanguages[userId] = row.language;
        return row.language;
      }
    } catch (err) {
      console.log('Language fetch error:', err.message);
    }
  }

  return 'am';
}

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

// Helper: Prompt student to join discussion group before using AI Assistant
async function requireDiscussionGroupJoin(ctx, lang, env) {
  const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
  const groupUrl = `https://t.me/${groupHandle.replace('@', '')}`;

  const msgText = lang === 'om'
    ? `📢 <b>Gargaaraa AI wajjin haasa'uuf maaloo Garee Marii Smart X (${escapeHtml(groupHandle)}) makamaa!</b>\n\nGaaffii AI Assistant gaafachuu keessan dura maaloo garee marii keenyaa (<b>${escapeHtml(groupHandle)}</b>) makamaa.`
    : lang === 'en'
    ? `📢 <b>Please join the Smart X Discussion Group (${escapeHtml(groupHandle)}) before asking questions to the AI Assistant!</b>\n\nJoin our official discussion community to unlock unlimited AI Q&A and Grade 9-12 curriculum support.`
    : `📢 <b>ከ AI Assistant ጋር ለመወያየት እባክዎን የ Smart X Discussion Group (${escapeHtml(groupHandle)}) ይቀላቀሉ!</b>\n\nለጥያቄዎችዎ መልስ ከማግኘትዎ በፊት እባክዎን የውይይት ግሩፓችንን (<b>${escapeHtml(groupHandle)}</b>) ይቀላቀሉ።`;

  return sendCleanMessage(ctx, msgText, {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [Markup.button.url(`💬 Join Discussion Group (${groupHandle})`, groupUrl)],
      [Markup.button.callback('✅ Verify Discussion Membership / አባልነት አረጋግጥ', 'verify_discussion_membership')]
    ])
  });
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

// Helper: Check if error indicates user blocked the bot
function isBlockedError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('blocked') ||
    msg.includes('403') ||
    msg.includes('user is deactivated') ||
    msg.includes('chat not found')
  );
}

// System Prompt for Smart X AI Tutor (Grade 9-12 Ethiopian secondary school students)
const DEFAULT_AI_SYSTEM_PROMPT = `You are Smart X AI, an expert tutor designed for Ethiopian secondary school students (Grades 9-12).

CRITICAL INSTRUCTIONS & BEHAVIOR:
1. Core Role: Answer academic questions according to the new Ethiopian curriculum (Grades 9, 10, 11, 12).
2. App Launch & Pre-Registration Info:
   - App Name: Smart X Ethiopian (Smart X ET)
   - Official Launch Date: መስከረም 5 / 2019 ዓ.ም (September 2026)
   - Cost: 100% FREE for all early registered students.
   - Core Features: Chapter Summaries, Worksheets, Model Exams, Smart Quizzes, and AI Academic Assistance.
3. Language & Tone:
   - Primary Language: Amharic (አማርኛ). Use English for complex scientific terms when necessary.
   - Tone: Encouraging, concise, structured, and clear.
4. Database/Admin Directives:
   - Do NOT attempt to query, read, or refer to any external database or DB schemas.
   - All app information must strictly be provided from this system context.
5. Formatting:
   - Use clear bullet points and bold headers for multi-step answers.
   - Keep answers well-structured and direct.`;

// Helper: Fetch AI System Prompt SOLELY from D1 system_config ('ai_system_prompt')
async function getAiSystemPromptFromD1(env) {
  if (env?.DB) {
    try {
      const row = await env.DB.prepare(`SELECT value FROM system_config WHERE key = 'ai_system_prompt' LIMIT 1`).first();
      if (row?.value && row.value.trim().length > 0) {
        return row.value.trim();
      }
    } catch (err) {
      console.warn('[D1 AI System Prompt Retrieval Warning]:', err.message);
    }
  }

  return DEFAULT_AI_SYSTEM_PROMPT;
}

// Helper: Extract payload structure from Telegram message for broadcast
function extractMessagePayload(msg) {
  let type = 'text';
  let file_id = null;

  if (msg.photo) {
    type = 'photo';
    file_id = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.video) {
    type = 'video';
    file_id = msg.video.file_id;
  } else if (msg.voice) {
    type = 'voice';
    file_id = msg.voice.file_id;
  } else if (msg.audio) {
    type = 'audio';
    file_id = msg.audio.file_id;
  } else if (msg.document) {
    type = 'document';
    file_id = msg.document.file_id;
  }

  return {
    type,
    text: msg.text || '',
    caption: msg.caption || '',
    file_id,
    reply_markup: msg.reply_markup || null,
    from_chat_id: msg.chat?.id,
    message_id: msg.message_id
  };
}

// Helper: Deliver broadcast payload
async function sendBroadcastPayloadToUser(bot, targetChatId, payload) {
  let reply_markup = payload.reply_markup || undefined;
  if (!reply_markup && payload.button && payload.button.text && payload.button.url) {
    reply_markup = {
      inline_keyboard: [[{ text: payload.button.text, url: payload.button.url }]]
    };
  }

  if (payload.from_chat_id && payload.message_id && !payload.button) {
    try {
      await bot.telegram.copyMessage(targetChatId, payload.from_chat_id, payload.message_id, {
        reply_markup: reply_markup
      });
      return { ok: true };
    } catch (err) {
      if (isBlockedError(err)) throw err;
    }
  }

  const parseMode = payload.parse_mode || 'HTML';
  const captionText = payload.caption ? markdownToTelegramHtml(payload.caption) : undefined;
  const messageText = (payload.text || payload.caption) ? markdownToTelegramHtml(payload.text || payload.caption) : '📢 Smart X Ethiopian Announcement';

  const extra = {
    caption: captionText,
    parse_mode: parseMode,
    reply_markup: reply_markup
  };

  if (payload.type === 'photo' && payload.file_id) {
    await bot.telegram.sendPhoto(targetChatId, payload.file_id, extra);
  } else if (payload.type === 'video' && payload.file_id) {
    await bot.telegram.sendVideo(targetChatId, payload.file_id, extra);
  } else if (payload.type === 'voice' && payload.file_id) {
    await bot.telegram.sendVoice(targetChatId, payload.file_id, extra);
  } else if (payload.type === 'audio' && payload.file_id) {
    await bot.telegram.sendAudio(targetChatId, payload.file_id, extra);
  } else if (payload.type === 'document' && payload.file_id) {
    await bot.telegram.sendDocument(targetChatId, payload.file_id, extra);
  } else {
    await bot.telegram.sendMessage(targetChatId, messageText, {
      parse_mode: parseMode,
      reply_markup: reply_markup
    });
  }

  return { ok: true };
}

// Process Queued Broadcast Messages in Batches
async function processBroadcastQueueBatch(bot, env, batchSize = 25) {
  if (!env.DB) return { processed: 0 };

  const activeBroadcast = await env.DB.prepare(`
    SELECT * FROM broadcasts 
    WHERE status IN ('in_progress', 'queued') 
    ORDER BY id ASC LIMIT 1
  `).first();

  if (!activeBroadcast) return { processed: 0 };

  const broadcastId = activeBroadcast.id;
  let payload = {};
  try {
    payload = JSON.parse(activeBroadcast.payload_json || '{}');
  } catch (e) {
    console.error('Payload parse error:', e);
  }

  const queueItemsRes = await env.DB.prepare(`
    SELECT * FROM broadcast_queue 
    WHERE broadcast_id = ? AND status IN ('pending', 'retry') 
    LIMIT ?
  `).bind(broadcastId, batchSize).all();

  const items = queueItemsRes.results || [];

  if (items.length === 0) {
    const remainingRes = await env.DB.prepare(`
      SELECT COUNT(*) as pending_count FROM broadcast_queue 
      WHERE broadcast_id = ? AND status IN ('pending', 'retry')
    `).bind(broadcastId).first();

    if ((remainingRes?.pending_count || 0) === 0) {
      await env.DB.prepare(`
        UPDATE broadcasts 
        SET status = 'completed', pending_count = 0, updated_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).bind(broadcastId).run();

      if (activeBroadcast.admin_id) {
        await sendFinalBroadcastReport(bot, env, broadcastId, activeBroadcast.admin_id);
      }
    }
    return { processed: 0, completed: true };
  }

  let batchSent = 0;
  let batchBlocked = 0;
  let batchFailed = 0;

  for (const item of items) {
    const recipientId = item.telegram_id;
    try {
      await sendBroadcastPayloadToUser(bot, recipientId, payload);
      await env.DB.prepare(`UPDATE broadcast_queue SET status = 'sent', sent_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(item.id).run();
      batchSent++;
    } catch (err) {
      if (isBlockedError(err)) {
        batchBlocked++;
        await env.DB.prepare(`UPDATE broadcast_queue SET status = 'blocked', error = ? WHERE id = ?`).bind(err.message || 'Bot blocked', item.id).run();
        await env.DB.prepare(`UPDATE users SET is_active = 0, is_blocked = 1 WHERE telegram_id = ?`).bind(recipientId).run();
      } else {
        const newAttempts = (item.attempts || 0) + 1;
        if (newAttempts < 2) {
          await env.DB.prepare(`UPDATE broadcast_queue SET attempts = ?, status = 'retry', error = ? WHERE id = ?`).bind(newAttempts, err.message || 'Transient error', item.id).run();
        } else {
          batchFailed++;
          await env.DB.prepare(`UPDATE broadcast_queue SET attempts = ?, status = 'failed', error = ? WHERE id = ?`).bind(newAttempts, err.message || 'Max retries', item.id).run();
        }
      }
    }
    await new Promise(r => setTimeout(r, 80));
  }

  await env.DB.prepare(`
    UPDATE broadcasts 
    SET sent_count = sent_count + ?, 
        blocked_count = blocked_count + ?, 
        failed_count = failed_count + ?, 
        pending_count = (SELECT COUNT(*) FROM broadcast_queue WHERE broadcast_id = ? AND status IN ('pending', 'retry')),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).bind(batchSent, batchBlocked, batchFailed, broadcastId, broadcastId).run();

  return { processed: items.length, sent: batchSent, blocked: batchBlocked, failed: batchFailed };
}

// Send Final Completion Report to Admin
async function sendFinalBroadcastReport(bot, env, broadcastId, adminId) {
  if (!env.DB) return;
  try {
    const b = await env.DB.prepare(`SELECT * FROM broadcasts WHERE id = ?`).bind(broadcastId).first();
    if (!b) return;

    const total = b.total_recipients || 0;
    const sent = b.sent_count || 0;
    const blocked = b.blocked_count || 0;
    const failed = b.failed_count || 0;

    const reportMsg =
      `🎉 <b>የብሮድካስት ስራ በተሳካ ሁኔታ ተጠናቋል! (Broadcast Completed)</b>\n\n` +
      `🆔 <b>Broadcast ID:</b> #${broadcastId}\n` +
      `• 👥 <b>ጠቅላላ ተቀባዮች:</b> ${total}\n` +
      `• 📬 <b>በተሳካ ሁኔታ የተላኩ:</b> ${sent}\n` +
      `• 🚫 <b>የከለከሉ (Blocked):</b> ${blocked}\n` +
      `• ❌ <b>የከሸፉ (Failed):</b> ${failed}`;

    await bot.telegram.sendMessage(adminId, reportMsg, { parse_mode: 'HTML' });
  } catch (err) {
    console.error('Final report error:', err);
  }
}

// Helper: Build Admin Dashboard Content and Keyboard
async function buildAdminDashboardData(env) {
  let totalUsers = 0;
  let gradeCounts = { 'Grade 9': 0, 'Grade 10': 0, 'Grade 11': 0, 'Grade 12': 0 };

  if (env?.DB) {
    try {
      const uRes = await env.DB.prepare(`SELECT COUNT(*) as total FROM users`).first();
      totalUsers = uRes?.total || 0;

      const gRes = await env.DB.prepare(`SELECT grade, COUNT(*) as count FROM users GROUP BY grade`).all();
      if (gRes?.results) {
        for (const row of gRes.results) {
          if (row.grade && gradeCounts[row.grade] !== undefined) {
            gradeCounts[row.grade] = row.count;
          }
        }
      }
    } catch (err) {
      console.error('Admin stats query error:', err);
    }
  } else {
    totalUsers = Object.keys(registeredUsers).length;
    for (const id in registeredUsers) {
      const g = registeredUsers[id].grade;
      if (g && gradeCounts[g] !== undefined) gradeCounts[g]++;
    }
  }

  const text =
`👑 <b>Smart X Admin Control Center</b> 👑

📊 <b>System Overview:</b>
• 👥 <b>Total Users Registered:</b> <code>${totalUsers}</code>
• 9️⃣ <b>Grade 9:</b> <code>${gradeCounts['Grade 9'] || 0}</code> | 🔟 <b>Grade 10:</b> <code>${gradeCounts['Grade 10'] || 0}</code>
• 1️⃣1️⃣ <b>Grade 11:</b> <code>${gradeCounts['Grade 11'] || 0}</code> | 1️⃣2️⃣ <b>Grade 12:</b> <code>${gradeCounts['Grade 12'] || 0}</code>

⚙️ <b>Database Configurations:</b>
<i>Choose an option below to update D1 tables dynamically:</i>`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🧠 Edit AI System Prompt', 'admin_edit_ai_prompt')
    ],
    [
      Markup.button.callback('📝 Edit App Info (app_info)', 'admin_edit_app_info'),
      Markup.button.callback('⚙️ Edit System Config (system_config)', 'admin_edit_sys_config')
    ],
    [
      Markup.button.callback('📊 View User Stats', 'admin_view_stats'),
      Markup.button.callback('📢 Broadcast Message', 'admin_new_broadcast')
    ],
    [
      Markup.button.callback('🔄 Refresh Dashboard', 'admin_refresh_stats')
    ]
  ]);

  return { text, keyboard };
}

// Helper: Build App Info Editing Menu from D1
async function buildAppInfoMenu(env) {
  let rows = [];
  if (env?.DB) {
    try {
      const res = await env.DB.prepare('SELECT key, value FROM app_info ORDER BY key ASC').all();
      rows = res?.results || [];
    } catch (err) {
      console.error('Fetch app_info error:', err);
    }
  }

  if (rows.length === 0) {
    rows = [
      { key: 'app_name', value: 'Smart X Ethiopian (Smart X ET)' },
      { key: 'release_date', value: 'Meskerem 5 / September 2026' },
      { key: 'developer', value: 'HAB IT Solutions' },
      { key: 'status', value: 'Pre-Registration Active' },
      { key: 'download_status', value: 'Coming Soon on Meskerem 5' },
      { key: 'pricing_and_plans', value: 'Free Tier & VIP Pass (150 ETB/mo)' }
    ];
  }

  let listText = rows.map((r) =>
    `• <b>${escapeHtml(r.key)}:</b>\n  <code>${escapeHtml(r.value)}</code>`
  ).join('\n\n');

  const text =
`📝 <b>D1 Database: <code>app_info</code> Table</b>

━━━━━━━━━━━━━━━━━━━━
${listText}
━━━━━━━━━━━━━━━━━━━━
<i>Select a key below to update its value, or add a new key:</i>`;

  const buttons = [];
  for (let i = 0; i < rows.length; i += 2) {
    const rowButtons = [];
    rowButtons.push(Markup.button.callback(`✏️ ${rows[i].key}`, `edit_app_key:${rows[i].key}`));
    if (rows[i + 1]) {
      rowButtons.push(Markup.button.callback(`✏️ ${rows[i + 1].key}`, `edit_app_key:${rows[i + 1].key}`));
    }
    buttons.push(rowButtons);
  }

  buttons.push([
    Markup.button.callback('➕ Add Custom Key', 'admin_add_app_key'),
    Markup.button.callback('⬅️ Back to Dashboard', 'admin_refresh_stats')
  ]);

  return { text, keyboard: Markup.inlineKeyboard(buttons) };
}

// Helper: Build System Config Editing Menu from D1
async function buildSystemConfigMenu(env) {
  let rows = [];
  if (env?.DB) {
    try {
      const res = await env.DB.prepare('SELECT key, value FROM system_config ORDER BY key ASC').all();
      rows = res?.results || [];
    } catch (err) {
      console.error('Fetch system_config error:', err);
    }
  }

  if (rows.length === 0) {
    rows = [
      { key: 'bot_status', value: 'Operational' },
      { key: 'required_channel', value: '@SmartX_Discussion' },
      { key: 'official_channel', value: '@SmartXEthiopia' },
      { key: 'bot_version', value: 'v3.0-enterprise' },
      { key: 'ai_engine', value: 'Gemini 3.6 Flash Multi-Model' },
      { key: 'maintenance_mode', value: 'false' }
    ];
  }

  let listText = rows.map((r) =>
    `• <b>${escapeHtml(r.key)}:</b>\n  <code>${escapeHtml(r.value)}</code>`
  ).join('\n\n');

  const text =
`⚙️ <b>D1 Database: <code>system_config</code> Table</b>

━━━━━━━━━━━━━━━━━━━━
${listText}
━━━━━━━━━━━━━━━━━━━━
<i>Select a key below to update its configuration:</i>`;

  const buttons = [];
  for (let i = 0; i < rows.length; i += 2) {
    const rowButtons = [];
    rowButtons.push(Markup.button.callback(`⚙️ ${rows[i].key}`, `edit_sys_key:${rows[i].key}`));
    if (rows[i + 1]) {
      rowButtons.push(Markup.button.callback(`⚙️ ${rows[i + 1].key}`, `edit_sys_key:${rows[i + 1].key}`));
    }
    buttons.push(rowButtons);
  }

  buttons.push([
    Markup.button.callback('➕ Add Custom Config', 'admin_add_sys_key'),
    Markup.button.callback('⬅️ Back to Dashboard', 'admin_refresh_stats')
  ]);

  return { text, keyboard: Markup.inlineKeyboard(buttons) };
}

// Helper: Build Detailed User Stats Menu
async function buildUserStatsMenu(env) {
  let totalUsers = 0;
  let activeUsers = 0;
  let inactiveUsers = 0;
  let gradeCounts = { 'Grade 9': 0, 'Grade 10': 0, 'Grade 11': 0, 'Grade 12': 0 };
  let langCounts = { 'am': 0, 'om': 0, 'en': 0 };
  let totalAiChats = 0;
  let totalBroadcasts = 0;
  let totalReferrals = 0;

  if (env?.DB) {
    try {
      const uRes = await env.DB.prepare(`SELECT COUNT(*) as total, SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive, SUM(referral_count) as total_refs FROM users`).first();
      totalUsers = uRes?.total || 0;
      activeUsers = uRes?.active || 0;
      inactiveUsers = uRes?.inactive || 0;
      totalReferrals = uRes?.total_refs || 0;

      const gRes = await env.DB.prepare(`SELECT grade, COUNT(*) as count FROM users GROUP BY grade`).all();
      if (gRes?.results) {
        for (const row of gRes.results) {
          if (row.grade && gradeCounts[row.grade] !== undefined) {
            gradeCounts[row.grade] = row.count;
          }
        }
      }

      const lRes = await env.DB.prepare(`SELECT language, COUNT(*) as count FROM users GROUP BY language`).all();
      if (lRes?.results) {
        for (const row of lRes.results) {
          if (row.language && langCounts[row.language] !== undefined) {
            langCounts[row.language] = row.count;
          }
        }
      }

      const cRes = await env.DB.prepare(`SELECT COUNT(*) as total_chats FROM ai_chats`).first();
      totalAiChats = cRes?.total_chats || 0;

      const bRes = await env.DB.prepare(`SELECT COUNT(*) as total_bcasts FROM broadcasts`).first();
      totalBroadcasts = bRes?.total_bcasts || 0;
    } catch (err) {
      console.error('Stats fetch error:', err);
    }
  } else {
    totalUsers = Object.keys(registeredUsers).length;
    for (const id in registeredUsers) {
      const u = registeredUsers[id];
      if (u.grade && gradeCounts[u.grade] !== undefined) gradeCounts[u.grade]++;
      if (u.language && langCounts[u.language] !== undefined) langCounts[u.language]++;
    }
  }

  const text =
`📊 <b>Detailed Student & Platform Analytics</b> 🇪🇹

━━━━━━━━━━━━━━━━━━━━
• 👥 <b>Total Pre-Registered:</b> <code>${totalUsers}</code>
• 🟢 <b>Active Users:</b> <code>${activeUsers}</code>
• 🔴 <b>Inactive / Blocked:</b> <code>${inactiveUsers}</code>
• 🔗 <b>Total Referral Invites:</b> <code>${totalReferrals}</code>

🎓 <b>Grade Distribution:</b>
• 9️⃣ <b>Grade 9:</b> <code>${gradeCounts['Grade 9'] || 0}</code>
• 🔟 <b>Grade 10:</b> <code>${gradeCounts['Grade 10'] || 0}</code>
• 1️⃣1️⃣ <b>Grade 11:</b> <code>${gradeCounts['Grade 11'] || 0}</code>
• 1️⃣2️⃣ <b>Grade 12:</b> <code>${gradeCounts['Grade 12'] || 0}</code>

🌐 <b>Language Distribution:</b>
• 🇪🇹 <b>Amharic:</b> <code>${langCounts['am'] || 0}</code>
• 🔴 <b>Afaan Oromoo:</b> <code>${langCounts['om'] || 0}</code>
• 🇬🇧 <b>English:</b> <code>${langCounts['en'] || 0}</code>

🤖 <b>Activity Metrics:</b>
• 💬 <b>AI Queries Logged:</b> <code>${totalAiChats}</code>
• 📢 <b>Broadcasts Sent:</b> <code>${totalBroadcasts}</code>
━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('👥 View Recent Students', 'admin_recent_users'),
      Markup.button.callback('⬅️ Back to Dashboard', 'admin_refresh_stats')
    ]
  ]);

  return { text, keyboard };
}

// Initialize Database Schema & Seed Knowledge Base
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

      CREATE TABLE IF NOT EXISTS ai_chats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        telegram_id INTEGER NOT NULL,
        user_message TEXT,
        bot_response TEXT,
        prompt TEXT,
        response TEXT,
        language TEXT DEFAULT 'am',
        model_used TEXT DEFAULT 'gemini-3.6-flash',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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

    // Safe column migrations in case table was created with older schema
    try { await db.exec(`ALTER TABLE users ADD COLUMN referred_by INTEGER;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN referral_count INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN points INTEGER DEFAULT 0;`); } catch (e) {}
    try { await db.exec(`ALTER TABLE users ADD COLUMN is_vip INTEGER DEFAULT 0;`); } catch (e) {}

    // Seed ground-truth records into D1 app_info & system_config tables
    await seedKnowledgeBase(db);
  } catch (err) {
    console.error('D1 Init Error:', err);
  }
}

// Seed ground-truth records into D1 app_info & system_config tables
async function seedKnowledgeBase(db) {
  if (!db) return;
  try {
    const existing = await db.prepare('SELECT COUNT(*) as cnt FROM app_info').first();
    if ((existing?.cnt || 0) === 0) {
      const seedItems = [
        ['app_name', 'Smart X Ethiopian (Smart X ET)'],
        ['developer', 'HAB IT Solutions'],
        ['release_date', 'Meskerem 5 / September 2026 (መስከረም 5 / ሴፕቴምበር 2026)'],
        ['target_audience', 'Grade 9, 10, 11, and 12 High School Students (New Ethiopian Curriculum)'],
        ['platforms', 'Android & iOS (Built with Flutter)'],
        ['pricing_and_plans', 'Free tier available with 1,000+ practice questions; Full VIP Pass with 10,000+ Quizzes, Subject Summaries, Model Exams, and Offline AI Tutor for 150 ETB/month or 400 ETB/term.'],
        ['features', '1. 10,000+ Chapter-wise Multiple Choice Quizzes for Grade 9-12 New Curriculum; 2. Instant Explanations & Reference Links; 3. AI Study Assistant for Math, Physics, Chemistry, Biology, History; 4. Gamified Leaderboard & Daily Practice Streak; 5. Offline Access Mode.'],
        ['official_channel', '@SmartXEthiopia on Telegram'],
        ['discussion_group', '@SmartX_Discussion on Telegram'],
        ['pre_registration_perks', 'Pre-registered users receive 50% discount on subscription and early access on Meskerem 5 / September 2026 release day.']
      ];

      for (const [k, v] of seedItems) {
        await db.prepare(`
          INSERT INTO app_info (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(k, v).run();
      }

      const sysItems = [
        ['bot_version', 'v3.0-enterprise'],
        ['ai_engine', 'Gemini 3.6 Flash Multi-Model Engine'],
        ['ai_system_prompt', DEFAULT_AI_SYSTEM_PROMPT],
        ['status', 'Operational'],
        ['required_channel', '@SmartX_Discussion'],
        ['official_channel', '@SmartXEthiopia']
      ];

      for (const [k, v] of sysItems) {
        await db.prepare(`
          INSERT INTO system_config (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(k, v).run();
      }
    }
  } catch (err) {
    console.error('D1 Seed Knowledge Base Error:', err);
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
    } catch (err) {
      // Ignore if message is already deleted or expired
    }
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
        // --- 1. /start & /register Handler (Welcome Back for Registered, Onboarding for New, Referral Deep Link) ---
        const handleStartOrRegister = async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const userName = ctx.from?.first_name || 'ተማሪ';
          const botUsername = getBotUsername(ctx, env);
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          // Check for referral or AI deep link payload (e.g., /start ref_12345678 or /start ai_12345678)
          const startPayload = ctx.startPayload || '';
          let referredBy = null;
          let isAiIntent = false;

          if (startPayload.startsWith('ref_')) {
            const parsedId = parseInt(startPayload.replace('ref_', ''), 10);
            if (parsedId && parsedId !== userId) {
              referredBy = parsedId;
            }
          } else if (startPayload.startsWith('ai_') || startPayload === 'ai') {
            isAiIntent = true;
            const parsedId = parseInt(startPayload.replace('ai_', ''), 10);
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
            const grade = existingUser.grade || 'Grade 10';
            const refCount = existingUser.referral_count || 0;
            const points = existingUser.points || 0;
            const welcomeBackMsg = i18n.am.welcome_back(name, phone, grade, refCount, points, groupHandle);
            const mainDashboardKeyboard = Markup.keyboard(i18n.am.menu).resize();

            return sendCleanMessage(ctx, welcomeBackMsg, {
              parse_mode: 'HTML',
              ...mainDashboardKeyboard
            });
          }

          // Case B: User is NOT YET REGISTERED -> Step 0: Psychology / Study Diagnostic Question
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
              Markup.button.callback('✅ አዎ፣ ይከብደኛል (Yes)', 'diag_answer_yes'),
              Markup.button.callback('❌ አይ፣ ዝግጁ ነኝ (No)', 'diag_answer_no')
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
            ? '💡 <b>አይዞህ/ሽ! Smart X Ethiopian በ 24/7 AI Tutor እና በ 10,000+ የፈተና ጥያቄዎች ሁሉንም ያቀልልሃል!</b>\n\n👇 <b>እባክዎን የትምህርት ክፍልዎን ይምረጡ:</b>'
            : '🔥 <b>በጣም ጎበዝ! Smart X Ethiopian በፈተናዎችህ ከፍተኛ ውጤት እንድታስመዘግብ ያግዝሃል!</b>\n\n👇 <b>እባክዎን የትምህርት ክፍልዎን ይምረጡ:</b>';

          const gradeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('9ኛ ክፍል (Grade 9)', 'set_grade_9'),
              Markup.button.callback('10ኛ ክፍል (Grade 10)', 'set_grade_10')
            ],
            [
              Markup.button.callback('11ኛ ክፍል (Grade 11)', 'set_grade_11'),
              Markup.button.callback('12ኛ ክፍል (Grade 12)', 'set_grade_12')
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
          const grade = `Grade ${gradeNum}`;
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
              [Markup.button.contactRequest('📱 ስልክ ቁጥር አጋራ (Share Contact)')]
            ]).resize().oneTime();

            return sendCleanMessage(ctx, i18n.am.phone_request_step, {
              parse_mode: 'HTML',
              ...phoneKeyboard
            });
          }

          userStates[chatId].step = 'AWAITING_CHANNEL_VERIFY';
          const groupUrl = `https://t.me/${groupHandle.replace('@', '')}`;
          const verifyKeyboard = Markup.inlineKeyboard([
            [Markup.button.url(`💬 ግሩፑን ይቀላቀሉ (${groupHandle})`, groupUrl)],
            [Markup.button.callback('✅ አረጋግጥ (Verify Membership)', 'verify_channel_step')]
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
            return ctx.answerCbQuery(`⚠️ እባክዎን መጀመሪያ ${groupHandle} ግሩፕ ይቀላቀሉ!`, { show_alert: true });
          }

          await ctx.answerCbQuery('✅ የውይይት ግሩፕ አባልነትዎ ተረጋግጧል! 🎉');

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_PHONE', data: { grade: 'Grade 10' } };
          }
          userStates[chatId].step = 'AWAITING_PHONE';

          const phoneKeyboard = Markup.keyboard([
            [Markup.button.contactRequest('📱 ስልክ ቁጥር አጋራ (Share Contact)')]
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
          const grade = stateData.grade || 'Grade 10';
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

                // Send real-time notification to the referrer
                try {
                  const refRow = await env.DB.prepare('SELECT full_name, referral_count, points, is_vip FROM users WHERE telegram_id = ?').bind(referredBy).first();
                  const updatedCount = refRow?.referral_count || 1;
                  const updatedPoints = refRow?.points || 10;
                  const isVip = refRow?.is_vip === 1 || updatedCount >= 5;

                  const refNotifyMsg =
`🎉 <b>አዲስ ተማሪ በጥቆማዎ ተመዘገበ!</b> 🚀

👤 <b>የተመዘገበው ተማሪ:</b> ${escapeHtml(fullName)} (${escapeHtml(grade)})
🎁 <b>ሽልማት:</b> <code>+10 Referral Points</code> አግኝተዋል!
👥 <b>ጠቅላላ የተጋበዙ ጓደኞች:</b> <code>${updatedCount}</code> (${updatedPoints} pts)
💎 <b>የእርስዎ ደረጃ:</b> ${isVip ? '💎 <b>VIP Master Pass (የተከፈተ)</b>' : `🥉 Standard Member (${updatedCount}/5 ወደ VIP Pass)`}

${isVip ? '✨ <b>እንኳን ደስ አለዎት! 5+ ጓደኞችን በመጋበዝ የ 100% ነፃ VIP Pass ሽልማት አግኝተዋል!</b>' : '💡 <i>5 ጓደኞችን በመጋበዝ የ 100% ነፃ የ VIP Pass ሙሉ የፈተና እና የኖት ጥቅል ያግኙ!</i>'}`;

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

        // --- DASHBOARD BUTTON 1: 📲 Download App ---
        const handleDownloadApp = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);
          const appText = i18n[lang]?.app_hub_text || i18n.am.app_hub_text;

          return sendCleanMessage(ctx, appText, {
            parse_mode: 'HTML',
            ...Markup.keyboard(i18n[lang]?.menu || i18n.am.menu).resize()
          });
        };

        bot.hears(['📲 Download App', 'Download App', 'አፕ አውርድ', 'Download', 'App'], handleDownloadApp);
        bot.command(['download', 'app', 'apk'], handleDownloadApp);

        // --- DASHBOARD BUTTON 2: 👤 My Profile ---
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
          const grade = user?.grade || 'Grade 10';
          const refCount = user?.referral_count || 0;
          const points = user?.points || 0;
          const isVip = user?.is_vip === 1 || refCount >= 5;

          const profileText =
`👤 <b>የእርስዎ መረጃ (My Profile)</b> 🇪🇹

• <b>ስም:</b> ${escapeHtml(name)}
• <b>ስልክ:</b> <code>${escapeHtml(phone)}</code>
• <b>ክፍል:</b> <b>${escapeHtml(grade)}</b>
• <b>የተጋበዙ:</b> <code>${refCount}</code> ተማሪዎች (${points} pts)
• <b>ደረጃ:</b> ${isVip ? '💎 <b>VIP Master Pass (100% Free)</b>' : '🌟 <b>VIP Early Access (100% Free)</b>'}

🔗 <b>የመጋበዣ ሊንክ:</b>
<code>https://t.me/${botUsername}?start=ref_${userId}</code>`;

          const shareUrl = `https://t.me/share/url?url=https://t.me/${botUsername}?start=ref_${userId}&text=${encodeURIComponent('🔥 ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ 100% ነፃ የ AI ትምህርት እና የ 10,000+ ጥያቄዎች መተግበሪያ! አሁኑኑ ይመዝገቡ!')}`;

          const profileKeyboard = Markup.inlineKeyboard([
            [Markup.button.url('📲 ሊንክ አጋራ (Share Link)', shareUrl)],
            [
              Markup.button.callback('✏️ ክፍል ቀይር', 'change_grade_action'),
              Markup.button.callback('🔄 አዘምን', 'start_reregister')
            ]
          ]);

          return sendCleanMessage(ctx, profileText, {
            parse_mode: 'HTML',
            ...profileKeyboard
          });
        };

        bot.hears(['👤 My Profile', 'My Profile', 'ፕሮፋይል', 'Profile'], handleMyProfile);
        bot.command(['profile', 'myprofile'], handleMyProfile);

        bot.action('change_grade_action', async (ctx) => {
          await ctx.answerCbQuery();
          const gradeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('9ኛ ክፍል (Grade 9)', 'set_grade_9'),
              Markup.button.callback('10ኛ ክፍል (Grade 10)', 'set_grade_10')
            ],
            [
              Markup.button.callback('11ኛ ክፍል (Grade 11)', 'set_grade_11'),
              Markup.button.callback('12ኛ ክፍል (Grade 12)', 'set_grade_12')
            ]
          ]);

          return sendCleanMessage(ctx, '🔹 <b>እባክዎን አዲሱን የትምህርት ክፍልዎን ይምረጡ</b> ⬇️', {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        bot.action('start_reregister', async (ctx) => {
          await ctx.answerCbQuery();
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;

          userStates[chatId] = {
            step: 'AWAITING_GRADE',
            data: {
              fullName: ctx.from?.first_name ? `${ctx.from.first_name} ${ctx.from?.last_name || ''}`.trim() : 'ተማሪ',
              telegramId: userId
            }
          };

          const gradeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('9ኛ ክፍል (Grade 9)', 'set_grade_9'),
              Markup.button.callback('10ኛ ክፍል (Grade 10)', 'set_grade_10')
            ],
            [
              Markup.button.callback('11ኛ ክፍል (Grade 11)', 'set_grade_11'),
              Markup.button.callback('12ኛ ክፍል (Grade 12)', 'set_grade_12')
            ]
          ]);

          return sendCleanMessage(ctx, i18n.am.welcome_start(ctx.from?.first_name || 'ተማሪ'), {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
        });

        // --- DASHBOARD BUTTON 3: 🔗 Share & Invite Friends ---
        const handleShareInvite = async (ctx) => {
          const userId = ctx.from.id;
          const botUsername = getBotUsername(ctx, env);
          let user = registeredUsers[userId];

          if (env.DB) {
            try {
              const row = await env.DB.prepare('SELECT referral_count, points, is_vip FROM users WHERE telegram_id = ?').bind(userId).first();
              if (row) user = row;
            } catch (err) {}
          }

          const refCount = user?.referral_count || 0;
          const points = user?.points || 0;
          const isVip = user?.is_vip === 1 || refCount >= 5;

          const shareLink = `https://t.me/${botUsername}?start=ref_${userId}`;
          const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${encodeURIComponent('🔥 ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ 100% ነፃ የ AI ትምህርት እና የ 10,000+ ጥያቄዎች መተግበሪያ! አሁኑኑ ይመዝገቡ!')}`;

          const shareText =
`🔗 <b>ጓደኞችን ጋብዝ — Smart X Ethiopian</b> 🇪🇹

• <b>የተጋበዙ:</b> <code>${refCount}</code> ተማሪዎች
• <b>ነጥቦች:</b> <code>${points} pts</code> (+10 / ሰው)
• <b>ደረጃ:</b> ${isVip ? '💎 <b>VIP Pass Activated</b>' : `🥉 ${refCount}/5 ወደ VIP Pass`}

🎁 <b>የመጋበዣ ሊንክ:</b>
<code>${shareLink}</code>`;

          const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.url('📲 ለጓደኞች አጋራ (Share Now)', shareUrl)],
            [Markup.button.callback('👤 የእኔን መረጃ እይ', 'view_my_profile_callback')]
          ]);

          return sendCleanMessage(ctx, shareText, {
            parse_mode: 'HTML',
            ...shareKeyboard
          });
        };

        bot.hears(['🔗 Share & Invite Friends', 'Share & Invite Friends', 'ጓደኞችን ጋብዝ', 'Share', 'Invite'], handleShareInvite);
        bot.command(['share', 'invite', 'referral'], handleShareInvite);

        bot.action('view_my_profile_callback', async (ctx) => {
          await ctx.answerCbQuery();
          return handleMyProfile(ctx);
        });

        // --- DASHBOARD BUTTON 4: 🤖 Smart X AI Assistant ---
        const handleAiAssistant = async (ctx) => {
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);

          const isGroupMember = await checkDiscussionGroupMember(ctx, userId, env);
          if (!isGroupMember) {
            return requireDiscussionGroupJoin(ctx, lang, env);
          }

          userStates[chatId] = { step: 'AI_CHAT_MODE' };

          const aiChatKeyboard = Markup.keyboard([
            ['🔙 ወደ ዋናው ማውጫ (Main Menu)']
          ]).resize();

          return sendCleanMessage(ctx, i18n[lang]?.ai_intro || i18n.am.ai_intro, {
            parse_mode: 'HTML',
            ...aiChatKeyboard
          });
        };

        bot.hears(['🤖 Smart X AI Assistant', 'AI Assistant', 'AI', 'አሲስታንት', 'ረዳት'], handleAiAssistant);
        bot.command(['ai', 'ask'], handleAiAssistant);

        // --- BACK TO MAIN MENU HANDLER ---
        const handleBackToMainMenu = async (ctx) => {
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          if (userStates[chatId]) userStates[chatId].step = null;
          const lang = await getUserLanguage(userId, env);

          return sendCleanMessage(ctx, `👋 <b>ወደ ዋናው ማውጫ ተመልሰዋል!</b>\n\nከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`, {
            parse_mode: 'HTML',
            ...Markup.keyboard(i18n[lang]?.menu || i18n.am.menu).resize()
          });
        };

        bot.hears([
          '🔙 ወደ ዋናው ማውጫ (Main Menu)',
          '🔙 Main Menu',
          'ወደ ዋናው ማውጫ',
          'Main Menu',
          'ዋና ማውጫ',
          'Menu',
          'Back'
        ], handleBackToMainMenu);
        bot.command(['menu', 'mainmenu', 'back'], handleBackToMainMenu);

        bot.action('verify_discussion_membership', async (ctx) => {
          const userId = ctx.from.id;
          const groupHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
          const isMember = await checkDiscussionGroupMember(ctx, userId, env);

          if (!isMember) {
            return ctx.answerCbQuery(`⚠️ እባክዎን መጀመሪያ ${groupHandle} ግሩፕ ይቀላቀሉ!`, { show_alert: true });
          }

          await ctx.answerCbQuery('✅ የውይይት ግሩፕ አባልነትዎ ተረጋግጧል! 🎉');
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(userId, env);
          userStates[chatId] = { step: 'AI_CHAT_MODE' };

          const aiChatKeyboard = Markup.keyboard([
            ['🔙 ወደ ዋናው ማውጫ (Main Menu)']
          ]).resize();

          return sendCleanMessage(ctx, i18n[lang]?.ai_intro || i18n.am.ai_intro, {
            parse_mode: 'HTML',
            ...aiChatKeyboard
          });
        });

        // --- FAQ HANDLER ---
        const handleFaq = async (ctx) => {
          const officialChannel = await getDynamicConfig(env, 'official_channel', '@SmartXEthiopia');
          const discussionGroup = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');

          const faqText = 
`❓ <b>Smart X Ethiopian (Smart X ET) — ተደጋግመው የሚጠየቁ ጥያቄዎች (FAQ)</b>

━━━━━━━━━━━━━━━━━━━━
1️⃣ <b>Smart X ET ምንድነው?</b>
• ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grade 9-12) የተዘጋጀ የ AI Study Assistant እና 10,000+ Quizzes የያዘ የሞባይል አፕሊኬሽን ነው።

2️⃣ <b>አፑ መቼ ይለቀቃል?</b>
• አፑ በይፋ <b>መስከረም 5 / ሴፕቴምበር 2026</b> ለ Android እና iOS ይለቀቃል።

3️⃣ <b>አፑን እንዴት ማውረድ እችላለሁ?</b>
• አፑ ሲለቀቅ ቀጥታ በዚህ ቴሌግራም ቦት ውስጥ የ <code>.apk</code> ፋይሉን ያለምንም ተጨማሪ ወጪ ማውረድ ይችላሉ።

4️⃣ <b>የ AI Assistant አገልግሎት እንዴት መጠቀም እችላለሁ?</b>
• <code>🤖 Smart X AI Assistant</code> የሚለውን በመጫን ማንኛውንም የትምህርት ጥያቄ (Math, Physics, Chemistry, Bio...) መፃፍ ይችላሉ።

5️⃣ <b>ኦፊሴላዊ ቻናሎች:</b>
• ቻናል: ${escapeHtml(officialChannel)}
• ውይይት: ${escapeHtml(discussionGroup)}
• አልሚ: HAB IT Solutions`;

          return sendCleanMessage(ctx, faqText, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.url('📢 Official Channel', `https://t.me/${officialChannel.replace('@', '')}`)],
              [Markup.button.url('💬 Discussion Group', `https://t.me/${discussionGroup.replace('@', '')}`)]
            ])
          });
        };

        bot.hears(['❓ FAQ', 'FAQ', 'ጥያቄዎች'], handleFaq);
        bot.command('faq', handleFaq);

        // --- OPTIMIZED INLINE BOT QUERY HANDLER (Smart X Ethiopian EdTech Platform) ---
        bot.on('inline_query', async (ctx) => {
          const query = (ctx.inlineQuery?.query || '').trim().toLowerCase();
          const userId = ctx.from?.id || 0;
          const botUsername = getBotUsername(ctx, env);

          // Dynamic deep link using bot username and user referral ID
          const inviteDeepLink = `https://t.me/${botUsername}?start=ref_${userId}`;

          // Result 1: Universal Pre-Registration & Platform Overview (Short & Clean for Groups)
          const mainShareText =
`📚 *Smart X Ethiopian (Smart X ET)* 🇪🇹
_የ 9ኛ - 12ኛ ክፍል ተማሪዎች የትምህርት መድረክ_

🎯 *"የዛሬ ጥረትህ፣ የነገ ስኬትህ ነው!"*

✨ *ዋና ዋና አገልግሎቶች:*
• 📖 *Short Notes* — ምዕራፍ ተኮር ማጠቃለያዎች
• 📝 *10,000+ Model Exams* — የሞዴል ፈተናዎች
• 🤖 *24/7 AI Tutor* — በማንኛውም ሰዓት ፈጣን ረዳት
• ⚡ *Offline Mode* — ያለ ኢንተርኔት የሚሰራ

🎁 *100% ነፃ የቅድመ-ምዝገባ እድል አሁኑኑ ያግኙ!*`;

          // Result 2: 24/7 AI Academic Tutor
          const aiTutorText =
`🤖 *Smart X AI — 24/7 የትምህርት ረዳት* 🇪🇹
_ለ 9-12ኛ ክፍል አዲሱ የስርዓተ-ትምህርት የተዘጋጀ_

💡 *"ለማንኛውም አስቸጋሪ ጥያቄ ፈጣን እና ግልጽ ማብራሪያ!"*

✨ *አገልግሎቶች:*
• 📐 *Math, Physics & Chemistry* — ደረጃ በደረጃ ስሌት
• 📖 *Short Notes* — ምዕራፍ ተኮር ማጠቃለያዎች
• 📝 *Model Exams* — የፈተና ጥያቄዎች አፈታት
• 🤖 *24/7 AI Tutor* — ፈጣን የትምህርት ረዳት

🎁 *100% ነፃ የቅድመ-ምዝገባ እድል አሁኑኑ ያግኙ!*`;

          // Result 3: 10,000+ Model Exams & Quizzes
          const examPackText =
`📝 *10,000+ Model Exams & Quizzes — Smart X ET* 🇪🇹
_ለ 9-12ኛ ክፍል ብሔራዊ ፈተናዎች ከፍተኛ ውጤት ለማምጣት_

🔥 *"ብልህ ተማሪ ዛሬ ይዘጋጃል!"*

🌟 *የፈተና ጥቅል:*
• 📊 *10,000+ Quizzes* — በምዕራፍ የተከፋፈሉ ጥያቄዎች
• 📖 *Short Notes* — አስፈላጊ የትምህርት ማጠቃለያዎች
• ⏱️ *Model Exams* — የሞዴል ፈተናዎች
• 🤖 *24/7 AI Tutor* — ፈጣን ማብራሪያ እና እርዳታ

🎁 *100% ነፃ የቅድመ-ምዝገባ እድል አሁኑኑ ያግኙ!*`;

          const singleRegisterMarkup = {
            inline_keyboard: [
              [
                { text: '🚀 ይመዝገቡ (Pre-Register)', url: inviteDeepLink }
              ]
            ]
          };

          const results = [
            {
              type: 'article',
              id: `smartx_main_${userId}`,
              title: '🇪🇹 Smart X Ethiopian (Grades 9-12)',
              description: '100% Free VIP Pre-Registration • 10,000+ Quizzes & AI Tutor',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
              input_message_content: {
                message_text: mainShareText,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              },
              reply_markup: singleRegisterMarkup
            },
            {
              type: 'article',
              id: `smartx_ai_${userId}`,
              title: '🤖 Smart X AI — 24/7 Academic Study Assistant',
              description: 'Ask any academic question from Grade 9-12 curriculum',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/4712/4712035.png',
              input_message_content: {
                message_text: aiTutorText,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              },
              reply_markup: singleRegisterMarkup
            },
            {
              type: 'article',
              id: `smartx_exams_${userId}`,
              title: '📝 10,000+ Model Exams & Quizzes',
              description: 'Chapter-wise practice quizzes & National Model Exams',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/2997/2997295.png',
              input_message_content: {
                message_text: examPackText,
                parse_mode: 'Markdown',
                disable_web_page_preview: true
              },
              reply_markup: singleRegisterMarkup
            }
          ];

          // Priority sorting based on search keyword
          let sortedResults = results;
          if (query.includes('ai') || query.includes('tutor') || query.includes('ረዳት')) {
            sortedResults = [results[1], results[0], results[2]];
          } else if (query.includes('exam') || query.includes('quiz') || query.includes('ፈተና') || query.includes('ጥያቄ')) {
            sortedResults = [results[2], results[0], results[1]];
          }

          try {
            return await ctx.answerInlineQuery(sortedResults, {
              cache_time: 10,
              is_personal: true
            });
          } catch (err) {
            console.error('Inline Query Error:', err.message);
          }
        });

        // --- DEDICATED ADMIN DASHBOARD (`/admin`, `/dashboard`, `/panel`) ---
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

        // Admin Action: Refresh Stats / Main Dashboard
        bot.action('admin_refresh_stats', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          if (userStates[chatId]) delete userStates[chatId];

          await ctx.answerCbQuery('🔄 Updating dashboard...');
          const { text, keyboard } = await buildAdminDashboardData(env);
          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Open App Info Menu
        bot.action('admin_edit_app_info', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          if (userStates[chatId]) delete userStates[chatId];

          await ctx.answerCbQuery('Loading app_info...');
          const { text, keyboard } = await buildAppInfoMenu(env);
          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Open System Config Menu
        bot.action('admin_edit_sys_config', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          if (userStates[chatId]) delete userStates[chatId];

          await ctx.answerCbQuery('Loading system_config...');
          const { text, keyboard } = await buildSystemConfigMenu(env);
          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Edit AI System Prompt Dedicated Handler
        bot.action('admin_edit_ai_prompt', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery('Loading AI System Prompt...');

          const currentPrompt = await getAiSystemPromptFromD1(env);
          userStates[chatId] = { step: 'SET_ADMIN_AI_PROMPT' };

          const text =
`🧠 <b>የ Gemini AI System Prompt ማስተካከያ (Admin Editor)</b>

📌 <b>አሁን በስራ ላይ ያለው Prompt (Current Prompt):</b>
<pre><code>${escapeHtml(currentPrompt)}</code></pre>

━━━━━━━━━━━━━━━━━━━━
<b>እባክዎን አዲሱን የ AI System Prompt (Instruction) ያስገቡ:</b>

<i>(ማንኛውንም አዲስ መመሪያ ወይም የይዘት ገለጻ ጽፈው ይላኩ። Gemini AI በሚቀጥለው ጥያቄ ላይ በዚህ መመሪያ መሠረት መልስ ይሰጣል)</i>`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_refresh_stats')]
          ]);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: View Detailed Stats
        bot.action('admin_view_stats', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery('Loading user analytics...');
          const { text, keyboard } = await buildUserStatsMenu(env);
          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Edit a specific app_info key
        bot.action(/^edit_app_key:(.+)$/, async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          const key = ctx.match[1];
          await ctx.answerCbQuery(`Editing: ${key}`);

          let currentVal = 'Not set';
          if (env?.DB) {
            try {
              const res = await env.DB.prepare('SELECT value FROM app_info WHERE key = ?').bind(key).first();
              if (res?.value) currentVal = res.value;
            } catch (err) {
              console.error('Fetch key value error:', err);
            }
          }

          userStates[chatId] = { step: 'EDIT_APP_INFO_KEY', editingKey: key };

          const text =
`📝 <b>Edit App Info:</b> <code>${escapeHtml(key)}</code>

📌 <b>Current Value:</b>
<code>${escapeHtml(currentVal)}</code>

<i>እባክዎን አዲሱን value ያስገቡ ለ '${escapeHtml(key)}':</i>`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_app_info')]
          ]);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Edit a specific system_config key
        bot.action(/^edit_sys_key:(.+)$/, async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          const key = ctx.match[1];
          await ctx.answerCbQuery(`Editing: ${key}`);

          let currentVal = 'Not set';
          if (env?.DB) {
            try {
              const res = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?').bind(key).first();
              if (res?.value) currentVal = res.value;
            } catch (err) {
              console.error('Fetch sys key value error:', err);
            }
          }

          userStates[chatId] = { step: 'EDIT_SYS_CONFIG_KEY', editingKey: key };

          const text =
`⚙️ <b>Edit System Config:</b> <code>${escapeHtml(key)}</code>

📌 <b>Current Value:</b>
<code>${escapeHtml(currentVal)}</code>

<i>እባክዎን አዲሱን value ያስገቡ ለ '${escapeHtml(key)}':</i>`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_sys_config')]
          ]);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Add New App Info Key
        bot.action('admin_add_app_key', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery();
          userStates[chatId] = { step: 'AWAITING_NEW_APP_KEY_NAME' };

          const text =
`➕ <b>Add New App Info Key</b>

እባክዎን አዲሱን የ Key ስም ያስገቡ (ምሳሌ: <code>download_url</code>, <code>apk_size</code>, <code>vip_price</code>):`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_app_info')]
          ]);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: Add New System Config Key
        bot.action('admin_add_sys_key', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery();
          userStates[chatId] = { step: 'AWAITING_NEW_SYS_KEY_NAME' };

          const text =
`➕ <b>Add New System Config Key</b>

እባክዎን አዲሱን የ Config Key ስም ያስገቡ (ምሳሌ: <code>rate_limit</code>, <code>debug_mode</code>):`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_sys_config')]
          ]);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
          }
        });

        // Admin Action: View Recent Users
        bot.action('admin_recent_users', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery();
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
`👥 <b>Recent Pre-Registered Students (Total: ${totalCount}):</b>

━━━━━━━━━━━━━━━━━━━━
${listText || '<i>No students found in database.</i>'}
━━━━━━━━━━━━━━━━━━━━
💡 <i>To delete a student record, send:</i> <code>/delete_user &lt;telegram_id&gt;</code>`;

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

          await ctx.answerCbQuery();
          const chatId = ctx.chat.id;
          userStates[chatId] = { step: 'AWAITING_BROADCAST_CONTENT' };

          return sendCleanMessage(ctx,
            `📢 <b>Admin Broadcast Creation (Advanced HTML & Media Engine)</b>\n\n` +
            `Send or forward the message (Text, Photo, Video, Audio, or Voice) you want to broadcast to all pre-registered users in Cloudflare D1.\n\n` +
            `Supports full Telegram HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>, links).\n\n` +
            `Send <code>/cancel_broadcast</code> to cancel.`,
            { parse_mode: 'HTML' }
          );
        });

        // --- ADMIN BROADCAST SYSTEM ---
        const handleAdminBroadcastCommand = (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;

          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ <b>Access Denied!</b> Admin command only.', { parse_mode: 'HTML' });
          }

          userStates[chatId] = { step: 'AWAITING_BROADCAST_CONTENT' };

          return sendCleanMessage(ctx,
            `📢 <b>Admin Broadcast Creation (Advanced HTML & Media Engine)</b>\n\n` +
            `Send or forward the message (Text, Photo, Video, Audio, or Voice) you want to broadcast to all pre-registered users in Cloudflare D1.\n\n` +
            `Supports full Telegram HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>, links).\n\n` +
            `Type <code>/cancel_broadcast</code> to cancel.`,
            { parse_mode: 'HTML' }
          );
        };

        bot.command('broadcast', handleAdminBroadcastCommand);

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
            await ctx.answerCbQuery('⚠️ Draft not found.');
            return ctx.reply('⚠️ Draft not found.');
          }

          await ctx.answerCbQuery('🚀 Starting Broadcast...');
          delete broadcastDrafts[chatId];

          return startBroadcastProcess(ctx, draft);
        });

        bot.action('cancel_broadcast_draft', async (ctx) => {
          const chatId = ctx.chat.id;
          delete broadcastDrafts[chatId];
          if (userStates[chatId]) userStates[chatId].step = null;
          await ctx.answerCbQuery('Cancelled.');
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
            `🚀 <b>Broadcast queued in Cloudflare D1!</b>\n\n🆔 <b>ID:</b> #${broadcastId}\n📬 <b>Total:</b> ${totalRecipients}\n⚡ <b>Rate Limit:</b> Safe batch delivery queue active.`,
            { parse_mode: 'HTML' }
          );

          const batchRes = await processBroadcastQueueBatch(bot, env, 25);

          return sendCleanMessage(ctx,
            `📊 <b>First Batch Result:</b>\n• Delivered: ${batchRes.sent || 0}\n• Blocked: ${batchRes.blocked || 0}\n• Failed: ${batchRes.failed || 0}\n\nRemaining items will be dispatched automatically. Send <code>/broadcast_status</code> for reports.`,
            { parse_mode: 'HTML' }
          );
        }

        const handleBroadcastStatus = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ <b>Access Denied!</b> Admin command only.', { parse_mode: 'HTML' });
          if (!env.DB) return ctx.reply('⚠️ D1 Database not available.');

          try {
            const b = await env.DB.prepare(`SELECT * FROM broadcasts ORDER BY id DESC LIMIT 1`).first();
            if (!b) return sendCleanMessage(ctx, 'ℹ️ No broadcast logs found.');

            const total = b.total_recipients || 0;
            const sent = b.sent_count || 0;
            const blocked = b.blocked_count || 0;
            const failed = b.failed_count || 0;
            const pending = b.pending_count || 0;
            const totalAttempted = sent + blocked + failed;
            const successRate = totalAttempted > 0 ? ((sent / totalAttempted) * 100).toFixed(1) : '100.0';

            return sendCleanMessage(ctx,
              `📊 <b>Smart X ET Broadcast Status Report</b>\n\n` +
              `🆔 <b>ID:</b> #${b.id}\n` +
              `📌 <b>Status:</b> ${b.status}\n` +
              `• 👥 <b>Total:</b> ${total}\n` +
              `• 📬 <b>Delivered:</b> ${sent}\n` +
              `• 🚫 <b>Blocked:</b> ${blocked}\n` +
              `• ❌ <b>Failed:</b> ${failed}\n` +
              `• ⏳ <b>Pending:</b> ${pending}\n` +
              `🎯 <b>Success Rate:</b> ${successRate}%`,
              { parse_mode: 'HTML' }
            );
          } catch (err) {
            return sendCleanMessage(ctx, `⚠️ Error fetching report: ${escapeHtml(err.message)}`);
          }
        };

        bot.command('broadcast_status', handleBroadcastStatus);
        bot.command('broadcast_report', handleBroadcastStatus);

        // --- ADMIN USER MANAGEMENT COMMANDS ---
        bot.command(['delete_user', 'delete_registration', 'delete'], async (ctx) => {
          const adminId = ctx.from.id;
          if (!isAdmin(adminId, env)) {
            return ctx.reply('⛔ <b>Access Denied!</b> Admin authority command only.', { parse_mode: 'HTML' });
          }

          const args = ctx.message.text.split(' ').slice(1);
          const targetId = args[0] ? parseInt(args[0], 10) : null;

          if (!targetId || isNaN(targetId)) {
            return sendCleanMessage(ctx,
              '⚠️ <b>Admin Delete User Usage:</b>\n\n<code>/delete_user &lt;telegram_id&gt;</code>\nExample: <code>/delete_user 123456789</code>',
              { parse_mode: 'HTML' }
            );
          }

          if (env.DB) {
            try {
              await env.DB.prepare('DELETE FROM users WHERE telegram_id = ?').bind(targetId).run();
            } catch (err) {
              console.error('Delete user error:', err);
            }
          }

          delete registeredUsers[targetId];
          delete userLanguages[targetId];

          return sendCleanMessage(ctx,
            `🗑️ <b>Admin Authority Action Completed:</b>\n\nUser registration data for Telegram ID <code>#${targetId}</code> has been permanently removed!`,
            { parse_mode: 'HTML' }
          );
        });

        bot.command(['users', 'list_users', 'registered_users'], async (ctx) => {
          const adminId = ctx.from.id;
          if (!isAdmin(adminId, env)) return ctx.reply('⛔ <b>Access Denied!</b> Admin authority command only.', { parse_mode: 'HTML' });

          let totalCount = 0;
          let userRows = [];

          if (env.DB) {
            try {
              const countRes = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first();
              totalCount = countRes?.total || 0;

              const rowsRes = await env.DB.prepare('SELECT telegram_id, full_name, phone, grade, referral_count, points FROM users ORDER BY registered_at DESC LIMIT 10').all();
              userRows = rowsRes?.results || [];
            } catch (e) {}
          }

          let userListText = userRows.map((u, i) => `${i + 1}. <b>${escapeHtml(u.full_name)}</b> (<code>#${u.telegram_id}</code>) - ${escapeHtml(u.grade)} [${escapeHtml(u.phone)}] (Refs: ${u.referral_count || 0})`).join('\n');

          return sendCleanMessage(ctx,
            `👥 <b>Total Pre-Registered Students:</b> ${totalCount}\n\n<b>Recent Registrations:</b>\n${userListText || 'No registered users in DB.'}\n\nTo delete a registered user, run:\n<code>/delete_user &lt;telegram_id&gt;</code>`,
            { parse_mode: 'HTML' }
          );
        });

        // --- Catch-all Message Handler ---
        bot.on(['message'], async (ctx) => {
          const chatId = ctx.chat.id;
          const msg = ctx.message;
          const text = (msg.text || msg.caption || '').trim();
          const userId = ctx.from.id;
          const botUsername = getBotUsername(ctx, env);

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
              `Would you like to attach an inline URL button to this broadcast message?\n\n` +
              `<b>Format:</b> <code>Button Text | https://your-link.com</code>\n` +
              `<b>Example:</b> <code>Join Channel | https://t.me/SmartXEthiopia</code>\n\n` +
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
              `🔍 <b>Broadcast Message Preview (HTML Mode):</b>\n\n` +
              `• <b>Type:</b> ${draft.type.toUpperCase()}\n` +
              `${btnPreview}\n\n` +
              `<b>Content Preview:</b>\n` +
              `${markdownToTelegramHtml(contentPreview)}\n\n` +
              `<i>Ready to send to all pre-registered users in Cloudflare D1?</i>`,
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

          // Admin Action: Saving AI System Prompt (SET_ADMIN_AI_PROMPT)
          if (state && state.step === 'SET_ADMIN_AI_PROMPT' && text) {
            if (!isAdmin(userId, env)) {
              delete userStates[chatId];
              return ctx.reply('⛔ Admin command only.');
            }

            const newPrompt = text.trim();
            delete userStates[chatId];

            if (env?.DB) {
              try {
                await env.DB.prepare(`
                  INSERT INTO system_config (key, value) VALUES ('ai_system_prompt', ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                `).bind(newPrompt).run();
              } catch (err) {
                console.error('Save AI prompt to D1 error:', err);
              }
            }

            const confirmKeyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback('🧠 View/Edit Prompt', 'admin_edit_ai_prompt'),
                Markup.button.callback('👑 Admin Dashboard', 'admin_refresh_stats')
              ]
            ]);

            return sendCleanMessage(ctx,
              `✅ <b>የ AI System Prompt በትክክል በ D1 Database ውስጥ ተቀይሯል!</b>\n\n` +
              `ከአሁን ጀምሮ Gemini AI በአዲሱ መመሪያ መሠረት መልስ ይሰጣል።\n\n` +
              `📌 <b>አዲሱ መመሪያ (Saved Prompt):</b>\n<pre><code>${escapeHtml(newPrompt)}</code></pre>`,
              { parse_mode: 'HTML', ...confirmKeyboard }
            );
          }

          // Admin Action: Editing app_info Key Value
          if (state && state.step === 'EDIT_APP_INFO_KEY' && text) {
            const key = state.editingKey;
            const newVal = text.trim();
            delete userStates[chatId];

            if (env?.DB) {
              try {
                await env.DB.prepare(`
                  INSERT INTO app_info (key, value) VALUES (?, ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                `).bind(key, newVal).run();
              } catch (err) {
                console.error('Update app_info error:', err);
              }
            }

            const confirmKeyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback('📝 Back to App Info', 'admin_edit_app_info'),
                Markup.button.callback('👑 Admin Dashboard', 'admin_refresh_stats')
              ]
            ]);

            return sendCleanMessage(ctx,
              `✅ <b>'${escapeHtml(key)}' በትክክል ተቀይሯል!</b>\n\n` +
              `📌 <b>አዲሱ መረጃ:</b>\n<code>${escapeHtml(newVal)}</code>`,
              { parse_mode: 'HTML', ...confirmKeyboard }
            );
          }

          // Admin Action: Editing system_config Key Value
          if (state && state.step === 'EDIT_SYS_CONFIG_KEY' && text) {
            const key = state.editingKey;
            const newVal = text.trim();
            delete userStates[chatId];

            if (env?.DB) {
              try {
                await env.DB.prepare(`
                  INSERT INTO system_config (key, value) VALUES (?, ?)
                  ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP
                `).bind(key, newVal).run();
              } catch (err) {
                console.error('Update system_config error:', err);
              }
            }

            const confirmKeyboard = Markup.inlineKeyboard([
              [
                Markup.button.callback('⚙️ Back to System Config', 'admin_edit_sys_config'),
                Markup.button.callback('👑 Admin Dashboard', 'admin_refresh_stats')
              ]
            ]);

            return sendCleanMessage(ctx,
              `✅ <b>'${escapeHtml(key)}' በ system_config በትክክል ተቀይሯል!</b>\n\n` +
              `📌 <b>አዲሱ መረጃ:</b>\n<code>${escapeHtml(newVal)}</code>`,
              { parse_mode: 'HTML', ...confirmKeyboard }
            );
          }

          // Admin Action: Awaiting New app_info Key Name
          if (state && state.step === 'AWAITING_NEW_APP_KEY_NAME' && text) {
            const newKey = text.trim().toLowerCase().replace(/\s+/g, '_');
            userStates[chatId] = { step: 'EDIT_APP_INFO_KEY', editingKey: newKey };

            const textPrompt =
`📌 Key: <code>${escapeHtml(newKey)}</code>

<i>እባክዎን የዚህን Key value ያስገቡ:</i>`;

            const keyboard = Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_app_info')]
            ]);

            return sendCleanMessage(ctx, textPrompt, { parse_mode: 'HTML', ...keyboard });
          }

          // Admin Action: Awaiting New system_config Key Name
          if (state && state.step === 'AWAITING_NEW_SYS_KEY_NAME' && text) {
            const newKey = text.trim().toLowerCase().replace(/\s+/g, '_');
            userStates[chatId] = { step: 'EDIT_SYS_CONFIG_KEY', editingKey: newKey };

            const textPrompt =
`📌 Config Key: <code>${escapeHtml(newKey)}</code>

<i>እባክዎን የዚህን Config value ያስገቡ:</i>`;

            const keyboard = Markup.inlineKeyboard([
              [Markup.button.callback('❌ Cancel / ተመለስ', 'admin_edit_sys_config')]
            ]);

            return sendCleanMessage(ctx, textPrompt, { parse_mode: 'HTML', ...keyboard });
          }

          // --- AI Assistant Query Handler with Gemini AI (Using D1 ai_system_prompt) ---
          const lang = await getUserLanguage(userId, env);
          const isGroupMember = await checkDiscussionGroupMember(ctx, userId, env);
          if (!isGroupMember) {
            return requireDiscussionGroupJoin(ctx, lang, env);
          }

          let aiResponseText = '';
          let usedModelName = 'gemini-3.6-flash';

          try {
            const dynamicSystemInstruction = await getAiSystemPromptFromD1(env);

            const aiResponse = await generateWithGeminiFallback({
              contents: text,
              config: {
                systemInstruction: dynamicSystemInstruction
              }
            }, env);

            if (aiResponse && aiResponse.text) {
              aiResponseText = markdownToTelegramHtml(aiResponse.text);
              usedModelName = aiResponse.modelUsed || 'gemini-3.6-flash';
            }
          } catch (err) {
            console.error('[AI Assistant Engine Log]:', err.message || err);
          }

          if (!aiResponseText) {
            aiResponseText = `ሰላም! Smart X Ethiopian ሞባይል አፕሊኬሽን ለ 9-12ኛ ክፍል ተማሪዎች በመስከረም 5 / ሴፕቴምበር 2026 ይለቀቃል። ለማንኛውም መረጃ <b>📲 Download App</b> ወይም <b>👤 My Profile</b> ይጎብኙ!`;
          }

          // Save chat query and response into Cloudflare D1 ai_chats table
          if (env?.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO ai_chats (telegram_id, user_message, bot_response, prompt, response, language, model_used, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
              `).bind(userId, text, aiResponseText, text, aiResponseText, lang, usedModelName).run();
            } catch (chatErr) {
              console.warn('[Chat Log Error]:', chatErr.message);
            }
          }

          const isAiMode = userStates[chatId]?.step === 'AI_CHAT_MODE';
          const replyKeyboard = isAiMode
            ? Markup.keyboard([['🔙 ወደ ዋናው ማውጫ (Main Menu)']]).resize()
            : Markup.keyboard(i18n[lang]?.menu || i18n.am.menu).resize();

          return sendCleanMessage(ctx, aiResponseText, {
            parse_mode: 'HTML',
            ...replyKeyboard
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
