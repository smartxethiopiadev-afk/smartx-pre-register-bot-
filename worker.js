import { Telegraf, Markup } from 'telegraf';
import { GoogleGenAI } from '@google/genai';

// In-memory session tracking and fallback state
const userStates = {};
const registeredUsers = {};
const broadcastDrafts = {};
const adminActionDrafts = {};
const adminQuizDrafts = {};

// Fallback Default Promo Templates (Grade 9-12 + General) - NO Parentheses
const defaultPromoTemplates = [
  {
    id: 1,
    title: '📚 ለ 9-12ኛ ክፍል አጠቃላይ',
    grade: 'All',
    button_text: '✨ አዎ! እንፈልጋለን',
    content_html:
`✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?

የሁሉንም ትምህርቶች ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!`
  },
  {
    id: 2,
    title: '📗 ለ 9ኛ ክፍል ተማሪዎች',
    grade: '9',
    button_text: '📚 የ 9ኛ ክፍል ማጠቃለያ አግኝ',
    content_html:
`📚 <b>ለ 9ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?

የ 9ኛ ክፍል አዲሱ ካሪኩለም ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!`
  },
  {
    id: 3,
    title: '📘 ለ 10ኛ ክፍል ተማሪዎች',
    grade: '10',
    button_text: '🎯 የ 10ኛ ክፍል Worksheet አግኝ',
    content_html:
`🎯 <b>ለ 10ኛ ክፍል ተማሪዎች የተዘጋጀ ልዩ አጋዥ!</b> 🇪🇹

ለፈተና በብቃት ለመዘጋጀት የሁሉንም ትምህርቶች <b>Short Notes</b> እና <b>Model Worksheets</b> ይፈልጋሉ?

ሁሉንም ጥያቄዎች ከነዝርዝር ማብራሪያቸው በአንድ ላይ ያግኙ!`
  },
  {
    id: 4,
    title: '📙 ለ 11ኛ ክፍል ተማሪዎች',
    grade: '11',
    button_text: '💡 የ 11ኛ ክፍል ጥያቄዎች አግኝ',
    content_html:
`💡 <b>ለ 11ኛ ክፍል Natural እና Social Science ተማሪዎች!</b> 🇪🇹

የከበዷችሁን የትምህርት ምዕራፎች በቀላሉ ለመረዳት አጋዥ <b>Short Notes</b> እና <b>Worksheets</b> ማግኘት ትፈልጋላችሁ?

የ 11ኛ ክፍል የሁሉንም ትምህርቶች አጋዥ ቁሳቁሶች ተዘጋጅተዋል!`
  },
  {
    id: 5,
    title: '🎓 ለ 12ኛ ክፍል ተማሪዎች',
    grade: '12',
    button_text: '🏆 የ 12ኛ ክፍል Model Exam አግኝ',
    content_html:
`🏆 <b>ለ 12ኛ ክፍል የዩኒቨርሲቲ መግቢያ ፈተና ተፈታኞች!</b> 🇪🇹

ለብሔራዊ ፈተና ከፍተኛ ውጤት ለማምጣት አጋዥ <b>Short Notes</b> እና <b>Model Exams</b> ይፈልጋሉ?

ያለፉት አመታት የፈተና ጥያቄዎች እና የሞዴል ፈተናዎች ከነመልሳቸው ተዘጋጅተዋል!`
  }
];

// Rich Sample HTML Templates for Groups & Broadcasts (High Converting / Profitable Copy)
const sampleHtmlTemplates = [
  {
    id: 'sample_group_1',
    category: 'group',
    title: '🔥 የ 9-12ኛ ክፍል አጫጭር ማጠቃለያዎች (High-Converting Promo)',
    grade: 'All',
    button_text: '✨ አዎ! እንፈልጋለን',
    html_code:
`🔥 <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ የምስራች!</b> 🇪🇹

የትምህርት ውጤታችሁን በከፍተኛ ደረጃ ለማሻሻል የሚያስችሉ የ <b>Short Notes</b> ማጠቃለያዎች፣ የ <b>Model Worksheets</b> ጥያቄዎች እና የፈተና መልሶች ይፈልጋሉ?

⚡ <b>100% Offline</b> — ያለ ምንም ኢንተርኔት በነፃ ይሰራል!

📲 <b>አሁኑኑ በነፃ ለመመዝገብ ከስር ያለውን አዝራር ይጫኑ ⬇️</b>`
  },
  {
    id: 'sample_group_2',
    category: 'group',
    title: '🎓 ለ 12ኛ ክፍል ተፈታኞች የዩኒቨርሲቲ መግቢያ ሞዴል ፈተናዎች',
    grade: '12',
    button_text: '🏆 የ 12ኛ ክፍል Model Exam አግኝ',
    html_code:
`🏆 <b>ለ 12ኛ ክፍል የዩኒቨርሲቲ መግቢያ ፈተና ተፈታኞች!</b> 🇪🇹

ለብሔራዊ ፈተና ከፍተኛ ውጤት ለማምጣት አጋዥ <b>Short Notes</b> እና <b>Model Exams</b> ይፈልጋሉ?

• 📚 ያለፉት ዓመታት የፈተና ጥያቄዎች ከነዝርዝር አሰራራቸው
• 💡 የከበዱ ፅንሰ-ሃሳቦች ማብራሪያዎች
• ⚡ ሙሉ በሙሉ በስልክዎ ላይ ያለ ኢንተርኔት የሚሰራ!

ከታች ያለውን አዝራር በመጫን በነፃ ይቀላቀሉ ⬇️`
  },
  {
    id: 'sample_bcast_1',
    category: 'broadcast',
    title: '📢 የይፋዊ መልቀቂያ ማስታወቂያ (Official Launch Announcement)',
    grade: 'All',
    button_text: '🚀 አሁኑኑ ይመዝገቡ',
    html_code:
`🎉 <b>ውድ የ Smart X Ethiopian ተማሪዎች!</b> 🇪🇹

የ <b>Smart X Ethiopian</b> የትምህርት መተግበሪያ <b>መስከረም 5</b> በይፋ ይለቀቃል!

✨ <b>ምን አዘጋጅተንላችኋል?</b>
• 📚 የ 9-12ኛ ክፍል የሁሉንም ትምህርቶች Short Notes
• 📝 ምዕራፍ ተኮር Worksheet ጥያቄዎች እና መልሶች
• ⚡ 100% Offline — ያለ ዳታ እና ኢንተርኔት የሚሰራ

👥 ጓደኞችዎን በመጋበዝ የ <b>VIP Early Access</b> እና ነጥቦችን ይሰብስቡ!

[ 👥 የውይይት ግሩፓችንን ይቀላቀሉ | https://t.me/SmartX_Ethio ]
[ 📢 ኦፊሴላዊ ቻናል | https://t.me/SmartX_Discussion ]
[ 👨‍💻 የደንበኞች ድጋፍ | https://t.me/smart_x_help ]`
  },
  {
    id: 'sample_bcast_media',
    category: 'broadcast',
    title: '🎬 Multi-Media Promo with Video/Photo Caption & Action Buttons',
    grade: 'All',
    button_text: '📲 ለጓደኞች አጋራ',
    html_code:
`📱 <b>Smart X Ethiopian Mobile App Preview!</b> 🚀

የአዲሱ ካሪኩለም የ 9-12ኛ ክፍል ተማሪዎች የትምህርት አጋዥ የሆነውን የ <b>Smart X Ethiopian</b> አፕሊኬሽን አጠቃቀም በቪዲዮ ይመልከቱ!

🗓️ የሚለቀቅበት ቀን: <b>መስከረም 5</b>

[ 📲 ጓደኞችዎን ይጋብዙ | https://t.me/SmartX_PreRegister_bot?start=invite ]
[ 💬 የውይይት ግሩፕ | https://t.me/SmartX_Ethio ]`
  }
];

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

// Helper: Validate Telegram HTML tags to prevent API parse errors
function validateTelegramHtml(html) {
  if (!html || typeof html !== 'string' || html.trim().length === 0) {
    return { valid: false, error: 'መልዕክቱ ባዶ መሆን አይችልም' };
  }

  const allowedTags = ['b', 'strong', 'i', 'em', 'u', 'ins', 's', 'strike', 'del', 'code', 'pre', 'a', 'tg-spoiler', 'tg-emoji'];
  const tagRegex = /<\/?([a-zA-Z0-9-]+)(?:\s+[^>]*)?>/g;
  const stack = [];
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const isClosing = fullTag.startsWith('</');
    const isSelfClosing = fullTag.endsWith('/>');

    if (!allowedTags.includes(tagName)) {
      return { valid: false, error: `ያልተፈቀደ ወይም የተሳሳተ HTML ታግ: <${tagName}>` };
    }

    if (isSelfClosing) continue;

    if (!isClosing) {
      if (tagName === 'a') {
        const hrefMatch = /href\s*=\s*["']([^"']+)["']/i.exec(fullTag);
        if (!hrefMatch) {
          return { valid: false, error: 'የ <a> ታግ ትክክለኛ href="https://..." ሊኖረው ይገባል' };
        }
      }
      stack.push(tagName);
    } else {
      if (stack.length === 0) {
        return { valid: false, error: `ያልተከፈተ የመዝጊያ ታግ ተገኝቷል: </${tagName}>` };
      }
      const top = stack.pop();
      if (top !== tagName) {
        return { valid: false, error: `የታግ መዘጋጋት ስህተት: <${top}> ተከፍቶ በ </${tagName}> ተዘግቷል` };
      }
    }
  }

  if (stack.length > 0) {
    return { valid: false, error: `ያልተዘጋ ታግ አለ: <${stack[stack.length - 1]}>` };
  }

  return { valid: true };
}

// Helper: Dynamically get Bot Username
function getBotUsername(ctx, env) {
  if (ctx?.botInfo?.username) return ctx.botInfo.username;
  if (ctx?.me?.username) return ctx.me.username;
  if (env?.BOT_USERNAME) return env.BOT_USERNAME.replace('@', '');
  if (process.env.BOT_USERNAME) return process.env.BOT_USERNAME.replace('@', '');
  return 'SmartX_PreRegister_bot';
}

// Zero-Database In-Memory Configuration & Polls Tracking (Database is 100% Optional)
const inMemoryConfig = {
  poll_channel: '@SmartX_Discussion',
  poll_group: '@SmartX_Ethio',
  official_channel: '@SmartXEthiopia',
  required_channel: '@SmartX_Discussion',
  discussion_group: '@SmartX_Ethio',
  support_username: '@smart_x_help',
  bot_version: 'v5.6-pure-gemini',
  release_date: 'መስከረም 5'
};
const inMemoryDispatchedPolls = [];

// Helper: Dynamically fetch channel or system configs (In-Memory first, D1 optional)
async function getDynamicConfig(env, key, defaultVal) {
  if (inMemoryConfig[key]) return inMemoryConfig[key];
  if (env?.DB) {
    try {
      const row = await env.DB.prepare('SELECT value FROM system_config WHERE key = ?').bind(key).first();
      if (row?.value) {
        inMemoryConfig[key] = row.value;
        return row.value;
      }
      const infoRow = await env.DB.prepare('SELECT value FROM app_info WHERE key = ?').bind(key).first();
      if (infoRow?.value) {
        inMemoryConfig[key] = infoRow.value;
        return infoRow.value;
      }
    } catch (err) {}
  }
  return defaultVal !== undefined ? defaultVal : inMemoryConfig[key];
}

// Helper: Dynamically set channel or system configs (In-Memory + Optional D1)
async function setDynamicConfig(env, key, value) {
  inMemoryConfig[key] = value;
  if (env?.DB) {
    try {
      await env.DB.prepare('INSERT INTO system_config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').bind(key, value).run();
    } catch (err) {}
  }
}

// Multi-language UI Texts & High-Converting Prompts (Parentheses completely removed)
const i18n = {
  am: {
    welcome_header:
`👋 <b>እንኳን ወደ Smart X Ethiopian በደህና መጡ!</b> 🇪🇹

ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ የ <b>Short Note</b>፣ የ <b>Worksheet</b> እና የፈተና ጥያቄዎች ማዕከል።

🌐 <b>እባክዎን ቋንቋዎን ይምረጡ / Please select your language:</b>`,
    select_grade_header:
`🎓 <b>የትምህርት ደረጃህን ምረጥ:</b>

ለክፍልህ የተዘጋጁ አጋዥ የ <b>Short Note</b> ማጠቃለያዎችን እና የ <b>Worksheet</b> ጥያቄዎችን ለማግኘት ክፍልህን ምረጥ ⬇️`,
    grades: [
      { text: '📗 9ኛ ክፍል', id: '9' },
      { text: '📘 10ኛ ክፍል', id: '10' },
      { text: '📙 11ኛ ክፍል', id: '11' },
      { text: '🎓 12ኛ ክፍል', id: '12' }
    ],
    consent_intro: (grade) =>
`✨ <b>ውድ የ ${escapeHtml(grade)} ተማሪ!</b> 🇪🇹

የትምህርት ውጤትህን ለማሳደግ እና የሚከብዱህን ትምህርቶች በቀላሉ እንድትረዳ የሚያስችል ልዩ የጥናት እቅድ እያዘጋጀን ነው።

ለአንተ የሚሆኑ ትክክለኛ የትምህርት ማጠቃለያዎችን እና የፈተና ጥያቄዎችን እንድናዘጋጅልህ <b>5 ፈጣን ጥያቄዎችን</b> ለመመለስ ፍቃደኛ ነህ?`,
    consent_yes: '🚀 አዎ፣ ዝግጁ ነኝ',
    consent_no: '❌ አልፈልግም',
    consent_declined:
`✨ <b>ምንም ችግር የለም!</b>

በማንኛውም ሰዓት የትምህርት ማጠቃለያዎችን እና የፈተና ጥያቄዎችን ለማግኘት ዝግጁ ሲሆኑ ከታች ያለውን አዝራር ይጫኑ ⬇️`,
    consent_retry_btn: '🚀 አሁን ለመጀመር ዝግጁ ነኝ',
    questions: [
      '📚 <b>ደረጃ 1 ከ 5: የትምህርት ምዕራፎች ማጠቃለያ</b>\n\nበክፍል ውስጥ የተማርካቸውን ሰፋፊ የትምህርት ምዕራፎች በደቂቃዎች ውስጥ ከነዋና ዋና ነጥቦቻቸው እንድትከልስ የሚያስችል ጥራት ያለው <b>Short Note</b> ማግኘት ትፈልጋለህ?',
      '📝 <b>ደረጃ 2 ከ 5: ምዕራፍ ተኮር የፈተና ጥያቄዎች እና መልሶች</b>\n\nበትምህርት ቤት ለሚሰጡ ፈተናዎች እና ለብሔራዊ ፈተናዎች በብቃት እንድትዘጋጅ የሚረዱ የተመረጡ <b>Model Worksheets</b> ከነዝርዝር አሰራራቸው ማግኘት ትፈልጋለህ?',
      '💡 <b>ደረጃ 3 ከ 5: አስቸጋሪ እና ውስብስብ ጥያቄዎች ማብራሪያ</b>\n\nበክፍል ውስጥ በሚሰጡ ከበድ ባሉ የትምህርት ፅንሰ ሃሳቦች እና የፈተና ጥያቄዎች ላይ ደረጃ በደረጃ የሚመራህ ግልጽ የጥናት አጋዥ ይፈልጋሉ?',
      '📱 <b>ደረጃ 4 ከ 5: ያለ ኢንተርኔት 100% Offline አጠቃቀም</b>\n\nየኢንተርኔት ኮኔክሽን ወይም የሞባይል ዳታ ሳያስፈልግህ በየትኛውም ቦታ እና በማንኛውም ሰዓት በነፃነት የሚያጠና ዘመናዊ የሞባይል መተግበሪያ መጠቀም ትፈልጋለህ?',
      '🎯 <b>ደረጃ 5 ከ 5: ከፍተኛ የትምህርት ውጤት ግብ</b>\n\nበዚህ የትምህርት ዘመን በክፍልህ እና በሀገር አቀፍ ደረጃ ከፍተኛ ውጤት አስመዝግበህ ወደ ሚቀጥለው ደረጃ በላቀ ውጤት ለማለፍ ቆርጠሃል?'
    ],
    yes: '✅ አዎ፣ በእርግጥ',
    no: '❌ አይ',
    promo_reveal: (name, grade) =>
`🎉 <b>እንኳን ደስ አለህ ${escapeHtml(name)}!</b> 🚀

ለጥያቄዎችህ እና ለጥናት ፍላጎቶችህ ሙሉ መፍትሄ የሆነው <b>Smart X Ethiopian</b> የተባለው ድንቅ የትምህርት ፕላትፎርም መጥቶልሃል!

✨ የ <b>${escapeHtml(grade)}</b> የሁሉንም ትምህርቶች <b>Short Notes</b>፣ <b>Worksheets</b>፣ እና <b>Model Exams</b> በአንድ ላይ የያዘ እና <b>100% Offline</b> ያለ ምንም ኢንተርኔት የሚሰራ ዘመናዊ መተግበሪያ ተዘጋጅቶልሃል!

🗓️ የሚለቀቅበት ቀን: <b>መስከረም 5</b>`,
    how_to_get_btn: '📱 የሞባይል መተግበሪያውን እንዴት አገኛለሁ?',
    register_first_prompt:
`🎁 <b>የሞባይል መተግበሪያውን በነፃ ለማግኘት መጀመሪያ ይመዝገቡ!</b>

የ <b>Smart X Ethiopian</b> መተግበሪያ <b>መስከረም 5</b> ሲለቀቅ መለያዎን በነፃ ለማንቃት እና VIP Early Access ለማግኘት ይህንን ቀላል ደረጃ ይጨርሱ:

1️⃣ የ Smart X ቻናል እና የውይይት ግሩፕ ይቀላቀሉ`,
    channel_step: (grade, channel) => `📢 <b>የ Smart X ቻናል እና ግሩፕ ይቀላቀሉ:</b>\n\nየ <b>${escapeHtml(grade)}</b> የትምህርት መረጃዎችን እና አዳዲስ ማስታወቂያዎችን ለማግኘት <b>@SmartX_Discussion</b> እና <b>@SmartX_Ethio</b> ይቀላቀሉ:`,
    join_channel: '📢 ቻናሉን ተቀላቀል',
    join_group: '👥 ግሩፑን ተቀላቀል',
    verify_channel: '✅ አረጋግጥ',
    channel_joined_alert: '✅ አባልነትዎ ተረጋግጧል!',
    channel_not_joined_alert: (channel) => `⚠️ እባክዎን መጀመሪያ ቻናሉን እና ግሩፑን ይቀላቀሉ!`,
    phone_step: 
`📱 <b>ምዝገባውን ለመጨረስ ስልክ ቁጥርዎን ያጋሩ</b>

የ <b>Smart X Ethiopian</b> መተግበሪያ <b>መስከረም 5</b> ሲለቀቅ መለያዎ በነፃ እንዲነቃ ከታች ያለውን አዝራር ይጫኑ ⬇️`,
    share_contact_btn: '📱 Share',
    notify_prompt: 
`🔔 <b>የሞባይል አፕሊኬሽን ማሳወቂያ</b>

የ <b>Smart X Ethiopian</b> መተግበሪያ በ <b>መስከረም 5</b> ሲለቀቅ ቀድሞ ማሳወቂያ እንዲደርስዎ ይፈልጋሉ?`,
    notify_yes: '🔔 አዎ፣ ይድረሰኝ',
    notify_no: '🔕 አይ፣ አልፈልግም',
    reg_success: (name) => `🎉 <b>እንኳን ደስ አለህ ${escapeHtml(name)}! ምዝገባህ ተጠናቋል!</b> 🚀\n\n📱 <b>Smart X Ethiopian</b> የትምህርት መተግበሪያ <b>መስከረም 5</b> ሲለቀቅ ቀድመው ከሚደርሳቸው ተማሪዎች አንዱ ሆነዋል።\n\nከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,
    welcome_back: (name) => `👋 <b>እንኳን በደህና ተመለሱ ${escapeHtml(name)}!</b> 🇪🇹\n\n📱 <b>Smart X Ethiopian</b> የትምህርት ፕላትፎርም\n\nከታች ካሉት አገልግሎቶች አንዱን ይምረጡ ⬇️`,
    menu: [
      ['🔗 ለጓደኞች አጋራ', '⚙️ ቅንብሮች'],
      ['📞 እገዛ እና ግንኙነት']
    ],
    share_title: '🔗 <b>ጓደኞችን ጋብዝ — Smart X Ethiopian</b> 🇪🇹',
    share_desc: (count, points, link) =>
`🎁 <b>የጓደኞች መጋበዣ ፕሮግራም:</b>

ጓደኞችህን በመጋበዝ የ <b>Smart X Ethiopian VIP Early Access</b> እና ነጥቦችን ሰብስብ!

• 👥 <b>የተጋበዙ ተማሪዎች:</b> <code>${count}</code>
• ⭐️ <b>ያገኙት ነጥብ:</b> <code>${points} pts</code>

🔗 <b>የእርስዎ የመጋበዣ ሊንክ:</b>
<code>${link}</code>

ከታች ያለውን አዝራር በመጫን ለጓደኞችህ ወይም በግሩፖች አጋራ!`,
    share_btn: '📲 ለጓደኞች አጋራ',
    settings_title: '⚙️ <b>የተጠቃሚ ቅንብሮች እና መረጃ</b>',
    profile_card: (user) =>
`👤 <b>የተጠቃሚ መረጃ:</b>
━━━━━━━━━━━━━━━━━━━━
• <b>ስም:</b> ${escapeHtml(user.full_name || 'ተማሪ')}
• <b>ክፍል:</b> <code>${escapeHtml(user.grade || '10ኛ ክፍል')}</code>
• <b>ቋንቋ:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'አማርኛ'}</code>
• <b>ማሳወቂያ:</b> <code>${user.app_notification ? '🔔 የበራ' : '🔕 የጠፋ'}</code>
• <b>ነጥብ:</b> <code>${user.points || 0} pts (${user.referral_count || 0} የተጋበዙ)</code>
━━━━━━━━━━━━━━━━━━━━
የሚፈልጉትን ማስተካከያ ይምረጡ ⬇️`,
    change_lang_btn: '🌐 ቋንቋ ቀይር',
    change_grade_btn: '🎓 ክፍል ቀይር',
    toggle_notify_btn: (status) => status ? '🔕 ማሳወቂያ አጥፋ' : '🔔 ማሳወቂያ አብራ',
    notify_enabled_alert: '🔔 የማሳወቂያ ፈቃድ በርቷል!',
    notify_disabled_alert: '🔕 ማሳወቂያ ጠፍቷል!',
    lang_updated_msg: '✅ <b>ቋንቋ በተሳካ ሁኔታ ተቀይሯል!</b>',
    grade_updated_msg: (grade) => `✅ ክፍል ተቀይሯል: <b>${escapeHtml(grade)}</b>`,
    back_to_menu_btn: '🔙 ወደ ዋናው ማውጫ',
    back_btn: '🔙 ተመለስ',
    help_title: '📞 <b>እገዛ እና ግንኙነት — Smart X Ethiopian</b> 🇪🇹',
    help_body:
`📱 <b>ስለ Smart X Ethiopian የሞባይል አፕሊኬሽን:</b>

<b>Smart X Ethiopian</b> ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ ዘመናዊ የትምህርት መተግበሪያ ነው።

✨ <b>ዋና ዋና አገልግሎቶች:</b>
• 📚 የሁሉንም ትምህርቶች አጫጭር ማጠቃለያዎች Short Notes
• 📝 የሞዴል ፈተናዎች እና የ Worksheet ጥያቄዎች ከነመልሶቻቸው
• ⚡ <b>100% Offline</b> — ያለ ምንም ኢንተርኔት በነፃ ይሰራል
• 🎯 ለአዲሱ ካሪኩለም በልዩ ጥራት የተዘጋጀ

🗓️ <b>የሚለቀቅበት ቀን:</b> <b>መስከረም 5</b>

💬 <b>እገዛ ወይም ጥያቄ ካለዎት:</b>
• 📢 ኦፊሴላዊ ቻናል: @SmartX_Discussion
• 👥 የውይይት ግሩፕ: @SmartX_Ethio
• 👨‍💻 የደንበኞች አገልግሎት: @smart_x_help`,
    contact_admin_btn: '👨‍💻 ድጋፍ አግኝ',
    join_channel_btn: '📢 ቻናሉን ተቀላቀል',
    ref_notification: (name, points, total) => `🎉 <b>አዲስ ተማሪ በጥቆማዎ ተመዝግቧል!</b>\n\n• 👤 <b>ተማሪ:</b> ${escapeHtml(name)}\n• 🎁 <b>ነጥብ:</b> <code>+10 pts</code> (ጠቅላላ: ${points} pts / ${total} ተማሪዎች)`
  },
  en: {
    welcome_header:
`👋 <b>Welcome to Smart X Ethiopian!</b> 🇪🇹

All-in-one educational hub for Grade 9-12 Ethiopian students offering <b>Short Notes</b>, <b>Worksheets</b>, and Model Exams.

🌐 <b>Please select your language:</b>`,
    select_grade_header:
`🎓 <b>Select Your Academic Grade:</b>

Choose your grade to unlock tailored <b>Short Notes</b> and <b>Worksheet Questions</b> ⬇️`,
    grades: [
      { text: '📗 Grade 9', id: '9' },
      { text: '📘 Grade 10', id: '10' },
      { text: '📙 Grade 11', id: '11' },
      { text: '🎓 Grade 12', id: '12' }
    ],
    consent_intro: (grade) =>
`✨ <b>Dear ${escapeHtml(grade)} Student!</b> 🇪🇹

We are preparing an exclusive study platform to help you master challenging subjects and achieve top academic grades.

To help us tailor the most effective Short Notes and Exam Worksheets for your grade, are you willing to answer <b>5 quick questions</b>?`,
    consent_yes: '🚀 Yes, I am ready',
    consent_no: '❌ No, Skip',
    consent_declined:
`✨ <b>No problem at all!</b>

Whenever you are ready to explore tailored Short Notes and Exam materials, click the button below ⬇️`,
    consent_retry_btn: '🚀 I am ready now',
    questions: [
      '📚 <b>Step 1 of 5: Concise Chapter Summaries</b>\n\nDo you want to access comprehensive <b>Short Notes</b> that summarize lengthy textbook chapters with core concepts and key formulas in minutes?',
      '📝 <b>Step 2 of 5: Chapter Worksheets and Model Exams</b>\n\nDo you want to practice selected <b>Model Exams</b> and <b>Chapter Worksheets</b> equipped with step-by-step detailed explanations and answer keys?',
      '💡 <b>Step 3 of 5: Mastering Complex Concepts</b>\n\nDo you need clear step-by-step guidance to easily solve difficult concepts and complex exam problems without getting stuck?',
      '📱 <b>Step 4 of 5: 100% Offline Study Capability</b>\n\nDo you want to use a modern mobile app that functions <b>100% Offline</b> anywhere and anytime without needing an active internet connection?',
      '🎯 <b>Step 5 of 5: Achieving Top Academic Score</b>\n\nAre you fully dedicated to achieving the highest score and top GPA in your school and national exams this academic year?'
    ],
    yes: '✅ Yes, definitely',
    no: '❌ No',
    promo_reveal: (name, grade) =>
`🎉 <b>Congratulations ${escapeHtml(name)}!</b> 🚀

The ultimate solution for your academic success, <b>Smart X Ethiopian</b> educational platform is here for you!

✨ Packed with <b>${escapeHtml(grade)}</b> <b>Short Notes</b>, <b>Worksheets</b>, and <b>Model Exams</b> that work <b>100% Offline</b> without internet.

🗓️ Official Launch Date: <b>September 15</b>`,
    how_to_get_btn: '📱 How can I get the mobile application?',
    register_first_prompt:
`🎁 <b>Pre-register now to receive the mobile app for free!</b>

When <b>Smart X Ethiopian</b> launches on <b>September 15</b>, complete this quick step to activate your VIP Early Access:

1️⃣ Join our official discussion channel and community group`,
    channel_step: (grade, channel) => `📢 <b>Join Channel & Discussion Group:</b>\n\nJoin <b>@SmartX_Discussion</b> and <b>@SmartX_Ethio</b> to receive all ${escapeHtml(grade)} announcements and updates:`,
    join_channel: '📢 Join Channel',
    join_group: '👥 Join Group',
    verify_channel: '✅ Verify',
    channel_joined_alert: '✅ Membership confirmed!',
    channel_not_joined_alert: (channel) => `⚠️ Please join both the channel and group first!`,
    phone_step: 
`📱 <b>Share your phone number to complete registration</b>

Click the button below to activate your free account when <b>Smart X Ethiopian</b> launches on <b>September 15</b> ⬇️`,
    share_contact_btn: '📱 Share',
    notify_prompt: 
`🔔 <b>Mobile App Release Notification</b>

Would you like to receive an instant notification when the <b>Smart X Ethiopian</b> app launches on <b>September 15</b>?`,
    notify_yes: '🔔 Yes, Notify Me',
    notify_no: '🔕 No, Skip',
    reg_success: (name) => `🎉 <b>Congratulations ${escapeHtml(name)}! Registration Completed!</b> 🚀\n\nYou are now pre-registered for VIP early access to <b>Smart X Ethiopian</b> launching on <b>September 15</b>.\n\nChoose an option below ⬇️`,
    welcome_back: (name) => `👋 <b>Welcome back ${escapeHtml(name)}!</b> 🇪🇹\n\n📱 <b>Smart X Ethiopian</b> Educational Platform\n\nChoose an option below ⬇️`,
    menu: [
      ['🔗 Share with Friends', '⚙️ Settings'],
      ['📞 Help & Support']
    ],
    share_title: '🔗 <b>Invite Friends — Smart X Ethiopian</b> 🇪🇹',
    share_desc: (count, points, link) =>
`🎁 <b>Referral & Rewards Program:</b>

Invite friends to join and earn <b>Smart X VIP Early Access</b> and bonus points!

• 👥 <b>Friends Invited:</b> <code>${count}</code>
• ⭐️ <b>Points Earned:</b> <code>${points} pts</code>

🔗 <b>Your Personal Invite Link:</b>
<code>${link}</code>

Click the button below to share with your friends or study groups!`,
    share_btn: '📲 Share with Friends',
    settings_title: '⚙️ <b>Settings & Profile Info</b>',
    profile_card: (user) =>
`👤 <b>Student Profile:</b>
━━━━━━━━━━━━━━━━━━━━
• <b>Name:</b> ${escapeHtml(user.full_name || 'Student')}
• <b>Grade:</b> <code>${escapeHtml(user.grade || 'Grade 10')}</code>
• <b>Language:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'Amharic'}</code>
• <b>Notification:</b> <code>${user.app_notification ? '🔔 Enabled' : '🔕 Disabled'}</code>
• <b>Points:</b> <code>${user.points || 0} pts (${user.referral_count || 0} invites)</code>
━━━━━━━━━━━━━━━━━━━━
Choose a setting to modify ⬇️`,
    change_lang_btn: '🌐 Change Language',
    change_grade_btn: '🎓 Change Grade',
    toggle_notify_btn: (status) => status ? '🔕 Disable Notification' : '🔔 Enable Notification',
    notify_enabled_alert: '🔔 Notification enabled!',
    notify_disabled_alert: '🔕 Notification disabled!',
    lang_updated_msg: '✅ <b>Language successfully updated!</b>',
    grade_updated_msg: (grade) => `✅ Grade updated: <b>${escapeHtml(grade)}</b>`,
    back_to_menu_btn: '🔙 Back to Menu',
    back_btn: '🔙 Back',
    help_title: '📞 <b>Help & Support — Smart X Ethiopian</b> 🇪🇹',
    help_body:
`📱 <b>About Smart X Ethiopian Mobile App:</b>

<b>Smart X Ethiopian</b> is a comprehensive educational app designed specifically for Grades 9-12 New Curriculum students.

✨ <b>Key Features:</b>
• 📚 Chapter-by-Chapter Short Notes for all subjects
• 📝 Model Exams and Practice Worksheets with answers
• ⚡ <b>100% Offline</b> — Works seamlessly without internet connection
• 🎯 High quality aligned with the new Ethiopian curriculum

🗓️ <b>Launch Date:</b> <b>September 15</b>

💬 <b>Need Help or Have Questions?</b>
• 📢 Official Channel: @SmartX_Discussion
• 👥 Community Group: @SmartX_Ethio
• 👨‍💻 Support Admin: @smart_x_help`,
    contact_admin_btn: '👨‍💻 Contact Support',
    join_channel_btn: '📢 Join Channel',
    ref_notification: (name, points, total) => `🎉 <b>A new student joined using your invite link!</b>\n\n• 👤 <b>Student:</b> ${escapeHtml(name)}\n• 🎁 <b>Reward:</b> <code>+10 pts</code> (Total: ${points} pts / ${total} students)`
  },
  om: {
    welcome_header:
`👋 <b>Baga nagaan gara Smart X Ethiopian dhuftan!</b> 🇪🇹

Wiirtuu barattoota Kutaa 9-12tiif <b>Cuunfaa Barumsaa</b> fi <b>Gaaffilee Worksheet</b> qopheesse.

🌐 <b>Afaan keessan filadhaa / Please select your language:</b>`,
    select_grade_header:
`🎓 <b>Kutaa Barumsaa Keessan Filadhaa:</b>

Cuunfaa barumsaa fi gaaffilee worksheet kutaa keessaniif qophaa'e argachuuf filadhaa ⬇️`,
    grades: [
      { text: '📗 Kutaa 9', id: '9' },
      { text: '📘 Kutaa 10', id: '10' },
      { text: '📙 Kutaa 11', id: '11' },
      { text: '🎓 Kutaa 12', id: '12' }
    ],
    consent_intro: (grade) =>
`✨ <b>Barataa ${escapeHtml(grade)} Kabajamaa!</b> 🇪🇹

Qabxii barumsa keetii guddisuufi gosa barnootaa sitti ulfaatan salphaatti akka hubattuuf sagantaa qo'annoo addaa qopheessaa jirra.

Cuunfaa barumsaafi gaaffilee qorumsaa sirrii ta'an akka siif qopheessinuuf <b>gaaffilee gabaaboo 5</b> deebisuuf eeyyamamaadhaa?`,
    consent_yes: '🚀 Eeyyee, Qophiidha',
    consent_no: '❌ Lakki',
    consent_declined:
`✨ <b>Rakkina hin qabu!</b>

Yeroo barbaaddanitti cuunfaa barumsaafi qophii qorumsaa argachuuf qabduu armaan gadii tuqaa ⬇️`,
    consent_retry_btn: '🚀 Amma Qophiidha',
    questions: [
      '📚 <b>Sadarkaa 1 / 5: Cuunfaa Boqonnaa Barumsaa</b>\n\nBoqonnaa barnootaa bal\'aa ta\'an qabxiilee ijoo isaanii waliin daqiiqaa muraasa keessatti akka irra deebitee qo\'attuuf <b>Cuunfaa Barumsaa</b> qulqullina qabu argachuu barbaaddaa?',
      '📝 <b>Sadarkaa 2 / 5: Gaaffilee Qorumsaa fi Worksheet</b>\n\nQorumsa manneen barnootaafi qorumsa biyyaalessaaf of qopheessuuf gaaffilee <b>Worksheet</b> filatamoo deebii fi ibsa bal\'aa waliin argachuu barbaaddaa?',
      '💡 <b>Sadarkaa 3 / 5: Gaaffilee Coccimoo Hubachuu</b>\n\nQabxiilee barnootaa ulfaatoo ta\'an fi gaaffilee qorumsaa ciccimoo salphaatti akka hojjettuuf gargaarsa tartiiba qabu argachuu barbaaddaa?',
      '📱 <b>Sadarkaa 4 / 5: Intarneetiin Ala Hojjechuu</b>\n\nKonnokshinii intarneetii tokko malee bakka kamittuu fi yeroo kamittuu bilisaan akka qo\'attuuf appilikeeshinii <b>100% Offline</b> ta\'e fayyadamuu barbaaddaa?',
      '🎯 <b>Sadarkaa 5 / 5: Qabxii Olaanaa Fiduuf Kutannoo</b>\n\nBara barnootaa kanatti daree keessatti fi qorumsa biyyaalessaa irratti qabxii olaanaa fiduun milkaa\'ina guddaa galmeessuuf qophiidhaa?'
    ],
    yes: '✅ Eeyyee, Dhuguma',
    no: '❌ Lakki',
    promo_reveal: (name, grade) =>
`🎉 <b>Baga gammaddan ${escapeHtml(name)}!</b> 🚀

Fedhii fi gaaffilee keessaniif furmaata guutuu kan ta'e <b>Smart X Ethiopian</b> wiirtuun barnootaa addaa isiniif dhufeera!

✨ Cuunfaa barumsaa <b>${escapeHtml(grade)}</b>, gaaffilee <b>Worksheet</b> fi qorumsa moodeelaa <b>100% Offline</b> ta'een qophaa'ee isiniif dhiyaateera!

🗓️ Guyyaa Gadhiifamu: <b>Fulbaana 5</b>`,
    how_to_get_btn: '📱 Appilikeeshinii akkamittan argadha?',
    register_first_prompt:
`🎁 <b>Appilikeeshinii moobaayilaa bilisaan argachuuf dura galmaa'aa!</b>

Appilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5</b> gadhiifamu tajaajila VIP bilisaan banachuuf sadarkaa kana xumuraa:

1️⃣ Chaanaalii fi garee marii Smart X seenaa`,
    channel_step: (grade, channel) => `📢 <b>Chaanaalii fi Garee Seenaa:</b>\n\nOodeeffannoo fi qophii ${escapeHtml(grade)} hunda argachuuf <b>@SmartX_Discussion</b> fi <b>@SmartX_Ethio</b> seenaa:`,
    join_channel: '📢 Chaanaalii Seeni',
    join_group: '👥 Garee Seeni',
    verify_channel: '✅ Mirkaneessi',
    channel_joined_alert: '✅ Garee seenuun keessan mirkanaa\'eera!',
    channel_not_joined_alert: (channel) => `⚠️ Mee dura chaanaalii fi garee seenaa!`,
    phone_step: 
`📱 <b>Galmee xumuruuf lakkoofsa bilbilaa keessan ergaa</b>

Appilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5</b> gadhiifamu tajaajila VIP bilisaan banachuuf qabduu armaan gadii tuqaa ⬇️`,
    share_contact_btn: '📱 Share',
    notify_prompt: 
`🔔 <b>Beeksisa Appilikeeshinii</b>

Appilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5</b> gadhiifamu beeksisni akka isin ga'u barbaadduu?`,
    notify_yes: '🔔 Eeyyee, Na Ga\'i',
    notify_no: '🔕 Lakki, Hin Barbaadu',
    reg_success: (name) => `🎉 <b>Baga gammaddan ${escapeHtml(name)}! Galmeen keessan xumurameera!</b> 🚀\n\nAppilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5</b> gadhiifamu carraa addaa argattu.\n\nTajaajiloota armaan gadii filadhaa ⬇️`,
    welcome_back: (name) => `👋 <b>Baga nagaan deebitan ${escapeHtml(name)}!</b> 🇪🇹\n\n📱 <b>Smart X Ethiopian</b> Tajaajila Barnootaa\n\nTajaajiloota armaan gadii filadhaa ⬇️`,
    menu: [
      ['🔗 Hiriyyootaaf Qoodi', '⚙️ Qindaa\'inoota'],
      ['📞 Gargaarsa & Quunnamtii']
    ],
    share_title: '🔗 <b>Hiriyyoota Waami — Smart X Ethiopian</b> 🇪🇹',
    share_desc: (count, points, link) =>
`🎁 <b>Sagantaa Hiriyyoota Afeeruu:</b>

Hiriyyoota keessan afeeruun qabxii fi carraa <b>Smart X VIP Early Access</b> argadhaa!

• 👥 <b>Hiriyyoota Afeeraman:</b> <code>${count}</code>
• ⭐️ <b>Qabxii Argitan:</b> <code>${points} pts</code>

🔗 <b>Liinkii Afeertee Keessan:</b>
<code>${link}</code>

Qabduu armaan gadii tuquun hiriyyootaaf qoodaa!`,
    share_btn: '📲 Hiriyyootaaf Qoodi',
    settings_title: '⚙️ <b>Qindaa\'inoota & Profaayilii</b>',
    profile_card: (user) =>
`👤 <b>Oodeeffannoo Barataa:</b>
━━━━━━━━━━━━━━━━━━━━
• <b>Maqaa:</b> ${escapeHtml(user.full_name || 'Barataa')}
• <b>Kutaa:</b> <code>${escapeHtml(user.grade || 'Kutaa 10')}</code>
• <b>Afaan:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'Amharic'}</code>
• <b>Beeksisa:</b> <code>${user.app_notification ? '🔔 Kan Baname' : '🔕 Kan Cufame'}</code>
• <b>Qabxii:</b> <code>${user.points || 0} pts (${user.referral_count || 0} afeeraman)</code>
━━━━━━━━━━━━━━━━━━━━
Qindaa'ina jijjiiruu barbaaddan filadhaa ⬇️`,
    change_lang_btn: '🌐 Afaan Jijjiiri',
    change_grade_btn: '🎓 Kutaa Jijjiiri',
    toggle_notify_btn: (status) => status ? '🔕 Beeksisa Cufi' : '🔔 Beeksisa Bani',
    notify_enabled_alert: '🔔 Beeksisni banameera!',
    notify_disabled_alert: '🔕 Beeksisni cufameera!',
    lang_updated_msg: '✅ <b>Afaan milkaa\'inaan jijjiirameera!</b>',
    grade_updated_msg: (grade) => `✅ Kutaan jijjiirameera: <b>${escapeHtml(grade)}</b>`,
    back_to_menu_btn: '🔙 Gara Menuutti',
    back_btn: '🔙 Duubatti',
    help_title: '📞 <b>Gargaarsa & Quunnamtii — Smart X Ethiopian</b> 🇪🇹',
    help_body:
`📱 <b>Waa'ee Appilikeeshinii Smart X Ethiopian:</b>

<b>Smart X Ethiopian</b> appilikeeshinii barattoota Kutaa 9-12tiif qophaa'ee dha.

✨ <b>Faayidaalee Ijoo:</b>
• 📚 Cuunfaa barumsaa Short Notes gosa barnoota hundaaf
• 📝 Qorumsa moodeelaa fi gaaffilee Worksheet deebii waliin
• ⚡ <b>100% Offline</b> — Intarneetii malee guutummaatti hojjeta
• 🎯 Sirna barnootaa haaraa Itoophiyaatiif qulqullinaan kan qophaa'e

🗓️ <b>Guyyaa Gadhiifamu:</b> <b>Fulbaana 5</b>

💬 <b>Gaaffii yoo qabaattan:</b>
• 📢 Chaanaalii: @SmartX_Discussion
• 👥 Garee Maree: @SmartX_Ethio
• 👨‍💻 Tajaajila Maamiltootaa: @smart_x_help`,
    contact_admin_btn: '👨‍💻 Gargaarsa Argadhu',
    join_channel_btn: '📢 Chaanaalii Seeni',
    ref_notification: (name, points, total) => `🎉 <b>Barataan haaraan liinkii keessaniin galmaa'eera!</b>\n\n• 👤 <b>Barataa:</b> ${escapeHtml(name)}\n• 🎁 <b>Qabxii:</b> <code>+10 pts</code> (Waliigala: ${points} pts / ${total} barattoota)`
  }
};

// Helper: Get user's saved or session language
async function getUserLang(userId, env) {
  if (userStates[userId]?.lang) return userStates[userId].lang;
  for (const k of Object.keys(userStates)) {
    if ((userStates[k]?.data?.telegramId === userId || Number(k) === Number(userId)) && userStates[k]?.lang) {
      return userStates[k].lang;
    }
  }
  if (registeredUsers[userId]?.language) return registeredUsers[userId].language;
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

  return configuredAdmins.includes(uidStr) || uidStr === '12345678' || uidStr === '7486847253';
}

// Helper: Seamlessly transition to next step (edit in place or clear previous for minimal screen clutter)
async function transitionToNewStep(ctx, nextText, extra = {}) {
  const isReplyKeyboard = Boolean(extra?.reply_markup && (extra.reply_markup.keyboard || extra.reply_markup.remove_keyboard));

  // If this step is triggered from an inline button callback query
  if (ctx.callbackQuery?.message) {
    if (!isReplyKeyboard) {
      // Seamlessly edit existing message in place
      try {
        return await ctx.editMessageText(nextText, {
          parse_mode: 'HTML',
          disable_web_page_preview: true,
          ...extra
        });
      } catch (err) {
        // If edit fails (e.g. content identical or expired), clean up and reply
        try {
          await ctx.deleteMessage().catch(() => {});
        } catch (e) {}
      }
    } else {
      // Switching to Reply Keyboard -> delete old inline message so chat stays clean
      try {
        await ctx.deleteMessage().catch(() => {});
      } catch (e) {}
    }
  }

  // Send new message
  try {
    return await ctx.reply(nextText, {
      parse_mode: 'HTML',
      disable_web_page_preview: true,
      ...extra
    });
  } catch (err) {
    console.warn('[transitionToNewStep error]:', err.message);
    return null;
  }
}

// ==========================================
// TELEGRAM POLL & QUIZ SYSTEM FOR CHANNELS/GROUPS
// ==========================================

async function getEffectiveGeminiKey(apiKey, env) {
  const sanitize = (k) => (typeof k === 'string' ? k.replace(/["']/g, '').trim() : '');

  // 1. Explicit argument
  const argKey = sanitize(apiKey);
  if (argKey.length > 10) return argKey;

  // 2. Cloudflare Worker Environment Secret bindings (Free & Paid Dashboard Settings)
  const cloudflareCandidates = [
    env?.GEMINI_API_KEY,
    env?.GEMINI_API_KEYS,
    env?.GEMINI_KEY,
    env?.GOOGLE_GEMINI_API_KEY,
    env?.GEMINI_TOKEN,
    env?.AI_API_KEY
  ];
  for (const raw of cloudflareCandidates) {
    if (raw && typeof raw === 'string') {
      const clean = sanitize(raw.split(',')[0]);
      if (clean.length > 10) return clean;
    }
  }

  // 3. Dynamic DB Config (set via /set_gemini_key in Telegram bot)
  const dynKey = sanitize(await getDynamicConfig(env, 'gemini_api_key'));
  if (dynKey.length > 10) return dynKey;

  // 4. Node.js process.env (Local Dev Server / Polling Mode)
  if (typeof process !== 'undefined' && process.env) {
    const procCandidates = [
      process.env.GEMINI_API_KEY,
      process.env.GEMINI_API_KEYS,
      process.env.GEMINI_KEY,
      process.env.GOOGLE_GEMINI_API_KEY,
      process.env.AI_API_KEY
    ];
    for (const raw of procCandidates) {
      if (raw && typeof raw === 'string') {
        const clean = sanitize(raw.split(',')[0]);
        if (clean.length > 10) return clean;
      }
    }
  }

  return null;
}

async function callGeminiRest(prompt, apiKey, modelName = 'gemini-3.1-flash-lite') {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json'
      }
    })
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} from Gemini REST (${modelName}): ${errText.substring(0, 120)}`);
  }

  const data = await res.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) throw new Error(`Empty text response from Gemini REST (${modelName})`);
  return rawText;
}

let cachedGenAI = null;
let lastApiKey = null;
function getGenAI(apiKey) {
  if (!apiKey) return null;
  if (cachedGenAI && lastApiKey === apiKey) return cachedGenAI;
  try {
    cachedGenAI = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build'
        }
      }
    });
    lastApiKey = apiKey;
    return cachedGenAI;
  } catch (err) {
    console.warn('[GoogleGenAI Init Warning]:', err.message);
    return null;
  }
}

// Helper: Parse manual poll format written by admin
function parseCustomPollFormat(rawText) {
  if (!rawText || typeof rawText !== 'string') return null;
  const lines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 3) return null;

  const optionRegex = /^([A-Da-d0-9]|[①-⑩]|[\*\-\•])[\.\)\:\-]?\s+(.+)$/;
  let questionLines = [];
  let options = [];
  let correctIndex = 0;
  let explanation = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line is explanation
    const expMatch = line.match(/^(?:ማብራሪያ|Explanation|መልስ|Answer)[\:\-]\s*(.+)$/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
      continue;
    }

    const optMatch = line.match(optionRegex);
    if (optMatch) {
      let optText = optMatch[2].trim();
      // Check if marked with asterisk (*) or (correct) or (ትክክል)
      const isCorrect = optText.includes('*') || /\(correct\)|\(ትክክል\)|\[x\]/i.test(optText);
      optText = optText.replace(/\*|\(correct\)|\(ትክክል\)|\[x\]/gi, '').trim();
      if (isCorrect) {
        correctIndex = options.length;
      }
      options.push(optText.substring(0, 95));
    } else {
      if (options.length === 0) {
        questionLines.push(line);
      } else if (!explanation) {
        explanation = line.substring(0, 195);
      }
    }
  }

  if (options.length >= 2) {
    let question = questionLines.join(' ').replace(/^ጥያቄ[\:\-]\s*/i, '').trim();
    if (!question) question = 'Academic Quiz Question';
    if (!explanation) {
      explanation = `ትክክለኛው መልስ አማራጭ ${String.fromCharCode(65 + correctIndex)} (${options[correctIndex]}) ነው።`;
    }
    return {
      question: question.substring(0, 295),
      options: options.slice(0, 10),
      correct_option_id: correctIndex < options.length ? correctIndex : 0,
      explanation: explanation.substring(0, 195)
    };
  }

  return null;
}

// Helper: Clean question text to strictly remove any bracket prefixes like [Grade 10 Biology] or [10ኛ ክፍል]
function cleanQuestionText(raw) {
  if (!raw || typeof raw !== 'string') return '';
  return raw
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/^\([^\)]+\)\s*/g, '')
    .replace(/^【[^】]+】\s*/g, '')
    .replace(/^#\w+\s*/g, '')
    .replace(/^(?:Question|ጥያቄ)[\:\-]\s*/i, '')
    .trim();
}

// Helper: Generate dynamic Quiz using Gemini (Prioritizing gemini-3.1-flash-lite and gemini-3.6-flash)
async function generateQuizWithGemini(topic, langMode = 'auto', apiKey, env) {
  const effectiveKey = await getEffectiveGeminiKey(apiKey, env);
  if (!effectiveKey) {
    console.warn('[Gemini Quiz] No API key available');
    return null;
  }

  let langDirective = '';
  if (langMode === 'english' || langMode === 'en') {
    langDirective = `
LANGUAGE SPECIFICATION (100% COMPLETE ENGLISH):
- The question MUST be written in clear, academic English.
- ALL 4 options MUST be written in English.
- The educational explanation MUST be in English.
- CRITICAL RULE: DO NOT put any bracket tags like [Grade 10 Biology] or [Physics] in the question. Start directly with the question text.`;
  } else if (langMode === 'amharic' || langMode === 'am') {
    langDirective = `
LANGUAGE SPECIFICATION (100% COMPLETE AMHARIC / አማርኛ):
- ጥያቄው ሙሉ በሙሉ በአማርኛ (Amharic) መጻፍ አለበት።
- ሁሉም 4ቱ ምርጫዎች በአማርኛ መጻፍ አለባቸው።
- ትምህርታዊ ማብራሪያው (Explanation) ሙሉ በሙሉ በአማርኛ መጻፍ አለበት።
- ጥብቅ ደንብ: በጥያቄው መጀመሪያ ላይ ምንም አይነት ቅንፍ ወይም ታግ (እንደ [10ኛ ክፍል ባዮሎጂ]) በፍፁም አታስገቡ። ጥያቄውን በቀጥታ ጀምሩ።`;
  } else {
    // Auto mode
    const isTopicAmharic = /[\u1200-\u137F]/.test(topic) && !/(grade|physics|chemistry|biology|math|english|vector|force|energy|velocity)/i.test(topic);
    if (isTopicAmharic) {
      langDirective = `
LANGUAGE SPECIFICATION (AMHARIC):
- ጥያቄው፣ 4ቱ ምርጫዎች እና ማብራሪያው በአማርኛ (Amharic) ይሁኑ።
- ምንም አይነት ቅንፍ (እንደ [ክፍል ...]) በጥያቄው መጀመሪያ ላይ አታስገቡ። ጥያቄውን በቀጥታ ጀምሩ።`;
    } else {
      langDirective = `
LANGUAGE SPECIFICATION (ENGLISH):
- The question and ALL 4 options MUST be in clear, academic English.
- The educational explanation should be clear and concise in English.
- CRITICAL RULE: DO NOT put any bracket tags like [Grade 10 Biology] in the question. Start directly with the question text.`;
    }
  }

  const prompt = `You are an expert Ethiopian secondary school educational curriculum examiner.
Generate ONE challenging multiple-choice quiz question with 4 options, the 0-based index of the correct option, and a clear educational explanation for the following topic/subject: "${topic}".

${langDirective}

Formatting Constraints:
1. question: Clear and direct under 280 characters. Never include bracket prefixes like [Grade 10 Biology].
2. options: Exactly 4 distinct multiple-choice options (A, B, C, D). Keep each option under 90 characters.
3. correct_option_id: Integer 0, 1, 2, or 3 pointing to the correct option.
4. explanation: Clear educational explanation why that option is correct, under 180 characters.

Return ONLY a valid JSON object with keys:
{
  "question": "string",
  "options": ["string", "string", "string", "string"],
  "correct_option_id": 0,
  "explanation": "string"
}`;

  function parseAndValidateJson(rawText) {
    if (!rawText || typeof rawText !== 'string') return null;
    const cleanJson = rawText.trim().replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    try {
      let parsed = JSON.parse(cleanJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        parsed = parsed[0];
      }
      if (parsed && parsed.question && Array.isArray(parsed.options) && parsed.options.length >= 2) {
        return {
          question: cleanQuestionText(String(parsed.question)).substring(0, 295),
          options: parsed.options.slice(0, 4).map(o => String(o).substring(0, 95)),
          correct_option_id: (typeof parsed.correct_option_id === 'number' && parsed.correct_option_id >= 0 && parsed.correct_option_id < parsed.options.length) ? parsed.correct_option_id : 0,
          explanation: String(parsed.explanation || '').substring(0, 195)
        };
      }
    } catch (e) {}
    return null;
  }

  // 1. Direct REST fetch with gemini-3.1-flash-lite (stable, fast, reliable)
  try {
    const rawRest = await callGeminiRest(prompt, effectiveKey, 'gemini-3.1-flash-lite');
    const valid = parseAndValidateJson(rawRest);
    if (valid) return valid;
  } catch (restErr) {
    console.warn('[Gemini REST gemini-3.1-flash-lite Warning]:', restErr.message);
  }

  // 2. Direct REST fetch with gemini-3.6-flash
  try {
    const rawRest2 = await callGeminiRest(prompt, effectiveKey, 'gemini-3.6-flash');
    const valid2 = parseAndValidateJson(rawRest2);
    if (valid2) return valid2;
  } catch (restErr2) {
    console.warn('[Gemini REST gemini-3.6-flash Warning]:', restErr2.message);
  }

  // 3. Fallback to GoogleGenAI SDK (gemini-3.1-flash-lite)
  const ai = getGenAI(effectiveKey);
  if (ai) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: prompt,
        config: {
          responseMimeType: 'application/json'
        }
      });
      const valid = parseAndValidateJson(response?.text);
      if (valid) return valid;
    } catch (sdkErr) {
      console.warn('[GoogleGenAI SDK Quiz Warning]:', sdkErr.message);
    }
  }

  return null;
}

// Helper: Unified Quiz Generator (100% Dynamic Gemini AI - Sample Questions Removed)
async function getOrGenerateQuiz(topic, langMode = 'auto', env) {
  const effectiveKey = await getEffectiveGeminiKey(null, env);
  const aiQuiz = await generateQuizWithGemini(topic, langMode, effectiveKey, env);
  return aiQuiz;
}

// Helper: Render Main Poll & Quiz Management Hub
async function renderPollManagerDashboard(ctx, env) {
  const channelHandle = await getDynamicConfig(env, 'poll_channel', await getDynamicConfig(env, 'official_channel', '@SmartX_Discussion'));
  const groupHandle = await getDynamicConfig(env, 'poll_group', await getDynamicConfig(env, 'discussion_group', '@SmartX_Ethio'));

  let totalPollsDispatched = inMemoryDispatchedPolls.length;
  if (env?.DB) {
    try {
      const pRes = await env.DB.prepare('SELECT COUNT(*) as cnt FROM channel_polls').first();
      if (pRes?.cnt) totalPollsDispatched = Math.max(totalPollsDispatched, pRes.cnt);
    } catch (e) {}
  }

  const text =
`🎯 <b>የቴሌግራም ፖል ኩዊዝ ማዘጋጃ (Quiz Poll Dispatcher)</b> 🇪🇹
━━━━━━━━━━━━━━━━━━━━
በዚህ ክፍል ለ <b>${escapeHtml(channelHandle)}</b> ቻናል እና ለ <b>${escapeHtml(groupHandle)}</b> ግሩፕ በቀጥታ የቴሌግራም Quiz ጥያቄዎችን በፖል ማዘጋጀት እና መልቀቅ ይችላሉ።

• 📊 <b>እስካሁን የተለቀቁ ፖሎች:</b> <code>${totalPollsDispatched}</code>
• 📢 <b>ዒላማ ቻናል:</b> <code>${escapeHtml(channelHandle)}</code>
• 👥 <b>ዒላማ ግሩፕ:</b> <code>${escapeHtml(groupHandle)}</code>

📌 <b>ቀጥታ ትዕዛዝ:</b>
• <code>/quiz en &lt;ርዕስ&gt;</code> — ሙሉ በሙሉ በእንግሊዝኛ (100% English)
• <code>/quiz am &lt;ርዕስ&gt;</code> — ሙሉ በሙሉ በአማርኛ (100% አማርኛ)
• <code>/quiz &lt;ርዕስ&gt;</code> — ምሳሌ: <code>/quiz Grade 10 Physics motion</code>

ከታች ካሉት አማራጮች አንዱን ፈጥነው ይጫኑ ⬇️`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🇬🇧 ሙሉ English Mode', 'quiz_quick_mode_en'),
      Markup.button.callback('🇪🇹 ሙሉ አማርኛ Mode', 'quiz_quick_mode_am')
    ],
    [
      Markup.button.callback('📗 9ኛ ክፍል', 'quiz_quick_grade_9'),
      Markup.button.callback('📘 10ኛ ክፍል', 'quiz_quick_grade_10')
    ],
    [
      Markup.button.callback('📙 11ኛ ክፍል', 'quiz_quick_grade_11'),
      Markup.button.callback('🎓 12ኛ ክፍል', 'quiz_quick_grade_12')
    ],
    [
      Markup.button.callback('⚛️ ፊዚክስ', 'quiz_quick_subj_physics'),
      Markup.button.callback('🧪 ኬሚስትሪ', 'quiz_quick_subj_chem')
    ],
    [
      Markup.button.callback('🧬 ባዮሎጂ', 'quiz_quick_subj_bio'),
      Markup.button.callback('📐 ማቲማቲክስ', 'quiz_quick_subj_math')
    ],
    [
      Markup.button.callback('🌍 English Exam', 'quiz_quick_subj_english'),
      Markup.button.callback('🇪🇹 አጠቃላይ እውቀት', 'quiz_quick_subj_general')
    ],
    [
      Markup.button.callback('✏️ የራስህን ርዕስ ጻፍ (Custom Topic)', 'quiz_prompt_custom_topic')
    ],
    [
      Markup.button.callback('📝 ሙሉ ጥያቄ እራስህ ጻፍ', 'quiz_prompt_manual_write'),
      Markup.button.callback('⚙️ ዒላማ ቻናል/ግሩፕ', 'quiz_config_dest')
    ],
    [
      Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')
    ]
  ]);

  return transitionToNewStep(ctx, text, keyboard);
}

// Helper: Show Live Quiz Poll Preview & Dispatch Controls
async function showQuizDraftPreview(ctx, userId, quizDraft, env) {
  const channelHandle = await getDynamicConfig(env, 'poll_channel', await getDynamicConfig(env, 'official_channel', '@SmartX_Discussion'));
  const groupHandle = await getDynamicConfig(env, 'poll_group', await getDynamicConfig(env, 'discussion_group', '@SmartX_Ethio'));
  const cleanQ = cleanQuestionText(quizDraft.question);

  // 1. Send live interactive Poll into chat for the Admin to test!
  try {
    await ctx.telegram.sendPoll(
      ctx.chat.id,
      cleanQ,
      quizDraft.options,
      {
        type: 'quiz',
        correct_option_id: quizDraft.correct_option_id,
        explanation: quizDraft.explanation || '',
        is_anonymous: false
      }
    );
  } catch (err) {
    console.warn('[sendPoll Preview Warning]:', err.message);
  }

  // 2. Send Control Action Bar
  const correctLetter = String.fromCharCode(65 + quizDraft.correct_option_id);
  const correctText = quizDraft.options[quizDraft.correct_option_id] || '';

  const text =
`🎯 <b>የኩዊዝ ፖል ቅድመ-እይታ ተዘጋጅቷል!</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(quizDraft.title || 'Academic Quiz')}
• 📢 <b>ዒላማ ቻናል:</b> <code>${escapeHtml(channelHandle)}</code>
• 👥 <b>ዒላማ ግሩፕ:</b> <code>${escapeHtml(groupHandle)}</code>
• ✅ <b>ትክክለኛ መልስ:</b> <code>${correctLetter}) ${escapeHtml(correctText)}</code>
• 💡 <b>ማብራሪያ:</b> ${escapeHtml(quizDraft.explanation)}

ከላይ የቀረበው የቴሌግራም ፖል ኩዊዝ ወደ የት እንዲለቀቅ ይፈልጋሉ? ከታች ይምረጡ ⬇️`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📢 ወደ ቻናል ልቀቅ', 'quiz_post_channel'),
      Markup.button.callback('👥 ወደ ግሩፕ ልቀቅ', 'quiz_post_group')
    ],
    [
      Markup.button.callback('🚀 ወደ ሁለቱም ልቀቅ (ቻናል + ግሩፕ)', 'quiz_post_both')
    ],
    [
      Markup.button.callback('🇬🇧 ሙሉ English አድርግ', 'quiz_switch_lang_en'),
      Markup.button.callback('🇪🇹 ሙሉ አማርኛ አድርግ', 'quiz_switch_lang_am')
    ],
    [
      Markup.button.callback('🔄 ሌላ ጥያቄ ፍጠር', 'quiz_regen'),
      Markup.button.callback('✏️ አዲስ ርዕስ ጻፍ', 'quiz_prompt_custom_topic')
    ],
    [
      Markup.button.callback('⚙️ ዒላማ ቀይር', 'quiz_config_dest'),
      Markup.button.callback('❌ ሰርዝ', 'quiz_cancel')
    ]
  ]);

  return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
}

// Helper: Dispatch Telegram Poll to Target Channel / Group
async function dispatchPollToDestination(ctx, quizDraft, destination, env) {
  const channelHandle = await getDynamicConfig(env, 'poll_channel', await getDynamicConfig(env, 'official_channel', '@SmartX_Discussion'));
  const groupHandle = await getDynamicConfig(env, 'poll_group', await getDynamicConfig(env, 'discussion_group', '@SmartX_Ethio'));
  const botUsername = (await getDynamicConfig(env, 'bot_username', 'SmartX_PreRegister_bot')).replace('@', '');

  const cleanQ = cleanQuestionText(quizDraft.question);

  // Buttons under the poll: Ask Another Student / Share & Bot Link
  const shareText = `🎯 የፈተና ጥያቄ (Quiz Challenge):\n"${cleanQ}"\n\nይህን ጥያቄ መመለስ ትችላለህ? እስኪ ሞክረው! 👇`;
  const shareUrl = `https://t.me/share/url?url=${encodeURIComponent(`https://t.me/${botUsername}?start=quiz`)}&text=${encodeURIComponent(shareText)}`;

  const pollInlineMarkup = {
    inline_keyboard: [
      [
        {
          text: '👥 Ask Another Student | ለተማሪ አጋራ 📤',
          url: shareUrl
        }
      ],
      [
        {
          text: '🤖 ተጨማሪ ኩዊዞች (More Quizzes)',
          url: `https://t.me/${botUsername}?start=quiz`
        }
      ]
    ]
  };

  const targets = [];
  if (destination === 'channel' || destination === 'both') {
    targets.push({ type: 'channel', handle: channelHandle, label: '📢 ቻናል' });
  }
  if (destination === 'group' || destination === 'both') {
    targets.push({ type: 'group', handle: groupHandle, label: '👥 ግሩፕ' });
  }

  const results = [];
  for (const target of targets) {
    try {
      let pollRes;
      try {
        pollRes = await ctx.telegram.sendPoll(
          target.handle,
          cleanQ,
          quizDraft.options,
          {
            type: 'quiz',
            correct_option_id: quizDraft.correct_option_id,
            explanation: quizDraft.explanation || '',
            is_anonymous: true,
            reply_markup: pollInlineMarkup
          }
        );
      } catch (pollErr) {
        // Fallback if target does not accept reply_markup directly on sendPoll
        pollRes = await ctx.telegram.sendPoll(
          target.handle,
          cleanQ,
          quizDraft.options,
          {
            type: 'quiz',
            correct_option_id: quizDraft.correct_option_id,
            explanation: quizDraft.explanation || '',
            is_anonymous: true
          }
        );
        await ctx.telegram.sendMessage(
          target.handle,
          `👆 <b>ይህን ጥያቄ ለጓደኞችህ ወይም ለሌሎች ተማሪዎች አጋራ!</b>`,
          {
            parse_mode: 'HTML',
            reply_markup: pollInlineMarkup
          }
        ).catch(() => {});
      }

      results.push({ ok: true, target, pollId: pollRes?.poll?.id || 'poll_' + Date.now() });
      inMemoryDispatchedPolls.push({
        pollId: pollRes?.poll?.id || 'poll_' + Date.now(),
        target: target.handle,
        type: target.type,
        question: cleanQ,
        sentAt: new Date().toISOString()
      });
    } catch (err) {
      console.error(`[Poll Dispatch Error to ${target.handle}]:`, err.message);
      results.push({ ok: false, target, error: err.message });
    }
  }

  // Record dispatch in database
  if (env?.DB) {
    try {
      const successfulPollId = results.find(r => r.ok)?.pollId || null;
      await env.DB.prepare(`
        INSERT INTO channel_polls (admin_id, title, question, options_json, correct_option_id, explanation, target_destination, channel_handle, group_handle, telegram_poll_id, sent_status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        ctx.from.id,
        quizDraft.title || 'Academic Quiz',
        quizDraft.question,
        JSON.stringify(quizDraft.options),
        quizDraft.correct_option_id,
        quizDraft.explanation || '',
        destination,
        channelHandle,
        groupHandle,
        successfulPollId,
        results.some(r => r.ok) ? 'sent' : 'failed'
      ).run();
    } catch (e) {
      console.warn('Error recording poll to DB:', e.message);
    }
  }

  const allSuccess = results.every(r => r.ok);
  const anySuccess = results.some(r => r.ok);

  let statusText = '';
  results.forEach(r => {
    if (r.ok) {
      statusText += `• ${r.target.label} (<code>${escapeHtml(r.target.handle)}</code>): ✅ ተልኳል!\n`;
    } else {
      statusText += `• ${r.target.label} (<code>${escapeHtml(r.target.handle)}</code>): ❌ አልተላከም (${escapeHtml(r.error)})\n`;
    }
  });

  const correctLetter = String.fromCharCode(65 + quizDraft.correct_option_id);
  const correctText = quizDraft.options[quizDraft.correct_option_id] || '';

  if (allSuccess) {
    const text =
`🎉 <b>ኩዊዝ ፖል በተሳካ ሁኔታ ተለቋል!</b>
━━━━━━━━━━━━━━━━━━━━
${statusText}
• 📌 <b>ርዕስ:</b> ${escapeHtml(quizDraft.title || 'Academic Quiz')}
• ❓ <b>ጥያቄ:</b> ${escapeHtml(quizDraft.question)}
• ✅ <b>ትክክለኛ መልስ:</b> <code>${correctLetter}) ${escapeHtml(correctText)}</code>

ተማሪዎች በቻናሉ እና በግሩፑ ላይ በቀጥታ ድምጽ መስጠት እና እውቀታቸውን መፈተሽ ይችላሉ! 🚀`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎯 ሌላ ፖል/ኩዊዝ ልቀቅ', 'admin_poll_quiz_menu')],
      [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
    ]);

    return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  } else if (anySuccess) {
    const text =
`⚠️ <b>ኩዊዝ ፖል በከፊል ተልኳል:</b>
━━━━━━━━━━━━━━━━━━━━
${statusText}

💡 <b>ማስታወሻ:</b>
ያልተላከበት ቻናል ወይም ግሩፕ ላይ ቦቱ <b>Admin</b> መሆኑን እና <b>'Manage Polls' / 'Post Messages'</b> ፈቃድ መሰጠቱን ያረጋግጡ።`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🎯 ወደ ፖል ማዕከል', 'admin_poll_quiz_menu')],
      [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
    ]);

    return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  } else {
    const text =
`❌ <b>ወደ ቻናል/ግሩፕ መላክ አልተቻለም!</b>
━━━━━━━━━━━━━━━━━━━━
${statusText}

💡 <b>የመፍትሄ እርምጃዎች:</b>
1. ቦቱ በ <b>${escapeHtml(channelHandle)}</b> እና <b>${escapeHtml(groupHandle)}</b> ውስጥ እንደ <b>Admin</b> መመደቡን ያረጋግጡ።
2. ለአድሚን ቦቱ <b>"Post Messages"</b> እና <b>"Manage Polls"</b> ፈቃድ ይስጡት።
3. የቻናል ወይም የግሩፕ handle ትክክል መሆኑን በ ⚙️ ቅንብር ውስጥ ያረጋግጡ።`;

    const keyboard = Markup.inlineKeyboard([
      [Markup.button.callback('🔄 ደግመህ ሞክር', destination === 'both' ? 'quiz_post_both' : (destination === 'channel' ? 'quiz_post_channel' : 'quiz_post_group'))],
      [Markup.button.callback('⚙️ ዒላማ ቀይር', 'quiz_config_dest')],
      [Markup.button.callback('🎯 ወደ ፖል ማዕከል', 'admin_poll_quiz_menu')]
    ]);

    return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
  }
}

// Helper: Extract rich media payload and inline link buttons for broadcasts with full HTML support
function extractMessagePayload(msg) {
  if (!msg) return { type: 'text', text: '', caption: '', buttons: [] };

  const rawText = msg.text || msg.caption || '';
  let cleanText = rawText;
  const buttons = [];

  // Match inline button patterns like:
  // [Button Text | https://example.com] or [Button 1 | url1] [Button 2 | url2]
  const buttonLineRegex = /^(\s*\[[^\]|]+\|[^\]]+\]\s*)+$/gm;
  const singleButtonRegex = /\[\s*([^\]|]+?)\s*\|\s*([^\]]+?)\s*\]/g;

  const lines = rawText.split('\n');
  const nonButtonLines = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.match(buttonLineRegex)) {
      const row = [];
      let match;
      // Reset regex index for this line
      singleButtonRegex.lastIndex = 0;
      while ((match = singleButtonRegex.exec(trimmed)) !== null) {
        const btnText = match[1].trim();
        let btnUrl = match[2].trim();
        if (btnText && btnUrl) {
          if (!btnUrl.startsWith('http://') && !btnUrl.startsWith('https://') && !btnUrl.startsWith('tg://')) {
            btnUrl = 'https://' + btnUrl;
          }
          row.push({ text: btnText, url: btnUrl });
        }
      }
      if (row.length > 0) {
        buttons.push(row);
      }
    } else {
      nonButtonLines.push(line);
    }
  }

  cleanText = nonButtonLines.join('\n').trim();

  let mediaType = 'text';
  let file_id = null;

  if (msg.photo && msg.photo.length > 0) {
    mediaType = 'photo';
    file_id = msg.photo[msg.photo.length - 1].file_id;
  } else if (msg.video) {
    mediaType = 'video';
    file_id = msg.video.file_id;
  } else if (msg.audio) {
    mediaType = 'audio';
    file_id = msg.audio.file_id;
  } else if (msg.voice) {
    mediaType = 'voice';
    file_id = msg.voice.file_id;
  } else if (msg.document) {
    mediaType = 'document';
    file_id = msg.document.file_id;
  }

  return {
    type: mediaType,
    file_id: file_id,
    text: cleanText,
    caption: cleanText,
    buttons: buttons
  };
}

// Broadcast Processor: Dispatches queued messages safely in strict batches of 20 with rate limit delay
async function processBroadcastQueueBatch(bot, env, batchSize = 20) {
  if (!env.DB) return { sent: 0, failed: 0, blocked: 0, remaining: 0 };

  try {
    const queueRows = await env.DB.prepare(`
      SELECT q.id, q.broadcast_id, q.telegram_id, b.payload_json
      FROM broadcast_queue q
      JOIN broadcasts b ON q.broadcast_id = b.id
      WHERE q.status = 'pending'
      LIMIT ?
    `).bind(batchSize).all();

    if (!queueRows?.results || queueRows.results.length === 0) {
      return { sent: 0, failed: 0, blocked: 0, remaining: 0 };
    }

    let sent = 0;
    let failed = 0;
    let blocked = 0;
    let currentBroadcastId = queueRows.results[0]?.broadcast_id;

    for (const item of queueRows.results) {
      currentBroadcastId = item.broadcast_id;
      let payload = {};
      try {
        payload = JSON.parse(item.payload_json);
      } catch (e) {
        payload = { type: 'text', text: item.payload_json, buttons: [] };
      }

      const extra = {
        parse_mode: 'HTML',
        disable_web_page_preview: false
      };

      if (payload.buttons && Array.isArray(payload.buttons) && payload.buttons.length > 0) {
        extra.reply_markup = {
          inline_keyboard: payload.buttons
        };
      } else if (payload.button && payload.button.text && payload.button.url) {
        extra.reply_markup = {
          inline_keyboard: [[{ text: payload.button.text, url: payload.button.url }]]
        };
      }

      try {
        if (payload.type === 'photo' && payload.file_id) {
          await bot.telegram.sendPhoto(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'video' && payload.file_id) {
          await bot.telegram.sendVideo(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'audio' && payload.file_id) {
          await bot.telegram.sendAudio(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'voice' && payload.file_id) {
          await bot.telegram.sendVoice(item.telegram_id, payload.file_id, {
            caption: payload.caption || '',
            ...extra
          });
        } else if (payload.type === 'document' && payload.file_id) {
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

      // Safe rate-limit delay (~20-30 msgs/sec max) to strictly prevent Telegram 429 errors
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    // Check remaining pending items
    let remaining = 0;
    if (currentBroadcastId) {
      const remRow = await env.DB.prepare('SELECT pending_count FROM broadcasts WHERE id = ?').bind(currentBroadcastId).first();
      remaining = remRow?.pending_count || 0;
      if (remaining === 0) {
        await env.DB.prepare("UPDATE broadcasts SET status = 'completed', updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(currentBroadcastId).run();
      }
    }

    return { sent, failed, blocked, remaining, broadcastId: currentBroadcastId };
  } catch (err) {
    console.error('Broadcast Queue Error:', err);
    return { sent: 0, failed: 0, blocked: 0, remaining: 0 };
  }
}

// Helper: Build Admin Dashboard Data
async function buildAdminDashboardData(env) {
  let userCount = 0;
  let activeUserCount = 0;
  let blockedCount = 0;
  let notifyOptinCount = 0;
  let templateCount = 0;
  let gradeBreakdown = {};
  let totalReferrals = 0;
  let pollCount = inMemoryDispatchedPolls.length;

  if (env?.DB) {
    try {
      const uRes = await env.DB.prepare(`
        SELECT COUNT(*) as total, 
               SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active, 
               SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive, 
               SUM(CASE WHEN app_notification = 1 THEN 1 ELSE 0 END) as notify_yes,
               SUM(referral_count) as refs 
        FROM users
      `).first();
      userCount = uRes?.total || 0;
      activeUserCount = uRes?.active || 0;
      blockedCount = uRes?.inactive || 0;
      notifyOptinCount = uRes?.notify_yes || 0;
      totalReferrals = uRes?.refs || 0;

      const tRes = await env.DB.prepare('SELECT COUNT(*) as cnt FROM promo_templates WHERE is_active = 1').first();
      templateCount = tRes?.cnt || 0;

      try {
        const pRes = await env.DB.prepare('SELECT COUNT(*) as cnt FROM channel_polls').first();
        if (pRes?.cnt) pollCount = Math.max(pollCount, pRes.cnt);
      } catch (e) {}

      const gRes = await env.DB.prepare(`SELECT grade, COUNT(*) as cnt FROM users GROUP BY grade`).all();
      if (gRes?.results) {
        gRes.results.forEach(r => { gradeBreakdown[r.grade] = r.cnt; });
      }
    } catch (e) {
      console.error('Admin stats error:', e);
    }
  } else {
    const userVals = Object.values(registeredUsers);
    userCount = userVals.length;
    activeUserCount = userVals.filter(u => u.is_active !== 0).length;
    blockedCount = userVals.filter(u => u.is_active === 0).length;
    notifyOptinCount = userVals.filter(u => u.app_notification === 1).length;
    totalReferrals = userVals.reduce((acc, u) => acc + (u.referral_count || 0), 0);
    templateCount = defaultPromoTemplates.length;
    pollCount = inMemoryDispatchedPolls.length;
    userVals.forEach(u => {
      if (u.grade) {
        gradeBreakdown[u.grade] = (gradeBreakdown[u.grade] || 0) + 1;
      }
    });
  }

  const text =
`👑 <b>Smart X Ethiopian — Admin Dashboard</b> 🇪🇹

━━━━━━━━━━━━━━━━━━━━
• 👥 <b>ተመዝጋቢ ተማሪዎች:</b> <code>${userCount}</code>
• 🟢 <b>ንቁ ተጠቃሚዎች:</b> <code>${activeUserCount}</code>
• 🔔 <b>አፕ ማሳወቂያ የጠየቁ:</b> <code>${notifyOptinCount}</code>
• 📝 <b>የግሩፕ መልዕክት ቴምፕሌቶች:</b> <code>${templateCount}</code>
• 🎯 <b>የተለቀቁ ፖል ኩዊዞች:</b> <code>${pollCount || 0}</code>
• 🔴 <b>ቦት ያቆሙ:</b> <code>${blockedCount}</code>
• 🔗 <b>ጠቅላላ የጥቆማ ግብዣዎች:</b> <code>${totalReferrals}</code>

🎓 <b>የክፍል ክፍፍል:</b>
• 9ኛ ክፍል: <code>${gradeBreakdown['9ኛ ክፍል'] || gradeBreakdown['Grade 9'] || gradeBreakdown['Kutaa 9'] || gradeBreakdown['📗 9ኛ ክፍል'] || 0}</code>
• 10ኛ ክፍል: <code>${gradeBreakdown['10ኛ ክፍል'] || gradeBreakdown['Grade 10'] || gradeBreakdown['Kutaa 10'] || gradeBreakdown['📘 10ኛ ክፍል'] || 0}</code>
• 11ኛ ክፍል: <code>${gradeBreakdown['11ኛ ክፍል'] || gradeBreakdown['Grade 11'] || gradeBreakdown['Kutaa 11'] || gradeBreakdown['📙 11ኛ ክፍል'] || 0}</code>
• 12ኛ ክፍል: <code>${gradeBreakdown['12ኛ ክፍል'] || gradeBreakdown['Grade 12'] || gradeBreakdown['Kutaa 12'] || gradeBreakdown['🎓 12ኛ ክፍል'] || 0}</code>
━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎯 ፖል/ኩዊዝ ልቀቅ (Channel Poll)', 'admin_poll_quiz_menu')
    ],
    [
      Markup.button.callback('📢 New Broadcast', 'admin_new_broadcast'),
      Markup.button.callback('📝 Promo Templates', 'admin_manage_templates')
    ],
    [
      Markup.button.callback('📋 Sample HTML Templates', 'admin_sample_templates'),
      Markup.button.callback('👥 Recent Users', 'admin_recent_users')
    ],
    [
      Markup.button.callback('🔄 Refresh Stats', 'admin_refresh_stats')
    ]
  ]);

  return { text, keyboard };
}

// Initialize Database Schema & Drop Legacy AI Tables
async function initDb(db) {
  if (!db) return;
  try {
    await db.exec(`
      DROP TABLE IF EXISTS ai_chats;
      DROP TABLE IF EXISTS ai_conversations;
      DROP TABLE IF EXISTS gemini_logs;
      DROP TABLE IF EXISTS ai_history;

      CREATE TABLE IF NOT EXISTS users (
        telegram_id INTEGER PRIMARY KEY,
        full_name TEXT NOT NULL,
        phone TEXT NOT NULL,
        grade TEXT NOT NULL,
        stream TEXT DEFAULT 'General',
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

      CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
      CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
      CREATE INDEX IF NOT EXISTS idx_users_grade ON users(grade);
      CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

      CREATE TABLE IF NOT EXISTS promo_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        grade TEXT DEFAULT 'All',
        button_text TEXT DEFAULT '✨ አዎ! እንፈልጋለን',
        content_html TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_promo_templates_active ON promo_templates(is_active);

      CREATE TABLE IF NOT EXISTS channel_polls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        admin_id INTEGER,
        title TEXT NOT NULL,
        question TEXT NOT NULL,
        options_json TEXT NOT NULL,
        correct_option_id INTEGER DEFAULT 0,
        explanation TEXT,
        target_destination TEXT DEFAULT 'both',
        channel_handle TEXT,
        group_handle TEXT,
        telegram_poll_id TEXT,
        sent_status TEXT DEFAULT 'sent',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX IF NOT EXISTS idx_channel_polls_admin ON channel_polls(admin_id);
      CREATE INDEX IF NOT EXISTS idx_channel_polls_created ON channel_polls(created_at DESC);

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
        target_grade TEXT DEFAULT 'All',
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

      CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON broadcast_queue(status);
      CREATE INDEX IF NOT EXISTS idx_broadcast_queue_broadcast_id ON broadcast_queue(broadcast_id);
    `);

    // Seed default system configs
    const sysItems = [
      ['bot_version', 'v5.5-clean'],
      ['required_channel', '@SmartX_Discussion'],
      ['official_channel', '@SmartXEthiopia'],
      ['discussion_group', '@SmartX_Ethio'],
      ['poll_channel', '@SmartX_Discussion'],
      ['poll_group', '@SmartX_Ethio'],
      ['support_username', '@smart_x_help'],
      ['release_date', 'መስከረም 5']
    ];

    for (const [k, v] of sysItems) {
      await db.prepare(`
        INSERT INTO system_config (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).bind(k, v).run();
    }

    // Seed default promo templates if table is empty
    const tCount = await db.prepare('SELECT COUNT(*) as cnt FROM promo_templates').first();
    if (!tCount?.cnt || tCount.cnt === 0) {
      for (const t of defaultPromoTemplates) {
        await db.prepare(`
          INSERT OR IGNORE INTO promo_templates (id, title, grade, button_text, content_html, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).bind(t.id, t.title, t.grade, t.button_text, t.content_html).run();
      }
    }

  } catch (err) {
    console.error('D1 Init Error:', err);
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
    const apiKey = env?.TELEGRAM_BOT_TOKEN || env?.BOT_TOKEN || process.env?.TELEGRAM_BOT_TOKEN || process.env?.BOT_TOKEN;
    if (!apiKey) {
      return new Response('Error: TELEGRAM_BOT_TOKEN (or BOT_TOKEN) is not set in environment or secrets.', { status: 500 });
    }

    const bot = new Telegraf(apiKey);
    bot.botInfo = {
      id: 777888999,
      is_bot: true,
      first_name: 'Smart X Ethiopian Bot',
      username: env?.BOT_USERNAME ? env.BOT_USERNAME.replace('@', '') : 'SmartX_PreRegister_bot'
    };
    bot.catch((err) => {
      console.warn('[Telegraf Worker Global Catch]:', err?.message || err);
    });
    const url = new URL(request.url);

    if (env?.DB) {
      await initDb(env.DB);
    }

    // Endpoint to register or check Telegram Webhook
    if (url.pathname === '/register' || url.pathname === '/setWebhook' || url.pathname === '/setwebhook') {
      try {
        const webhookUrl = `${url.origin}/webhook`;
        if (apiKey.startsWith('SIMULATOR_') || apiKey.startsWith('YOUR_')) {
          return new Response(JSON.stringify({ ok: false, message: 'Notice: Bot token is in simulator/demo mode. Live webhook registration at Telegram skipped.' }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          });
        }
        await bot.telegram.setWebhook(webhookUrl);
        const webhookInfo = await bot.telegram.getWebhookInfo().catch(() => ({}));
        return new Response(JSON.stringify({
          ok: true,
          message: `Webhook successfully registered at: ${webhookUrl}`,
          webhook_info: webhookInfo
        }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (err) {
        console.warn('Webhook Registration Warning:', err.message);
        return new Response(JSON.stringify({
          ok: false,
          error: err.message,
          suggestion: 'Please verify your TELEGRAM_BOT_TOKEN is correct and active with @BotFather.'
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    if (url.pathname === '/webhookinfo' || url.pathname === '/status') {
      try {
        const info = await bot.telegram.getWebhookInfo().catch(() => ({ error: 'Could not fetch webhook info' }));
        return new Response(JSON.stringify({ ok: true, status: 'Online', webhook: info }, null, 2), {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: true, status: 'Online' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
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
              if (row && (row.is_active === 1 || row.registered_at)) {
                existingUser = row;
                registeredUsers[userId] = row;
              }
            } catch (err) {
              console.error('Check existing user error:', err);
            }
          }

          // Case A: User is ALREADY REGISTERED -> Show Welcome Back & Persistent Keyboard Menu
          if (existingUser && (existingUser.is_active === 1 || existingUser.registered_at)) {
            const lang = existingUser.language || 'am';
            const langObj = i18n[lang] || i18n.am;
            const name = existingUser.full_name || userName;
            const welcomeBackMsg = langObj.welcome_back(name);
            const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

            return transitionToNewStep(ctx, welcomeBackMsg, mainDashboardKeyboard);
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

          return transitionToNewStep(ctx, i18n.am.welcome_header, langKeyboard);
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
            [gradeButtons[2], gradeButtons[3]],
            [Markup.button.callback('🔙 ቋንቋ ቀይር / Change Language', 'back_to_language_select')]
          ]);

          return transitionToNewStep(ctx, langObj.select_grade_header, gradeKeyboard);
        });

        // Back to language select during onboarding
        bot.action('back_to_language_select', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const langKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
              Markup.button.callback('🇬🇧 English', 'set_lang_en')
            ],
            [
              Markup.button.callback('🔴 Afaan Oromoo', 'set_lang_om')
            ]
          ]);

          return transitionToNewStep(ctx, i18n.am.welcome_header, langKeyboard);
        });

        // --- Step 2 Action: Grade Selected -> Step 3: Consent & Demand Check ---
        bot.action(/set_grade_(\d+)/, async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const gradeNum = ctx.match[1];
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          const selectedGradeObj = langObj.grades.find(g => g.id === gradeNum) || { text: `${gradeNum}ኛ ክፍል` };
          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_CONSENT', data: {} };
          }
          userStates[chatId].data.grade = selectedGradeObj.text;
          userStates[chatId].data.qAnswers = [];
          userStates[chatId].step = 'AWAITING_CONSENT';

          const consentText = langObj.consent_intro(selectedGradeObj.text);
          const consentKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(langObj.consent_yes, 'consent_flow_yes'),
              Markup.button.callback(langObj.consent_no, 'consent_flow_no')
            ]
          ]);

          return transitionToNewStep(ctx, consentText, consentKeyboard);
        });

        // Consent Declined Flow -> Polite encouraging response with instant retry
        bot.action('consent_flow_no', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          const retryKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(langObj.consent_retry_btn, 'consent_flow_yes')]
          ]);

          return transitionToNewStep(ctx, langObj.consent_declined, retryKeyboard);
        });

        // Consent Accepted Flow -> Question 1 of 5
        bot.action('consent_flow_yes', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;

          if (!userStates[chatId]) {
            userStates[chatId] = { step: 'AWAITING_Q1', data: { qAnswers: [] } };
          }
          userStates[chatId].step = 'AWAITING_Q1';
          userStates[chatId].data.qAnswers = [];

          const q1Text = langObj.questions[0];
          const q1Keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(langObj.yes, 'answer_q_1_yes'),
              Markup.button.callback(langObj.no, 'answer_q_1_no')
            ]
          ]);

          return transitionToNewStep(ctx, q1Text, q1Keyboard);
        });

        // --- Helper for 5 Sequential Diagnostic Questions ---
        for (let qIndex = 1; qIndex <= 5; qIndex++) {
          bot.action([`answer_q_${qIndex}_yes`, `answer_q_${qIndex}_no`], async (ctx) => {
            await ctx.answerCbQuery().catch(() => {});
            const chatId = ctx.chat.id;
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

              return transitionToNewStep(ctx, nextQText, nextQKeyboard);
            }

            // All 5 Questions Completed -> Climax & Smart X Ethiopian Platform Reveal & Promo
            userStates[chatId].step = 'AWAITING_HOW_TO_GET_APP';
            const studentName = userStates[chatId].data.fullName || ctx.from?.first_name || 'ተማሪ';
            const grade = userStates[chatId].data.grade || '10ኛ ክፍል';

            const promoText = langObj.promo_reveal(studentName, grade);
            const promoKeyboard = Markup.inlineKeyboard([
              [Markup.button.callback(langObj.how_to_get_btn, 'flow_how_to_get_app')]
            ]);

            return transitionToNewStep(ctx, promoText, promoKeyboard);
          });
        }

        // --- Step 4 Action: "How to get the mobile app" Clicked -> Prompt Registration & Channel ---
        bot.action('flow_how_to_get_app', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = userStates[chatId]?.lang || 'am';
          const langObj = i18n[lang] || i18n.am;
          const channelHandle = await getDynamicConfig(env, 'required_channel', '@SmartX_Discussion');
          const grade = userStates[chatId]?.data?.grade || '10ኛ ክፍል';

          const isMember = await checkChannelMember(ctx, userId, env);
          if (isMember) {
            userStates[chatId].step = 'AWAITING_NOTIFICATION_OPTIN';
            const notifyKeyboard = Markup.inlineKeyboard([
              [Markup.button.callback(langObj.notify_yes, 'notify_optin_yes')],
              [Markup.button.callback(langObj.notify_no, 'notify_optin_no')]
            ]);

            return transitionToNewStep(ctx, `${langObj.register_first_prompt}\n\n${langObj.notify_prompt}`, notifyKeyboard);
          }

          userStates[chatId].step = 'AWAITING_CHANNEL_VERIFY';
          const channelUrl = 'https://t.me/SmartX_Discussion';
          const groupUrl = 'https://t.me/SmartX_Ethio';
          const verifyKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.url(langObj.join_channel, channelUrl),
              Markup.button.url(langObj.join_group, groupUrl)
            ],
            [
              Markup.button.callback(langObj.verify_channel, 'verify_channel_step')
            ]
          ]);

          const combinedMsg = `${langObj.register_first_prompt}\n\n${langObj.channel_step(grade, '@SmartX_Discussion')}`;
          return transitionToNewStep(ctx, combinedMsg, verifyKeyboard);
        });

        // --- Step 5 Action: Discussion Group Verification Callback ---
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
            userStates[chatId] = { step: 'AWAITING_NOTIFICATION_OPTIN', data: { grade: '10ኛ ክፍል' } };
          }
          userStates[chatId].step = 'AWAITING_NOTIFICATION_OPTIN';

          const notifyKeyboard = Markup.inlineKeyboard([
            [Markup.button.callback(langObj.notify_yes, 'notify_optin_yes')],
            [Markup.button.callback(langObj.notify_no, 'notify_optin_no')]
          ]);

          return transitionToNewStep(ctx, langObj.notify_prompt, notifyKeyboard);
        });

        // Optional phone handler if user sends contact
        const handlePhoneSubmission = async (ctx, phone) => {
          const chatId = ctx.chat.id;
          const userId = ctx.from.id;
          if (userStates[chatId]?.data) {
            userStates[chatId].data.phone = phone || 'N/A';
          }
          if (registeredUsers[userId]) {
            registeredUsers[userId].phone = phone || 'N/A';
          }
          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET phone = ? WHERE telegram_id = ?').bind(phone || 'N/A', userId).run();
            } catch (e) {}
          }
        };

        bot.on('contact', async (ctx) => {
          const phone = ctx.message.contact?.phone_number || '';
          return handlePhoneSubmission(ctx, phone);
        });

        // --- Step 7 Action: Notification Opt-in Response -> Save to D1 & Finish ---
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

                  const referrerLang = await getUserLang(referredBy, env);
                  const refLangObj = i18n[referrerLang] || i18n.am;
                  const refMsg = refLangObj.ref_notification
                    ? refLangObj.ref_notification(fullName, updatedPoints, updatedCount)
                    : `🎉 <b>አዲስ ተማሪ በጥቆማዎ ተመዝግቧል!</b>\n\n• 👤 <b>ተማሪ:</b> ${escapeHtml(fullName)}\n• 🎁 <b>ነጥብ:</b> <code>+10 pts</code> (ጠቅላላ: ${updatedPoints} pts / ${updatedCount} ተማሪዎች)`;

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
            app_notification: wantsNotify,
            is_active: 1,
            registered_at: new Date().toISOString()
          };

          if (userStates[chatId]) userStates[chatId].step = null;

          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return transitionToNewStep(ctx, langObj.reg_success(fullName), mainDashboardKeyboard);
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

          const shareText = `${langObj.share_title}\n\n${langObj.share_desc(refCount, points, shareLink)}`;

          const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.switchToChat(langObj.share_btn, '')],
            [Markup.button.callback(langObj.back_to_menu_btn, 'nav_back_to_menu')]
          ]);

          return transitionToNewStep(ctx, shareText, shareKeyboard);
        };

        bot.hears([
          '🔗 ለጓደኞች አጋራ',
          '🔗 Share with Friends',
          '🔗 Hiriyyootaaf Qoodi',
          'Share',
          'Invite'
        ], handleShareInvite);
        bot.command(['share', 'invite'], handleShareInvite);

        // --- DASHBOARD BUTTON 2: ⚙️ Settings (Language, Grade, Notifications, Profile) ---
        const handleSettings = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          let user = registeredUsers[userId] || {
            full_name: ctx.from?.first_name || 'ተማሪ',
            grade: '10ኛ ክፍል',
            phone: 'N/A',
            language: lang,
            app_notification: 1,
            points: 0,
            referral_count: 0
          };

          if (env.DB) {
            try {
              const row = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(userId).first();
              if (row) {
                user = row;
                registeredUsers[userId] = row;
              }
            } catch (err) {}
          }

          const settingsKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback(langObj.change_lang_btn, 'settings_change_lang'),
              Markup.button.callback(langObj.change_grade_btn, 'settings_change_grade')
            ],
            [
              Markup.button.callback(langObj.toggle_notify_btn(user.app_notification !== 0), 'settings_toggle_notify')
            ],
            [
              Markup.button.callback(langObj.back_to_menu_btn, 'nav_back_to_menu')
            ]
          ]);

          return transitionToNewStep(ctx, `${langObj.settings_title}\n\n${langObj.profile_card(user)}`, settingsKeyboard);
        };

        bot.hears([
          '⚙️ ቅንብሮች',
          '⚙️ Settings',
          '⚙️ Qindaa\'inoota',
          'Settings'
        ], handleSettings);
        bot.command(['settings', 'profile'], handleSettings);

        // --- DASHBOARD BUTTON 3: 📞 Help & Support / Contact ---
        const handleHelpAndContact = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          const helpKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.url(langObj.join_channel_btn || '📢 ቻናሉን ተቀላቀል', 'https://t.me/SmartX_Discussion'),
              Markup.button.url(langObj.join_group || '👥 ግሩፑን ተቀላቀል', 'https://t.me/SmartX_Ethio')
            ],
            [
              Markup.button.url(langObj.contact_admin_btn || '👨‍💻 ድጋፍ አግኝ', 'https://t.me/smart_x_help')
            ],
            [
              Markup.button.callback(langObj.back_to_menu_btn, 'nav_back_to_menu')
            ]
          ]);

          return transitionToNewStep(ctx, `${langObj.help_title}\n\n${langObj.help_body}`, helpKeyboard);
        };

        bot.hears([
          '📞 እገዛ እና ግንኙነት',
          '📞 Help & Support',
          '📞 Gargaarsa & Quunnamtii',
          'Help',
          'Contact',
          'Support'
        ], handleHelpAndContact);
        bot.command(['help', 'contact', 'support'], handleHelpAndContact);

        // --- /myid & /id Command ---
        bot.command(['myid', 'id', 'whoami'], async (ctx) => {
          const userId = ctx.from?.id;
          const isUserAdmin = isAdmin(userId, env);
          const text =
`🆔 <b>የእርስዎ የቴሌግራም መለያ (Telegram ID):</b>
━━━━━━━━━━━━━━━━━━━━
• 👤 <b>ስም:</b> ${escapeHtml(ctx.from?.first_name || 'User')}
• 🔢 <b>ID:</b> <code>${userId}</code>
• 👑 <b>የአድሚን ፍቃድ:</b> ${isUserAdmin ? '✅ አድሚን ነዎት (Authorized)' : '❌ ተራ ተጠቃሚ (Standard User)'}

${!isUserAdmin ? '💡 <i>ለዚህ ID የአድሚን ፍቃድ ለመስጠት በ Cloudflare ወይም .env ውስጥ ADMIN_IDS ላይ ይጨምሩት።</i>' : '🎯 <i>እንደ /quiz እና /admin ያሉ ሁሉንም የአድሚን ትዕዛዛት መጠቀም ይችላሉ።</i>'}`;
          return ctx.reply(text, { parse_mode: 'HTML' });
        });

        // --- NAVIGATION BACK TO MAIN MENU ACTION ---
        bot.action('nav_back_to_menu', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          const userName = ctx.from?.first_name || 'ተማሪ';
          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return transitionToNewStep(ctx, langObj.welcome_back(userName), mainDashboardKeyboard);
        });

        // --- SETTINGS ACTIONS WITH BACK BUTTONS ---
        bot.action('settings_change_lang', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          const langKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🇪🇹 አማርኛ', 'update_lang_am'),
              Markup.button.callback('🇬🇧 English', 'update_lang_en')
            ],
            [
              Markup.button.callback('🔴 Afaan Oromoo', 'update_lang_om')
            ],
            [
              Markup.button.callback(langObj.back_btn, 'back_to_settings')
            ]
          ]);

          return transitionToNewStep(ctx, i18n.am.welcome_header, langKeyboard);
        });

        bot.action(['update_lang_am', 'update_lang_en', 'update_lang_om'], async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const newLang = ctx.callbackQuery.data.replace('update_lang_', '');
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;

          if (userStates[chatId]) userStates[chatId].lang = newLang;
          if (registeredUsers[userId]) registeredUsers[userId].language = newLang;

          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET language = ? WHERE telegram_id = ?').bind(newLang, userId).run();
            } catch (e) {}
          }

          const langObj = i18n[newLang] || i18n.am;
          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return transitionToNewStep(ctx, `✅ <b>ቋንቋ በተሳካ ሁኔታ ተቀይሯል! / Language Updated!</b>\n\n${langObj.welcome_back(ctx.from?.first_name || 'ተማሪ')}`, mainDashboardKeyboard);
        });

        bot.action('settings_change_grade', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

          const gradeButtons = langObj.grades.map(g => Markup.button.callback(g.text, `update_grade_${g.id}`));
          const gradeKeyboard = Markup.inlineKeyboard([
            [gradeButtons[0], gradeButtons[1]],
            [gradeButtons[2], gradeButtons[3]],
            [Markup.button.callback(langObj.back_btn, 'back_to_settings')]
          ]);

          return transitionToNewStep(ctx, langObj.select_grade_header, gradeKeyboard);
        });

        bot.action(/update_grade_(\d+)/, async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const gradeNum = ctx.match[1];
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          const gradeText = `${gradeNum}ኛ ክፍል`;

          if (registeredUsers[userId]) registeredUsers[userId].grade = gradeText;

          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET grade = ? WHERE telegram_id = ?').bind(gradeText, userId).run();
            } catch (e) {}
          }

          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();
          return transitionToNewStep(ctx, `✅ ክፍል ተቀይሯል: <b>${gradeText}</b>`, mainDashboardKeyboard);
        });

        // Toggle app notification preference
        bot.action('settings_toggle_notify', async (ctx) => {
          const userId = ctx.from.id;
          let currentStatus = 1;
          if (env.DB) {
            try {
              const row = await env.DB.prepare('SELECT app_notification FROM users WHERE telegram_id = ?').bind(userId).first();
              currentStatus = row?.app_notification !== undefined ? row.app_notification : 1;
            } catch (e) {}
          }

          const newStatus = currentStatus === 1 ? 0 : 1;
          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET app_notification = ? WHERE telegram_id = ?').bind(newStatus, userId).run();
            } catch (e) {}
          }
          if (registeredUsers[userId]) registeredUsers[userId].app_notification = newStatus;

          const alertText = newStatus === 1 ? '🔔 የማሳወቂያ ፈቃድ በርቷል!' : '🔕 ማሳወቂያ ጠፍቷል!';
          await ctx.answerCbQuery(alertText, { show_alert: true }).catch(() => {});

          return handleSettings(ctx);
        });

        // Back to settings handler
        bot.action('back_to_settings', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          return handleSettings(ctx);
        });

        // --- ACTION HANDLER: User clicks custom button in Group ---
        bot.action(/want_notes_ref_(\d+)/, async (ctx) => {
          const refUserId = ctx.match[1];
          const botUsername = getBotUsername(ctx, env);
          const deepLink = `https://t.me/${botUsername}?start=ref_${refUserId}`;

          try {
            await ctx.answerCbQuery(
              `💡 የ 9-12ኛ ክፍል Short Notes እና Worksheets ለማግኘት @${botUsername} ን Start ይበሉ!`,
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

        // --- DYNAMIC INLINE QUERY HANDLER (CUSTOMIZABLE BUTTON TEXT + CUSTOM QUERY) ---
        bot.on('inline_query', async (ctx) => {
          const userId = ctx.from?.id || 0;
          const customQuery = (ctx.inlineQuery?.query || '').trim();

          // Fetch active templates from D1 or use fallback
          let templates = defaultPromoTemplates;
          if (env?.DB) {
            try {
              const rows = await env.DB.prepare(`
                SELECT id, title, grade, button_text, content_html 
                FROM promo_templates 
                WHERE is_active = 1 
                ORDER BY id ASC
              `).all();
              if (rows?.results && rows.results.length > 0) {
                templates = rows.results;
              }
            } catch (e) {
              console.warn('Error fetching promo templates from D1:', e.message);
            }
          }

          const results = [];

          // 1. If user typed a custom query, show it as the top item
          if (customQuery.length > 0) {
            results.push({
              type: 'article',
              id: `custom_promo_${userId}_${Date.now()}`,
              title: `✉️ የራስህ መልዕክት: "${customQuery.slice(0, 25)}..."`,
              description: 'የጻፍከውን መልዕክት ከ [✨ አዎ! እንፈልጋለን] አዝራር ጋር ይልካል',
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/2983/2983786.png',
              input_message_content: {
                message_text: escapeHtml(customQuery),
                parse_mode: 'HTML',
                disable_web_page_preview: true
              },
              reply_markup: {
                inline_keyboard: [
                  [{ text: '✨ አዎ! እንፈልጋለን', callback_data: `want_notes_ref_${userId}` }]
                ]
              }
            });
          }

          // 2. Add all dynamic Grade templates from Database with their CUSTOM BUTTON LABELS
          templates.forEach((t) => {
            const btnLabel = t.button_text || '✨ አዎ! እንፈልጋለን';
            results.push({
              type: 'article',
              id: `template_${t.id}_${userId}`,
              title: t.title,
              description: `ለ ክፍል: ${t.grade} • አዝራር: "${btnLabel}"`,
              thumb_url: 'https://cdn-icons-png.flaticon.com/512/3135/3135755.png',
              input_message_content: {
                message_text: t.content_html,
                parse_mode: 'HTML',
                disable_web_page_preview: true
              },
              reply_markup: {
                inline_keyboard: [
                  [{ text: btnLabel, callback_data: `want_notes_ref_${userId}` }]
                ]
              }
            });
          });

          try {
            return await ctx.answerInlineQuery(results, {
              cache_time: 1,
              is_personal: true
            });
          } catch (err) {
            console.error('Inline Query Error:', err.message);
          }
        });

        // --- ADMIN DASHBOARD COMMANDS & TEMPLATE MANAGEMENT ---
        const handleAdminDashboard = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ <b>Access Denied!</b> Admin authorization required.', { parse_mode: 'HTML' });
          }

          const { text, keyboard } = await buildAdminDashboardData(env);
          return transitionToNewStep(ctx, text, keyboard);
        };

        bot.command(['admin', 'dashboard', 'panel'], handleAdminDashboard);

        // --- ADMIN POLL & QUIZ COMMANDS & ACTIONS ---
        const handleQuizCommand = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ <b>Access Denied!</b> Admin authorization required.', { parse_mode: 'HTML' });
          }

          const rawText = ctx.message.text || '';
          let topic = rawText.replace(/^\/(quiz|poll|postquiz|postpoll)(@\w+)?/i, '').trim();

          let langMode = 'auto';
          if (/^(?:en|english)\s+/i.test(topic)) {
            langMode = 'english';
            topic = topic.replace(/^(?:en|english)\s+/i, '').trim();
          } else if (/^(?:am|amharic|አማርኛ)\s+/i.test(topic)) {
            langMode = 'amharic';
            topic = topic.replace(/^(?:am|amharic|አማርኛ)\s+/i, '').trim();
          }

          if (topic) {
            // Check if topic is a full question with manual options format
            const manualParsed = parseCustomPollFormat(topic);
            if (manualParsed && manualParsed.options.length >= 2) {
              adminQuizDrafts[userId] = {
                title: manualParsed.question.substring(0, 40),
                langMode,
                ...manualParsed,
                question: cleanQuestionText(manualParsed.question)
              };
              return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
            }

            // Otherwise, topic is a subject or chapter name
            const langLabel = langMode === 'english' ? ' (100% English)' : (langMode === 'amharic' ? ' (ሙሉ አማርኛ)' : '');
            await ctx.reply(`⏳ <b>ለ "${escapeHtml(topic)}"${langLabel} የኩዊዝ ጥያቄ እየተዘጋጀ ነው...</b>`, { parse_mode: 'HTML' });
            const quizData = await getOrGenerateQuiz(topic, langMode, env);
            adminQuizDrafts[userId] = {
              title: topic,
              langMode,
              ...quizData,
              question: cleanQuestionText(quizData.question)
            };
            return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
          }

          return renderPollManagerDashboard(ctx, env);
        };

        bot.command(['quiz', 'poll', 'postquiz', 'postpoll'], handleQuizCommand);

        bot.command('setquizchannel', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ Admin authorization required.');
          const arg = (ctx.message.text || '').replace(/^\/setquizchannel(@\w+)?/i, '').trim();
          if (!arg) return ctx.reply('⚠️ እባክዎ የቻናል Handle ይጥቀሱ: <code>/setquizchannel @SmartX_Discussion</code>', { parse_mode: 'HTML' });
          let handle = arg.startsWith('@') ? arg : '@' + arg;
          await setDynamicConfig(env, 'poll_channel', handle);
          return ctx.reply(`✅ <b>የፖል መላኪያ ቻናል ወደ ${escapeHtml(handle)} ተቀይሯል!</b>`, { parse_mode: 'HTML' });
        });

        bot.command('setquizgroup', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ Admin authorization required.');
          const arg = (ctx.message.text || '').replace(/^\/setquizgroup(@\w+)?/i, '').trim();
          if (!arg) return ctx.reply('⚠️ እባክዎ የግሩፕ Handle ይጥቀሱ: <code>/setquizgroup @SmartX_Ethio</code>', { parse_mode: 'HTML' });
          let handle = arg.startsWith('@') ? arg : '@' + arg;
          await setDynamicConfig(env, 'poll_group', handle);
          return ctx.reply(`✅ <b>የፖል መላኪያ ግሩፕ ወደ ${escapeHtml(handle)} ተቀይሯል!</b>`, { parse_mode: 'HTML' });
        });

        bot.action('admin_poll_quiz_menu', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});
          return renderPollManagerDashboard(ctx, env);
        });

        bot.action('quiz_quick_mode_en', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery('🇬🇧 English Quiz Mode Activated').catch(() => {});
          adminQuizDrafts[userId] = { ...(adminQuizDrafts[userId] || {}), preferredLang: 'english' };
          return ctx.reply('🇬🇧 <b>100% English Quiz Mode ነቅቷል!</b>\nጥያቄው፣ 4ቱ ምርጫዎች እና ማብራሪያው ሙሉ በሙሉ በእንግሊዝኛ ይዘጋጃሉ።\n\nአሁን የርዕስ ስም ይጻፉ ወይም በ <code>/quiz en &lt;topic&gt;</code> ያዙ። (ምሳሌ: <code>/quiz en Grade 10 Biology genetics</code>)', { parse_mode: 'HTML' });
        });

        bot.action('quiz_quick_mode_am', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery('🇪🇹 የአማርኛ ኩዊዝ ሞድ ነቅቷል').catch(() => {});
          adminQuizDrafts[userId] = { ...(adminQuizDrafts[userId] || {}), preferredLang: 'amharic' };
          return ctx.reply('🇪🇹 <b>ሙሉ የአማርኛ ኩዊዝ Mode ነቅቷል!</b>\nጥያቄው፣ 4ቱ ምርጫዎች እና ማብራሪያው ሙሉ በሙሉ በአማርኛ ይዘጋጃሉ።\n\nአሁን የርዕስ ስም ይጻፉ ወይም በ <code>/quiz am &lt;ርዕስ&gt;</code> ያዙ። (ምሳሌ: <code>/quiz am 10ኛ ክፍል ባዮሎጂ ዘረመል</code>)', { parse_mode: 'HTML' });
        });

        bot.action(/quiz_quick_grade_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const gradeNum = ctx.match[1];
          const langMode = adminQuizDrafts[userId]?.preferredLang || 'auto';
          await ctx.answerCbQuery(`የ ${gradeNum}ኛ ክፍል ጥያቄ እየተዘጋጀ ነው...`).catch(() => {});

          const topic = `${gradeNum}ኛ ክፍል አጠቃላይ ፈተና`;
          const quizData = await getOrGenerateQuiz(topic, langMode, env);
          adminQuizDrafts[userId] = {
            title: topic,
            langMode,
            ...quizData,
            question: cleanQuestionText(quizData.question)
          };
          return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
        });

        bot.action(/quiz_quick_subj_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const subjKey = ctx.match[1];
          const langMode = adminQuizDrafts[userId]?.preferredLang || 'auto';
          const subjMap = {
            physics: 'ፊዚክስ',
            chem: 'ኬሚስትሪ',
            bio: 'ባዮሎጂ',
            math: 'ማቲማቲክስ',
            english: 'English Grammar',
            general: 'የኢትዮጵያ ታሪክ እና ጂኦግራፊ'
          };
          const subjName = subjMap[subjKey] || subjKey;
          await ctx.answerCbQuery(`የ ${subjName} ጥያቄ እየተዘጋጀ ነው...`).catch(() => {});

          const quizData = await getOrGenerateQuiz(subjName, langMode, env);
          adminQuizDrafts[userId] = {
            title: subjName,
            langMode,
            ...quizData,
            question: cleanQuestionText(quizData.question)
          };
          return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
        });

        bot.action('quiz_prompt_custom_topic', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminQuizDrafts[userId] = { ...(adminQuizDrafts[userId] || {}), step: 'AWAITING_TOPIC' };

          const text =
`✏️ <b>የኩዊዙን ርዕስ ወይም ክፍል ይጻፉ:</b>
━━━━━━━━━━━━━━━━━━━━
ማንኛውንም የትምህርት ርዕስ፣ ምዕራፍ፣ ወይም ክፍል ከታች ባለው የሜሴጅ መጻፊያ ሳጥን ውስጥ ጽፈው ይላኩ:

<i>ምሳሌ:</i>
• <code>Grade 10 Biology Genetics</code> (በ English)
• <code>10ኛ ክፍል ፊዚክስ Work and Energy</code>
• <code>12ኛ ክፍል ኬሚስትሪ Equilibrium</code>
• <code>en Grade 11 Physics</code> (ሙሉ በሙሉ English ለማድረግ)
• <code>am 11ኛ ክፍል ባዮሎጂ</code> (ሙሉ በሙሉ አማርኛ ለማድረግ)`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'quiz_cancel')]
          ]);

          return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
        });

        bot.action('quiz_prompt_manual_write', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminQuizDrafts[userId] = { ...(adminQuizDrafts[userId] || {}), step: 'AWAITING_MANUAL_INPUT' };

          const text =
`📝 <b>የራስዎን ጥያቄ እና አማራጮች ይጻፉ:</b>
━━━━━━━━━━━━━━━━━━━━
ጥያቄውን፣ አማራጮቹን እና ማብራሪያውን በሚከተለው ቅርጽ ጽፈው ይላኩ:

ጥያቄ: የብርሃን ፍጥነት በቫኪዩም ውስጥ ስንት ነው?
A) 3 x 10^8 m/s*
B) 3 x 10^6 m/s
C) 1.5 x 10^8 m/s
D) 3 x 10^5 m/s
ማብራሪያ: የብርሃን ፍጥነት 3 x 10^8 m/s ነው።

💡 <b>ጠቃሚ ማስታወሻ:</b>
• ትክክለኛው መልስ ላይ <b>ኮከብ (*)</b> ምልክት ያድርጉበት።
• አማራጮች ከ 2 እስከ 10 መሆን ይችላሉ።`;

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'quiz_cancel')]
          ]);

          return ctx.reply(text, { parse_mode: 'HTML', ...keyboard });
        });

        bot.action('quiz_switch_lang_en', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const draft = adminQuizDrafts[userId];
          if (!draft) return ctx.answerCbQuery('⚠️ ጥያቄ አልተገኘም!', { show_alert: true });
          await ctx.answerCbQuery('ወደ 100% English እየተቀየረ ነው...').catch(() => {});

          const topic = draft.title || 'Academic Quiz';
          const newQuiz = await getOrGenerateQuiz(topic, 'english', env);
          adminQuizDrafts[userId] = {
            title: topic,
            langMode: 'english',
            ...newQuiz,
            question: cleanQuestionText(newQuiz.question)
          };
          return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
        });

        bot.action('quiz_switch_lang_am', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const draft = adminQuizDrafts[userId];
          if (!draft) return ctx.answerCbQuery('⚠️ ጥያቄ አልተገኘም!', { show_alert: true });
          await ctx.answerCbQuery('ወደ ሙሉ አማርኛ እየተቀየረ ነው...').catch(() => {});

          const topic = draft.title || 'Academic Quiz';
          const newQuiz = await getOrGenerateQuiz(topic, 'amharic', env);
          adminQuizDrafts[userId] = {
            title: topic,
            langMode: 'amharic',
            ...newQuiz,
            question: cleanQuestionText(newQuiz.question)
          };
          return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
        });

        bot.action('quiz_regen', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const current = adminQuizDrafts[userId];
          const topic = current?.title || 'Academic Quiz';
          const langMode = current?.langMode || 'auto';

          await ctx.answerCbQuery('አዲስ ጥያቄ እየተዘጋጀ ነው...').catch(() => {});
          const quizData = await getOrGenerateQuiz(topic, langMode, env);
          adminQuizDrafts[userId] = {
            title: topic,
            langMode,
            ...quizData,
            question: cleanQuestionText(quizData.question)
          };
          return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
        });

        bot.action('quiz_post_channel', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const draft = adminQuizDrafts[userId];
          if (!draft || !draft.question) {
            return ctx.answerCbQuery('⚠️ ጥያቄ አልተገኘም፣ እባክዎ እንደገና ይጀምሩ!', { show_alert: true });
          }
          await ctx.answerCbQuery('ወደ ቻናል እየተላከ ነው...').catch(() => {});
          delete adminQuizDrafts[userId];
          return dispatchPollToDestination(ctx, draft, 'channel', env);
        });

        bot.action('quiz_post_group', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const draft = adminQuizDrafts[userId];
          if (!draft || !draft.question) {
            return ctx.answerCbQuery('⚠️ ጥያቄ አልተገኘም፣ እባክዎ እንደገና ይጀምሩ!', { show_alert: true });
          }
          await ctx.answerCbQuery('ወደ ግሩፕ እየተላከ ነው...').catch(() => {});
          delete adminQuizDrafts[userId];
          return dispatchPollToDestination(ctx, draft, 'group', env);
        });

        bot.action('quiz_post_both', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          const draft = adminQuizDrafts[userId];
          if (!draft || !draft.question) {
            return ctx.answerCbQuery('⚠️ ጥያቄ አልተገኘም፣ እባክዎ እንደገና ይጀምሩ!', { show_alert: true });
          }
          await ctx.answerCbQuery('ወደ ቻናል እና ግሩፕ እየተላከ ነው...').catch(() => {});
          delete adminQuizDrafts[userId];
          return dispatchPollToDestination(ctx, draft, 'both', env);
        });

        bot.action('quiz_config_dest', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const channelHandle = await getDynamicConfig(env, 'poll_channel', await getDynamicConfig(env, 'official_channel', '@SmartX_Discussion'));
          const groupHandle = await getDynamicConfig(env, 'poll_group', await getDynamicConfig(env, 'discussion_group', '@SmartX_Ethio'));

          const text =
`⚙️ <b>የፖል እና ኩዊዝ ዒላማ ማስተካከያ (Destination Config)</b>
━━━━━━━━━━━━━━━━━━━━
ፖሎች በራስ-ሰር የሚለጠፉባቸው ቻናሎች እና ግሩፖች:

• 📢 <b>አሁን ያለው ቻናል:</b> <code>${escapeHtml(channelHandle)}</code>
• 👥 <b>አሁን ያለው ግሩፕ:</b> <code>${escapeHtml(groupHandle)}</code>

ለመቀየር ከታች ካሉት አዝራሮች አንዱን ይጫኑ ⬇️`;

          const keyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('📢 ቻናል ቀይር', 'quiz_set_dest_channel'),
              Markup.button.callback('👥 ግሩፕ ቀይር', 'quiz_set_dest_group')
            ],
            [
              Markup.button.callback('🔙 ወደ ፖል ማዕከል', 'admin_poll_quiz_menu')
            ]
          ]);

          return transitionToNewStep(ctx, text, keyboard);
        });

        bot.action('quiz_set_dest_channel', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminQuizDrafts[userId] = { step: 'AWAITING_CHANNEL_HANDLE' };
          return ctx.reply('📢 <b>አዲሱን የቴሌግራም ቻናል username ይላኩ (ምሳሌ: @SmartX_Discussion):</b>', { parse_mode: 'HTML' });
        });

        bot.action('quiz_set_dest_group', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminQuizDrafts[userId] = { step: 'AWAITING_GROUP_HANDLE' };
          return ctx.reply('👥 <b>አዲሱን የቴሌግራም ግሩፕ username ይላኩ (ምሳሌ: @SmartX_Ethio):</b>', { parse_mode: 'HTML' });
        });

        bot.action('quiz_cancel', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery('ተሰርዟል!').catch(() => {});
          delete adminQuizDrafts[userId];
          await ctx.reply('❌ <b>የኩዊዝ ዝግጅቱ ተሰርዟል።</b>', { parse_mode: 'HTML' });
          return renderPollManagerDashboard(ctx, env);
        });

        bot.action('admin_refresh_stats', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          await ctx.answerCbQuery('Refreshing stats...').catch(() => {});
          const { text, keyboard } = await buildAdminDashboardData(env);

          try {
            await ctx.editMessageText(text, { parse_mode: 'HTML', ...keyboard });
          } catch (err) {
            return transitionToNewStep(ctx, text, keyboard);
          }
        });

        // --- ADMIN: MANAGE PROMO TEMPLATES & CUSTOM BUTTONS ---
        bot.action('admin_manage_templates', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          let templates = defaultPromoTemplates;
          if (env?.DB) {
            try {
              const rows = await env.DB.prepare('SELECT id, title, grade, button_text, content_html FROM promo_templates WHERE is_active = 1 ORDER BY id ASC').all();
              if (rows?.results && rows.results.length > 0) {
                templates = rows.results;
              }
            } catch (e) {}
          }

          let text = '📝 <b>የግሩፕ መልዕክት ቴምፕሌቶች አስተዳደር:</b>\n━━━━━━━━━━━━━━━━━━━━\n';
          const tplButtons = [];

          templates.forEach((t) => {
            text += `• <b>[ID: ${t.id}]</b> ${escapeHtml(t.title)}\n  └ ክፍል: <code>${t.grade}</code> | አዝራር: <code>${escapeHtml(t.button_text || '✨ አዎ! እንፈልጋለን')}</code>\n`;
            tplButtons.push([
              Markup.button.callback(`👁️ ቅድመ-እይታ: ID ${t.id}`, `admin_tpl_prev_${t.id}`)
            ]);
          });
          text += '\nአዲስ ቴምፕሌት ለመጨመር ወይም ያለውን ለመፈተሽ ከታች ይምረጡ ⬇️';

          tplButtons.push([Markup.button.callback('➕ አዲስ ቴምፕሌት ጨምር', 'admin_add_tpl_start')]);
          tplButtons.push([Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]);

          const keyboard = Markup.inlineKeyboard(tplButtons);
          return transitionToNewStep(ctx, text, keyboard);
        });

        // Admin: Preview Specific Promo Template
        bot.action(/admin_tpl_prev_(\d+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const tplId = parseInt(ctx.match[1], 10);
          let template = defaultPromoTemplates.find(t => t.id === tplId);

          if (env?.DB) {
            try {
              const row = await env.DB.prepare('SELECT id, title, grade, button_text, content_html FROM promo_templates WHERE id = ?').bind(tplId).first();
              if (row) template = row;
            } catch (e) {}
          }

          if (!template) {
            return ctx.answerCbQuery('⚠️ ቴምፕሌቱ አልተገኘም!', { show_alert: true });
          }

          const btnLabel = template.button_text || '✨ አዎ! እንፈልጋለን';
          const botUsername = getBotUsername(ctx, env);

          // 1. Send the rendered preview message with the exact interactive inline button
          try {
            await ctx.reply(template.content_html, {
              parse_mode: 'HTML',
              disable_web_page_preview: true,
              reply_markup: {
                inline_keyboard: [[{ text: btnLabel, callback_data: `want_notes_ref_${userId}` }]]
              }
            });
          } catch (err) {
            await ctx.reply(`⚠️ የ HTML ይዘት ማሳየት አልተቻለም: ${err.message}\n\n<code>${escapeHtml(template.content_html)}</code>`, { parse_mode: 'HTML' });
          }

          // 2. Send control details
          const infoText =
`👁️ <b>የግሩፕ ቴምፕሌት ውጤትና ቅድመ-እይታ:</b>
━━━━━━━━━━━━━━━━━━━━
• 🆔 <b>መለያ:</b> <code>#${template.id}</code>
• 📌 <b>ርዕስ:</b> ${escapeHtml(template.title)}
• 🎓 <b>የክፍል ደረጃ:</b> <code>${template.grade}</code>
• 🔘 <b>የአዝራር ጽሑፍ:</b> <code>${escapeHtml(btnLabel)}</code>

ተማሪዎች በግሩፖች ውስጥ <b>@${botUsername}</b> ብለው ሲጠሩ ይህ መልዕክት ከላይ ባለው መልኩ ይላካል!`;

          const infoKb = Markup.inlineKeyboard([
            [Markup.button.callback('📝 ወደ ቴምፕሌቶች ዝርዝር', 'admin_manage_templates')],
            [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
          ]);

          return ctx.reply(infoText, { parse_mode: 'HTML', ...infoKb });
        });

        // Admin Step 1: Start Adding Template
        bot.action('admin_add_tpl_start', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminActionDrafts[userId] = { action: 'ADD_TEMPLATE', step: 'AWAITING_TITLE' };

          const text =
`📝 <b>ደረጃ 1 ከ 4: የቴምፕሌት ርዕስ:</b>
━━━━━━━━━━━━━━━━━━━━
እባክዎ በ Inline ዝርዝር ውስጥ እንዲታይ የሚፈልጉትን አጭር ርዕስ ይላኩ

ምሳሌ: <code>📘 ለ 10ኛ ክፍል ፊዚክስ ሞዴል ጥያቄዎች</code>`;

          const cancelKb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
          ]);

          return transitionToNewStep(ctx, text, cancelKb);
        });

        bot.action('admin_cancel_draft', async (ctx) => {
          const userId = ctx.from.id;
          delete adminActionDrafts[userId];
          delete broadcastDrafts[userId];
          await ctx.answerCbQuery('ተሰርዟል!').catch(() => {});
          return handleAdminDashboard(ctx);
        });

        // Admin Step 2 Selection: Grade for Template
        bot.action(/admin_tpl_grade_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const selectedGrade = ctx.match[1];
          if (!adminActionDrafts[userId]) {
            adminActionDrafts[userId] = { action: 'ADD_TEMPLATE' };
          }
          adminActionDrafts[userId].grade = selectedGrade;
          adminActionDrafts[userId].step = 'AWAITING_BUTTON_TEXT';

          const text =
`📝 <b>ደረጃ 3 ከ 4: የአዝራር ስም:</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(adminActionDrafts[userId].title || 'N/A')}
• 🎓 <b>ክፍል:</b> <code>${selectedGrade}</code>

በግሩፕ መልዕክቱ ስር የሚታየውን የአዝራር ስም ይጻፉ ወይም ከታች ካሉት አንዱን ይምረጡ ⬇️`;

          const defaultBtnKb = Markup.inlineKeyboard([
            [Markup.button.callback('✨ አዎ! እንፈልጋለን', 'admin_tpl_btn_default')],
            [Markup.button.callback('📚 ማጠቃለያዎችን አግኝ', 'admin_tpl_btn_notes')],
            [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
          ]);

          return transitionToNewStep(ctx, text, defaultBtnKb);
        });

        // Admin Quick Button Selection
        bot.action(['admin_tpl_btn_default', 'admin_tpl_btn_notes'], async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const btnText = ctx.callbackQuery.data === 'admin_tpl_btn_default' ? '✨ አዎ! እንፈልጋለን' : '📚 ማጠቃለያዎችን አግኝ';
          if (adminActionDrafts[userId]) {
            adminActionDrafts[userId].buttonText = btnText;
            adminActionDrafts[userId].step = 'AWAITING_HTML_BODY';
          }

          const text =
`📝 <b>ደረጃ 4 ከ 4: የ HTML መልዕክት ይዘት:</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(adminActionDrafts[userId]?.title || 'N/A')}
• 🎓 <b>ክፍል:</b> <code>${adminActionDrafts[userId]?.grade || 'All'}</code>
• 🔘 <b>አዝራር:</b> <code>${btnText}</code>

እባክዎ በግሩፕ ላይ የሚለቀቀውን ማራኪ መልዕክት በ <b>HTML ፎርማት</b> ይላኩ ⬇️`;

          const cancelKb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
          ]);

          return transitionToNewStep(ctx, text, cancelKb);
        });

        // Save Template Action from Live Preview
        bot.action('admin_tpl_save_draft', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const adminDraft = adminActionDrafts[userId];
          if (!adminDraft || !adminDraft.htmlContent) {
            return ctx.answerCbQuery('⚠️ ቴምፕሌት አልተገኘም!', { show_alert: true });
          }

          const title = adminDraft.title;
          const grade = adminDraft.grade || 'All';
          const buttonText = adminDraft.buttonText || '✨ አዎ! እንፈልጋለን';
          const htmlContent = adminDraft.htmlContent;

          if (env?.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO promo_templates (title, grade, button_text, content_html, is_active)
                VALUES (?, ?, ?, ?, 1)
              `).bind(title, grade, buttonText, htmlContent).run();

              delete adminActionDrafts[userId];

              return transitionToNewStep(ctx,
`✅ <b>አዲስ የመልዕክት ቴምፕሌት በተሳካ ሁኔታ ተቀምጧል!</b> 🎉
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(title)}
• 🎓 <b>ክፍል:</b> <code>${grade}</code>
• 🔘 <b>የአዝራር ስም:</b> <code>${escapeHtml(buttonText)}</code>

አሁን ማንኛውም ተማሪ ወይም አድሚን በቴሌግራም ግሩፖች ውስጥ <b>@${getBotUsername(ctx, env)}</b> ብሎ ሲጠራ ይህንን መልዕክት በቀጥታ መላክ ይችላል!`,
                Markup.inlineKeyboard([
                  [Markup.button.callback('📝 ወደ ቴምፕሌቶች ዝርዝር', 'admin_manage_templates')],
                  [Markup.button.callback('📊 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
                ])
              );
            } catch (err) {
              return transitionToNewStep(ctx, `❌ Failed to save template: ${err.message}`);
            }
          }

          delete adminActionDrafts[userId];
          return transitionToNewStep(ctx, '✅ ቴምፕሌቱ በተሳካ ሁኔታ ተቀምጧል!');
        });

        bot.action('admin_recent_users', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          let userListText = '👥 <b>የመጨረሻዎቹ 10 ተመዝጋቢ ተማሪዎች:</b>\n━━━━━━━━━━━━━━━━━━━━\n';
          if (env?.DB) {
            try {
              const rows = await env.DB.prepare(`
                SELECT telegram_id, full_name, phone, grade, language, points, registered_at
                FROM users 
                ORDER BY registered_at DESC 
                LIMIT 10
              `).all();

              if (rows?.results && rows.results.length > 0) {
                rows.results.forEach((u, i) => {
                  userListText += `${i + 1}. <b>${escapeHtml(u.full_name)}</b> — ${escapeHtml(u.grade)} | <code>${escapeHtml(u.phone)}</code>\n   ⭐️ ${u.points} pts | 📅 ${new Date(u.registered_at).toLocaleDateString()}\n`;
                });
              } else {
                userListText += 'ምንም ተጠቃሚ አልተገኘም።';
              }
            } catch (e) {
              userListText += 'Error fetching users.';
            }
          } else {
            const memoryList = Object.values(registeredUsers).slice(-10).reverse();
            if (memoryList.length > 0) {
              memoryList.forEach((u, i) => {
                userListText += `${i + 1}. <b>${escapeHtml(u.full_name || 'ተማሪ')}</b> — ${escapeHtml(u.grade || 'N/A')} | <code>${escapeHtml(u.phone || 'N/A')}</code>\n   ⭐️ ${u.points || 0} pts | 📅 ${new Date(u.registered_at || Date.now()).toLocaleDateString()}\n`;
              });
            } else {
              userListText += 'ምንም ተጠቃሚ አልተገኘም።';
            }
          }

          const backKb = Markup.inlineKeyboard([
            [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
          ]);

          return transitionToNewStep(ctx, userListText, backKb);
        });

        // --- ADMIN: SAMPLE HTML TEMPLATES (HIGH CONVERTING PROMO & BROADCAST SAMPLES) ---
        bot.action('admin_sample_templates', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          let text =
`📋 <b>የተዘጋጁ የ HTML ቴምፕሌቶች (Sample Templates):</b>
━━━━━━━━━━━━━━━━━━━━
እነዚህ ቴምፕሌቶች ከፍተኛ ተሳትፎ እና ምዝገባ ለማምጣት በ <b>HTML ፎርማት</b> እና በ <b>Link/Inline አዝራሮች</b> የተዘጋጁ ናቸው።

አንዱን በመምረጥ ቅድመ-እይታውን መመልከት፣ ኮዱን መውሰድ ወይም በቀጥታ ወደ ብሮድካስት/ቴምፕሌት መጫን ይችላሉ ⬇️`;

          const btns = sampleHtmlTemplates.map((s) => [
            Markup.button.callback(s.title, `admin_view_sample_${s.id}`)
          ]);

          btns.push([Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]);

          return transitionToNewStep(ctx, text, Markup.inlineKeyboard(btns));
        });

        // Admin: View & Load Sample Template
        bot.action(/admin_view_sample_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const sampleId = ctx.match[1];
          const sample = sampleHtmlTemplates.find(s => s.id === sampleId);

          if (!sample) {
            return ctx.answerCbQuery('⚠️ ናሙናው አልተገኘም!', { show_alert: true });
          }

          // 1. Send the rendered live sample message
          try {
            const extra = {
              parse_mode: 'HTML',
              disable_web_page_preview: true
            };
            if (sample.category === 'group') {
              extra.reply_markup = {
                inline_keyboard: [[{ text: sample.button_text || '✨ አዎ! እንፈልጋለን', callback_data: `want_notes_ref_${userId}` }]]
              };
            } else {
              extra.reply_markup = {
                inline_keyboard: [
                  [{ text: '👥 የውይይት ግሩፕ', url: 'https://t.me/SmartX_Ethio' }, { text: '📢 ኦፊሴላዊ ቻናል', url: 'https://t.me/SmartX_Discussion' }],
                  [{ text: '👨‍💻 የደንበኞች ድጋፍ', url: 'https://t.me/smart_x_help' }]
                ]
              };
            }
            await ctx.reply(sample.html_code, extra);
          } catch (e) {
            console.warn('Sample render error:', e.message);
          }

          // 2. Send Control Box with Raw HTML Code & 1-Click Load Buttons
          const detailText =
`👁️ <b>የናሙናው ዝርዝርና የ HTML ኮድ:</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(sample.title)}
• 🎯 <b>አይነት:</b> <code>${sample.category === 'group' ? 'የግሩፕ መልዕክት (Group Promo)' : 'የብሮድካስት ማስታወቂያ (Broadcast)'}</code>
• 🔘 <b>የአዝራር ስም:</b> <code>${escapeHtml(sample.button_text || 'Link Buttons')}</code>

📄 <b>የሚገለበጥ የ HTML ኮድ (Copyable HTML):</b>
<pre><code>${escapeHtml(sample.html_code)}</code></pre>

ይህንን ናሙና በቀጥታ ወደ ስራ ማስገባት ይፈልጋሉ?`;

          const actionKb = Markup.inlineKeyboard([
            [
              Markup.button.callback('🚀 ወደ ብሮድካስት ጫን (Load to Broadcast)', `admin_load_bcast_${sample.id}`),
              Markup.button.callback('📝 ወደ ግሩፕ ቴምፕሌት አስቀምጥ', `admin_load_tpl_${sample.id}`)
            ],
            [
              Markup.button.callback('📋 ወደ ናሙናዎች ዝርዝር', 'admin_sample_templates'),
              Markup.button.callback('📊 ወደ ዳሽቦርድ', 'admin_refresh_stats')
            ]
          ]);

          return ctx.reply(detailText, { parse_mode: 'HTML', ...actionKb });
        });

        // Admin: 1-Click Load Sample into Broadcast Draft
        bot.action(/admin_load_bcast_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery('ብሮድካስት ተዘጋጅቷል!').catch(() => {});

          const sampleId = ctx.match[1];
          const sample = sampleHtmlTemplates.find(s => s.id === sampleId);
          if (!sample) return;

          const fakeMsg = { text: sample.html_code };
          const payload = extractMessagePayload(fakeMsg);
          if (!payload.buttons || payload.buttons.length === 0) {
            payload.buttons = [
              [{ text: '👥 የውይይት ግሩፕ', url: 'https://t.me/SmartX_Ethio' }, { text: '📢 ኦፊሴላዊ ቻናል', url: 'https://t.me/SmartX_Discussion' }],
              [{ text: '👨‍💻 የደንበኞች ድጋፍ', url: 'https://t.me/smart_x_help' }]
            ];
          }

          broadcastDrafts[userId] = {
            step: 'PREVIEW_AND_CONFIRM',
            payload
          };

          return showBroadcastPreviewToAdmin(ctx, userId, payload);
        });

        // Admin: 1-Click Save Sample into Group Promo Templates
        bot.action(/admin_load_tpl_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const sampleId = ctx.match[1];
          const sample = sampleHtmlTemplates.find(s => s.id === sampleId);
          if (!sample) return;

          if (env?.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO promo_templates (title, grade, button_text, content_html, is_active)
                VALUES (?, ?, ?, ?, 1)
              `).bind(sample.title, sample.grade || 'All', sample.button_text || '✨ አዎ! እንፈልጋለን', sample.html_code).run();

              return transitionToNewStep(ctx,
`✅ <b>የናሙና ቴምፕሌት በተሳካ ሁኔታ ወደ ዳታቤዝ ተቀምጧል!</b> 🎉
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(sample.title)}
• 🎓 <b>ክፍል:</b> <code>${sample.grade || 'All'}</code>
• 🔘 <b>የአዝራር ስም:</b> <code>${escapeHtml(sample.button_text || '✨ አዎ! እንፈልጋለን')}</code>

አሁን በቴሌግራም ግሩፖች ውስጥ <b>@${getBotUsername(ctx, env)}</b> ብለው ሲጠሩ ይህንን መልዕክት በቀጥታ መላክ ይችላሉ!`,
                Markup.inlineKeyboard([
                  [Markup.button.callback('📝 ወደ ቴምፕሌቶች ዝርዝር', 'admin_manage_templates')],
                  [Markup.button.callback('📊 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
                ])
              );
            } catch (err) {
              return transitionToNewStep(ctx, `❌ Failed to save template: ${err.message}`);
            }
          }

          return transitionToNewStep(ctx, '✅ ናሙናው በተሳካ ሁኔታ ተቀምጧል!');
        });

        // --- BROADCAST SYSTEM WITH RICH HTML, LINK BUTTONS & LIVE PREVIEW ---
        const handleNewBroadcastInit = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) {
            return ctx.reply(`⛔ <b>ይቅርታ፣ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!</b>\n\nየእርስዎ ID: <code>${userId}</code>`, { parse_mode: 'HTML' });
          }

          broadcastDrafts[userId] = { step: 'AWAITING_MESSAGE' };
          return transitionToNewStep(ctx,
`📢 <b>የአዲስ ብሮድካስት መልዕክት ማዘጋጃ:</b>
━━━━━━━━━━━━━━━━━━━━
እባክዎ ለሁሉም ተማሪዎች የሚላከውን መልዕክት ይላኩ።

✨ <b>የሚደገፉ የ HTML ፎርማቶች:</b>
• <code>&lt;b&gt;ደማቅ ጽሑፍ&lt;/b&gt;</code>
• <code>&lt;i&gt;ሰያፍ ጽሑፍ&lt;/i&gt;</code>
• <code>&lt;u&gt;ከስር የተሰመረበት&lt;/u&gt;</code>
• <code>&lt;s&gt;የተሰረዘ ጽሑፍ&lt;/s&gt;</code>
• <code>&lt;code&gt;ኮድ ወይም ቁጥር&lt;/code&gt;</code>
• <code>&lt;a href="https://t.me/SmartXEthiopia"&gt;የሊንክ ጽሑፍ&lt;/a&gt;</code>

🔘 <b>Inline አዝራር / Link Button ለመጨመር:</b>
ከመልዕክትዎ ስር በሚከተለው መልኩ ይጻፉ:
<code>[የአዝራሩ ስም | https://t.me/smart_x_help]</code>

ፎቶ፣ ቪዲዮ፣ ድምፅ፣ ዶክመንት ወይም ጽሑፍ መላክ ይችላሉ ⬇️`,
            Markup.inlineKeyboard([[Markup.button.callback('❌ ሰርዝ', 'admin_cancel_broadcast')]])
          );
        };

        bot.command('broadcast', handleNewBroadcastInit);
        bot.action('admin_new_broadcast', handleNewBroadcastInit);

        bot.action('admin_cancel_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          delete broadcastDrafts[userId];
          await ctx.answerCbQuery('ብሮድካስት ተሰርዟል!').catch(() => {});
          return handleAdminDashboard(ctx);
        });

        // Prompt Admin to Add Custom Link Button
        bot.action('admin_bcast_add_btn_prompt', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          if (broadcastDrafts[userId]) {
            broadcastDrafts[userId].step = 'AWAITING_EXTRA_BUTTON';
          }

          const text =
`🔘 <b>የ Link Button ማከያ:</b>
━━━━━━━━━━━━━━━━━━━━
እባክዎ የአዝራሩን ስም እና ድረ-ገጽ/ቴሌግራም ሊንክ በሚከተለው መልኩ ይላኩ:

<code>የአዝራሩ ስም | https://t.me/smart_x_help</code>`;

          const cancelKb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'admin_bcast_show_preview')]
          ]);

          return transitionToNewStep(ctx, text, cancelKb);
        });

        // Helper: Render and display Broadcast Preview to Admin
        const showBroadcastPreviewToAdmin = async (ctx, userId, payload) => {
          const draft = broadcastDrafts[userId] || {};
          const targetGrade = draft.targetGrade || 'All';
          const extra = {
            parse_mode: 'HTML',
            disable_web_page_preview: false
          };

          if (payload.buttons && Array.isArray(payload.buttons) && payload.buttons.length > 0) {
            extra.reply_markup = {
              inline_keyboard: payload.buttons
            };
          }

          // 1. Send the exact rendered message preview
          try {
            if (payload.type === 'photo' && payload.file_id) {
              await ctx.replyWithPhoto(payload.file_id, { caption: payload.caption || '', ...extra });
            } else if (payload.type === 'video' && payload.file_id) {
              await ctx.replyWithVideo(payload.file_id, { caption: payload.caption || '', ...extra });
            } else if (payload.type === 'audio' && payload.file_id) {
              await ctx.replyWithAudio(payload.file_id, { caption: payload.caption || '', ...extra });
            } else if (payload.type === 'voice' && payload.file_id) {
              await ctx.replyWithVoice(payload.file_id, { caption: payload.caption || '', ...extra });
            } else if (payload.type === 'document' && payload.file_id) {
              await ctx.replyWithDocument(payload.file_id, { caption: payload.caption || '', ...extra });
            } else {
              await ctx.reply(payload.text || 'Notification Preview', extra);
            }
          } catch (err) {
            await ctx.reply(`⚠️ የ HTML ቅርጸት ስህተት: ${err.message}\nእባክዎ የከፈቷቸውን የ HTML ታጎች በትክክል መዝጋትዎን ያረጋግጡ።`, { parse_mode: 'HTML' });
          }

          // Calculate estimated recipients
          let estimatedRecipients = 0;
          if (env?.DB) {
            try {
              if (targetGrade === 'All') {
                const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE is_active = 1').first();
                estimatedRecipients = countRow?.total || 0;
              } else {
                const countRow = await env.DB.prepare(`
                  SELECT COUNT(*) as total 
                  FROM users 
                  WHERE is_active = 1 
                    AND (grade = ? OR grade LIKE ? OR grade LIKE ?)
                `).bind(`${targetGrade}ኛ ክፍል`, `%${targetGrade}%`, `Grade ${targetGrade}`).first();
                estimatedRecipients = countRow?.total || 0;
              }
            } catch (e) {}
          }

          // 2. Send Control Box with Action Buttons
          const totalBtns = payload.buttons ? payload.buttons.flat().length : 0;
          const gradeDisplay = targetGrade === 'All' ? '📚 ሁሉም ክፍሎች (All)' : `🎓 ${targetGrade}ኛ ክፍል`;

          const controlText =
`👁️ <b>የብሮድካስት ቅድመ-እይታ ተዘጋጅቷል!</b>
━━━━━━━━━━━━━━━━━━━━
ከላይ የሚታየው መልዕክት ለተጠቃሚዎች የሚደርሰው ትክክለኛ ቅድመ-እይታ ነው።

• 📌 <b>የመልዕክት አይነት:</b> <code>${payload.type}</code>
• 🎯 <b>የታለመው ክፍል:</b> <code>${gradeDisplay}</code>
• 👥 <b>ተቀባዮች (ግምት):</b> <code>${estimatedRecipients} ተማሪዎች</code>
• 🔘 <b>የአዝራሮች ብዛት:</b> <code>${totalBtns}</code>
• ⚡ <b>የመላኪያ ፍጥነት:</b> <code>20 ተጠቃሚዎች በአንድ ዙር</code>

ይህ መልዕክት ለተጠቃሚዎች እንዲላክ ይፈልጋሉ?`;

          const controlKb = Markup.inlineKeyboard([
            [
              Markup.button.callback('🚀 Start Broadcast', 'admin_confirm_send_broadcast'),
              Markup.button.callback('🎯 ክፍል ምረጥ', 'admin_bcast_target_select')
            ],
            [
              Markup.button.callback('➕ Link Button ጨምር', 'admin_bcast_add_btn_prompt'),
              Markup.button.callback('✏️ እንደገና አርትዕ', 'admin_new_broadcast')
            ],
            [
              Markup.button.callback('❌ ሰርዝ', 'admin_cancel_broadcast')
            ]
          ]);

          return ctx.reply(controlText, { parse_mode: 'HTML', ...controlKb });
        };

        bot.action('admin_bcast_show_preview', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const draft = broadcastDrafts[userId];
          if (draft?.payload) {
            draft.step = 'PREVIEW_AND_CONFIRM';
            return showBroadcastPreviewToAdmin(ctx, userId, draft.payload);
          }
          return handleAdminDashboard(ctx);
        });

        // Broadcast Target Grade Selection
        bot.action('admin_bcast_target_select', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const gradeKb = Markup.inlineKeyboard([
            [
              Markup.button.callback('📗 9ኛ ክፍል', 'admin_bcast_target_9'),
              Markup.button.callback('📘 10ኛ ክፍል', 'admin_bcast_target_10')
            ],
            [
              Markup.button.callback('📙 11ኛ ክፍል', 'admin_bcast_target_11'),
              Markup.button.callback('🎓 12ኛ ክፍል', 'admin_bcast_target_12')
            ],
            [
              Markup.button.callback('📚 ሁሉም ክፍሎች (All)', 'admin_bcast_target_All')
            ],
            [
              Markup.button.callback('🔙 ወደ ቅድመ-እይታ', 'admin_bcast_show_preview')
            ]
          ]);

          return transitionToNewStep(ctx, '🎯 <b>ይህ ብሮድካስት ለየትኛው የክፍል ደረጃ ተማሪዎች እንዲላክ ይፈልጋሉ?</b>\n\nከታች አንዱን ይምረጡ ⬇️', gradeKb);
        });

        bot.action(/admin_bcast_target_(.+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const selectedTarget = ctx.match[1];
          if (broadcastDrafts[userId]) {
            broadcastDrafts[userId].targetGrade = selectedTarget;
            broadcastDrafts[userId].step = 'PREVIEW_AND_CONFIRM';
            return showBroadcastPreviewToAdmin(ctx, userId, broadcastDrafts[userId].payload);
          }
          return handleAdminDashboard(ctx);
        });

        // Combined Admin Message Listener (Broadcasts & Template Addition)
        bot.on(['message'], async (ctx, next) => {
          const userId = ctx.from.id;
          const draft = broadcastDrafts[userId];
          const adminDraft = adminActionDrafts[userId];

          // Flow 1: Admin Adding New Promo Template
          if (adminDraft && adminDraft.action === 'ADD_TEMPLATE' && isAdmin(userId, env)) {
            if (adminDraft.step === 'AWAITING_TITLE') {
              const titleText = (ctx.message.text || '').trim();
              if (titleText.length === 0) {
                return ctx.reply('⚠️ እባክዎ ትክክለኛ የቴምፕሌት ርዕስ ይጻፉ:');
              }
              adminDraft.title = titleText;
              adminDraft.step = 'AWAITING_GRADE_SELECT';

              const gradeKb = Markup.inlineKeyboard([
                [
                  Markup.button.callback('📗 9ኛ ክፍል', 'admin_tpl_grade_9'),
                  Markup.button.callback('📘 10ኛ ክፍል', 'admin_tpl_grade_10')
                ],
                [
                  Markup.button.callback('📙 11ኛ ክፍል', 'admin_tpl_grade_11'),
                  Markup.button.callback('🎓 12ኛ ክፍል', 'admin_tpl_grade_12')
                ],
                [
                  Markup.button.callback('📚 ሁሉም ክፍሎች', 'admin_tpl_grade_All')
                ],
                [
                  Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')
                ]
              ]);

              return transitionToNewStep(ctx, `📝 <b>ደረጃ 2 ከ 4: የታለመው የክፍል ደረጃ:</b>\n\n• 📌 <b>ርዕስ:</b> ${escapeHtml(adminDraft.title)}\n\nክፍሉን ይምረጡ ⬇️`, gradeKb);
            }

            if (adminDraft.step === 'AWAITING_BUTTON_TEXT') {
              const bText = (ctx.message.text || '').trim() || '✨ አዎ! እንፈልጋለን';
              adminDraft.buttonText = bText;
              adminDraft.step = 'AWAITING_HTML_BODY';

              const text =
`📝 <b>ደረጃ 4 ከ 4: የ HTML መልዕክት ይዘት:</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(adminDraft.title)}
• 🎓 <b>ክፍል:</b> <code>${adminDraft.grade || 'All'}</code>
• 🔘 <b>አዝራር:</b> <code>${escapeHtml(adminDraft.buttonText)}</code>

እባክዎ በግሩፕ ላይ የሚለቀቀውን ማራኪ መልዕክት በ <b>HTML ፎርማት</b> ይላኩ ⬇️`;

              const cancelKb = Markup.inlineKeyboard([
                [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
              ]);

              return transitionToNewStep(ctx, text, cancelKb);
            }

            if (adminDraft.step === 'AWAITING_HTML_BODY') {
              const htmlContent = (ctx.message.text || '').trim();
              const valRes = validateTelegramHtml(htmlContent);

              if (!valRes.valid) {
                return ctx.reply(
`⚠️ <b>የ HTML ፎርማት ስህተት ተገኝቷል:</b>
━━━━━━━━━━━━━━━━━━━━
• ❌ <b>ስህተት:</b> ${escapeHtml(valRes.error)}

እባክዎ የከፈቷቸውን ታጎች (ለምሳሌ <code>&lt;b&gt;...&lt;/b&gt;</code>) በትክክል አስተካክለው እንደገና ይላኩ ⬇️`,
                  {
                    parse_mode: 'HTML',
                    reply_markup: {
                      inline_keyboard: [[Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]]
                    }
                  }
                );
              }

              adminDraft.htmlContent = htmlContent;
              adminDraft.step = 'CONFIRM_TEMPLATE';

              const btnLabel = adminDraft.buttonText || '✨ አዎ! እንፈልጋለን';

              // Show live preview of the promo template
              try {
                await ctx.reply(htmlContent, {
                  parse_mode: 'HTML',
                  disable_web_page_preview: true,
                  reply_markup: {
                    inline_keyboard: [[{ text: btnLabel, callback_data: `want_notes_ref_${userId}` }]]
                  }
                });
              } catch (err) {
                await ctx.reply(`⚠️ የቴሌግራም መልዕክት ማሳየት አልተቻለም: ${err.message}`);
              }

              const confirmText =
`👁️ <b>የቴምፕሌት ቅድመ-እይታ ተዘጋጅቷል:</b>
━━━━━━━━━━━━━━━━━━━━
• 📌 <b>ርዕስ:</b> ${escapeHtml(adminDraft.title)}
• 🎓 <b>ክፍል:</b> <code>${adminDraft.grade || 'All'}</code>
• 🔘 <b>የአዝራር ስም:</b> <code>${escapeHtml(btnLabel)}</code>

ይህ ቴምፕሌት በዳታቤዝ እንዲቀመጥ ይፈልጋሉ?`;

              const confirmKb = Markup.inlineKeyboard([
                [
                  Markup.button.callback('✅ አዎ፣ አስቀምጥ', 'admin_tpl_save_draft'),
                  Markup.button.callback('✏️ እንደገና ጻፍ', 'admin_add_tpl_start')
                ],
                [
                  Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')
                ]
              ]);

              return ctx.reply(confirmText, { parse_mode: 'HTML', ...confirmKb });
            }
          }

          // Flow 2: Admin Adding Extra Link Button to Broadcast
          if (draft && draft.step === 'AWAITING_EXTRA_BUTTON' && isAdmin(userId, env)) {
            const rawBtnText = ctx.message.text || '';
            const parts = rawBtnText.split('|');
            if (parts.length >= 2) {
              const bText = parts[0].replace('[', '').trim();
              let bUrl = parts[1].replace(']', '').trim();
              if (!bUrl.startsWith('http://') && !bUrl.startsWith('https://') && !bUrl.startsWith('tg://')) {
                bUrl = 'https://' + bUrl;
              }
              if (!draft.payload.buttons) draft.payload.buttons = [];
              draft.payload.buttons.push([{ text: bText, url: bUrl }]);
              await ctx.reply(`✅ አዝራር ተጨምሯል: <b>${escapeHtml(bText)}</b>`, { parse_mode: 'HTML' });
            } else {
              await ctx.reply('⚠️ እባክዎ በአግባቡ ይላኩ: <code>የአዝራሩ ስም | https://link</code>', { parse_mode: 'HTML' });
            }

            draft.step = 'PREVIEW_AND_CONFIRM';
            return showBroadcastPreviewToAdmin(ctx, userId, draft.payload);
          }

          // Flow 3: Admin New Broadcast Input (Text/Media + HTML + Buttons)
          if (draft && draft.step === 'AWAITING_MESSAGE' && isAdmin(userId, env)) {
            const payload = extractMessagePayload(ctx.message);
            
            // Validate HTML text if text exists
            if (payload.text || payload.caption) {
              const htmlCheck = validateTelegramHtml(payload.text || payload.caption);
              if (!htmlCheck.valid) {
                return ctx.reply(
`⚠️ <b>የ HTML ፎርማት ስህተት:</b>
━━━━━━━━━━━━━━━━━━━━
• ❌ <b>ስህተት:</b> ${escapeHtml(htmlCheck.error)}

እባክዎ የተሳሳቱትን ታጎች አስተካክለው እንደገና ይላኩ ⬇️`,
                  {
                    parse_mode: 'HTML',
                    reply_markup: {
                      inline_keyboard: [[Markup.button.callback('❌ ሰርዝ', 'admin_cancel_broadcast')]]
                    }
                  }
                );
              }
            }

            draft.payload = payload;
            draft.targetGrade = draft.targetGrade || 'All';
            draft.step = 'PREVIEW_AND_CONFIRM';

            return showBroadcastPreviewToAdmin(ctx, userId, payload);
          }

          // Flow 4: Admin Poll / Quiz Generation & Configuration
          const adminQuizDraft = adminQuizDrafts[userId];
          if (adminQuizDraft && isAdmin(userId, env)) {
            if (adminQuizDraft.step === 'AWAITING_TOPIC') {
              let topicText = (ctx.message.text || '').trim();
              if (!topicText) return ctx.reply('⚠️ እባክዎ ትክክለኛ የኩዊዝ ርዕስ ወይም ክፍል ይጻፉ:');

              let langMode = adminQuizDraft.preferredLang || 'auto';
              if (/^(?:en|english)\s+/i.test(topicText)) {
                langMode = 'english';
                topicText = topicText.replace(/^(?:en|english)\s+/i, '').trim();
              } else if (/^(?:am|amharic|አማርኛ)\s+/i.test(topicText)) {
                langMode = 'amharic';
                topicText = topicText.replace(/^(?:am|amharic|አማርኛ)\s+/i, '').trim();
              }

              const langLabel = langMode === 'english' ? ' (100% English)' : (langMode === 'amharic' ? ' (ሙሉ አማርኛ)' : '');
              await ctx.reply(`⏳ <b>ለ "${escapeHtml(topicText)}"${langLabel} የኩዊዝ ጥያቄ እየተዘጋጀ ነው...</b>`, { parse_mode: 'HTML' });
              const quizData = await getOrGenerateQuiz(topicText, langMode, env);
              adminQuizDrafts[userId] = {
                title: topicText,
                langMode,
                ...quizData,
                question: cleanQuestionText(quizData.question)
              };
              return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
            }

            if (adminQuizDraft.step === 'AWAITING_MANUAL_INPUT') {
              const rawText = (ctx.message.text || '').trim();
              const parsed = parseCustomPollFormat(rawText);
              if (!parsed || parsed.options.length < 2) {
                return ctx.reply(
`⚠️ <b>የጥያቄው ፎርማት አልተለየም!</b>
━━━━━━━━━━━━━━━━━━━━
እባክዎ ጥያቄውን እና አማራጮቹን በሚከተለው መልኩ ይጻፉ:

ጥያቄ: የብርሃን ፍጥነት ስንት ነው?
A) 3 x 10^8 m/s*
B) 3 x 10^6 m/s
C) 1.5 x 10^8 m/s
D) 3 x 10^5 m/s
ማብራሪያ: የብርሃን ፍጥነት 3x10^8 m/s ነው።

💡 <i>ትክክለኛው መልስ ላይ ኮከብ (*) ምልክት ያድርጉበት።</i>`, { parse_mode: 'HTML' });
              }

              adminQuizDrafts[userId] = {
                title: parsed.question.substring(0, 40),
                ...parsed,
                question: cleanQuestionText(parsed.question)
              };
              return showQuizDraftPreview(ctx, userId, adminQuizDrafts[userId], env);
            }

            if (adminQuizDraft.step === 'AWAITING_CHANNEL_HANDLE') {
              let handle = (ctx.message.text || '').trim();
              if (!handle.startsWith('@')) handle = '@' + handle;
              await setDynamicConfig(env, 'poll_channel', handle);
              delete adminQuizDrafts[userId];
              await ctx.reply(`✅ <b>የዒላማ ቻናል ወደ ${escapeHtml(handle)} ተቀይሯል!</b>`, { parse_mode: 'HTML' });
              return renderPollManagerDashboard(ctx, env);
            }

            if (adminQuizDraft.step === 'AWAITING_GROUP_HANDLE') {
              let handle = (ctx.message.text || '').trim();
              if (!handle.startsWith('@')) handle = '@' + handle;
              await setDynamicConfig(env, 'poll_group', handle);
              delete adminQuizDrafts[userId];
              await ctx.reply(`✅ <b>የዒላማ ግሩፕ ወደ ${escapeHtml(handle)} ተቀይሯል!</b>`, { parse_mode: 'HTML' });
              return renderPollManagerDashboard(ctx, env);
            }
          }

          return next();
        });

        // Helper: Render Broadcast Results Dashboard
        const renderBroadcastResultsReport = async (ctx, broadcastId) => {
          let bcast = null;
          if (env?.DB) {
            try {
              bcast = await env.DB.prepare('SELECT * FROM broadcasts WHERE id = ?').bind(broadcastId).first();
            } catch (e) {}
          }

          if (!bcast) {
            return transitionToNewStep(ctx, `⚠️ የብሮድካስት መረጃ አልተገኘም: #${broadcastId}`);
          }

          const isCompleted = bcast.pending_count === 0 || bcast.status === 'completed';
          const targetDisplay = bcast.target_grade === 'All' ? '📚 ሁሉም ክፍሎች' : `🎓 ${bcast.target_grade}ኛ ክፍል`;

          const reportText =
`📊 <b>የብሮድካስት ሂደትና ውጤት ሪፖርት</b> 🇪🇹
━━━━━━━━━━━━━━━━━━━━
• 🆔 <b>የብሮድካስት መለያ:</b> <code>#${bcast.id}</code>
• 🎯 <b>የታለመው ክፍል:</b> <code>${targetDisplay}</code>
• 👥 <b>ጠቅላላ ተቀባዮች:</b> <code>${bcast.total_recipients}</code>
• ✅ <b>በተሳካ ሁኔታ የተላከ:</b> <code>${bcast.sent_count}</code>
• ⏳ <b>በመጠባበቅ ላይ:</b> <code>${bcast.pending_count}</code>
• 🚫 <b>ቦቱን ያገዱ:</b> <code>${bcast.blocked_count}</code>
• ❌ <b>ያልተሳካ:</b> <code>${bcast.failed_count}</code>
• ⚡ <b>የባች መጠን:</b> <code>20 በአንድ ዙር (Rate-limited safe)</code>
━━━━━━━━━━━━━━━━━━━━
${isCompleted 
  ? '🎉 <b>ብሮድካስቱ ለሁሉም ተጠቃሚዎች በተሳካ ሁኔታ ተጠናቋል!</b>' 
  : '⏳ <b>የ 20 ተጠቃሚዎች ዙር ተልኳል!</b> ቀጣዩን 20 ለመላክ ወይም ሁኔታውን ለማደስ ከታች ይጫኑ ⬇️'}`;

          const reportButtons = [];
          if (!isCompleted) {
            reportButtons.push([
              Markup.button.callback('⏩ ቀጣይ 20 ላክ', `admin_bcast_next_${bcast.id}`),
              Markup.button.callback('🔄 ሁኔታውን አድስ', `admin_bcast_stat_${bcast.id}`)
            ]);
          }
          reportButtons.push([Markup.button.callback('📊 ወደ ዳሽቦርድ', 'admin_refresh_stats')]);

          const reportKb = Markup.inlineKeyboard(reportButtons);
          return transitionToNewStep(ctx, reportText, reportKb);
        };

        // Admin Start Broadcast Confirmation
        bot.action('admin_confirm_send_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });

          const draft = broadcastDrafts[userId];
          if (!draft || !draft.payload) {
            return ctx.answerCbQuery('⚠️ ምንም ንቁ ብሮድካስት አልተገኘም!', { show_alert: true });
          }

          await ctx.answerCbQuery('ብሮድካስት እየተጀመረ ነው...').catch(() => {});
          const payloadJson = JSON.stringify(draft.payload);
          const targetGrade = draft.targetGrade || 'All';

          let totalRecipients = 0;
          if (env.DB) {
            try {
              let countRow = null;
              if (targetGrade === 'All') {
                countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE is_active = 1').first();
              } else {
                countRow = await env.DB.prepare(`
                  SELECT COUNT(*) as total 
                  FROM users 
                  WHERE is_active = 1 
                    AND (grade = ? OR grade LIKE ? OR grade LIKE ?)
                `).bind(`${targetGrade}ኛ ክፍል`, `%${targetGrade}%`, `Grade ${targetGrade}`).first();
              }

              totalRecipients = countRow?.total || 0;

              const insRes = await env.DB.prepare(`
                INSERT INTO broadcasts (admin_id, message_type, payload_json, target_grade, total_recipients, pending_count, status)
                VALUES (?, ?, ?, ?, ?, ?, 'processing')
              `).bind(userId, draft.payload.type, payloadJson, targetGrade, totalRecipients, totalRecipients).run();

              const broadcastId = insRes.meta.last_row_id;

              if (targetGrade === 'All') {
                await env.DB.prepare(`
                  INSERT INTO broadcast_queue (broadcast_id, telegram_id, status)
                  SELECT ?, telegram_id, 'pending'
                  FROM users
                  WHERE is_active = 1
                `).bind(broadcastId).run();
              } else {
                await env.DB.prepare(`
                  INSERT INTO broadcast_queue (broadcast_id, telegram_id, status)
                  SELECT ?, telegram_id, 'pending'
                  FROM users
                  WHERE is_active = 1 
                    AND (grade = ? OR grade LIKE ? OR grade LIKE ?)
                `).bind(broadcastId, `${targetGrade}ኛ ክፍል`, `%${targetGrade}%`, `Grade ${targetGrade}`).run();
              }

              delete broadcastDrafts[userId];

              // Immediately process the first batch of 20 users
              await processBroadcastQueueBatch(bot, env, 20);

              return renderBroadcastResultsReport(ctx, broadcastId);
            } catch (err) {
              console.error('Broadcast Dispatch Error:', err);
              return transitionToNewStep(ctx, `❌ ብሮድካስቱን ማስጀመር አልተቻለም: ${err.message}`);
            }
          }

          delete broadcastDrafts[userId];
          return transitionToNewStep(ctx, '⚠️ Local simulator mode: broadcast dispatched.');
        });

        // Admin Action: Send Next 20 batch
        bot.action(/admin_bcast_next_(\d+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });

          const broadcastId = parseInt(ctx.match[1], 10);
          await ctx.answerCbQuery('ቀጣይ 20 እየተላከ ነው...').catch(() => {});

          if (env.DB) {
            await processBroadcastQueueBatch(bot, env, 20);
          }

          return renderBroadcastResultsReport(ctx, broadcastId);
        });

        // Admin Action: Refresh Broadcast Status
        bot.action(/admin_bcast_stat_(\d+)/, async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ ይህ ትዕዛዝ ለአድሚን ብቻ የተፈቀደ ነው!', { show_alert: true });

          const broadcastId = parseInt(ctx.match[1], 10);
          await ctx.answerCbQuery('ሪፖርቱ ታድሷል!').catch(() => {});

          return renderBroadcastResultsReport(ctx, broadcastId);
        });

        // Run Telegraf on the incoming Webhook update
        const update = await request.json();
        await bot.handleUpdate(update);
        return new Response('OK', { status: 200 });

      } catch (err) {
        console.error('Webhook Runtime Error:', err);
        return new Response('OK', { status: 200 });
      }
    }

    // Default Health / Status check
    return new Response(
      JSON.stringify({
        status: 'Online',
        service: 'Smart X Ethiopian Telegram Bot Worker',
        version: '5.5.0',
        release_date: 'መስከረም 5',
        support_username: '@smart_x_help',
        features: [
          'Interactive Consent & Motivation Pre-Check',
          '5 Persuasive Diagnostic Demand Assessment Questions',
          'Smart X Platform Reveal & Promotional Climax',
          'Clean Message Stepping (New message per step + buttons cleared on previous)',
          'Zero Parentheses across all Amharic, English, and Afaan Oromoo copies',
          'Symmetric Afaan Oromoo and Multi-Language Button Layouts',
          'Support username updated to @smart_x_help',
          'Targeted Grade Broadcast Filter (All, 9, 10, 11, 12)',
          'HTML Tag Validator for Promo Templates & Broadcasts',
          'Rate-Limited Batch Queue Worker Processor (20 msgs/batch)'
        ]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  },

  // Cloudflare Workers Scheduled Cron Trigger (Auto-processes queued broadcasts)
  async scheduled(event, env, ctx) {
    const token = env?.BOT_TOKEN || process.env.BOT_TOKEN;
    if (!token) return;
    try {
      const bot = new Telegraf(token);
      if (ctx?.waitUntil) {
        ctx.waitUntil(processBroadcastQueueBatch(bot, env, 20));
      } else {
        await processBroadcastQueueBatch(bot, env, 20);
      }
    } catch (err) {
      console.error('Scheduled Cron Queue Worker Error:', err.message);
    }
  }
};
