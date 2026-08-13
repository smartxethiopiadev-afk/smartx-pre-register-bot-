import { Telegraf, Markup } from 'telegraf';
import { GoogleGenAI, Type } from '@google/genai';

// --- STRICT GEMINI MODEL FALLBACK ARRAY ---
const GEMINI_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite',
  'gemini-3-flash'
];

// In-memory caches for local development or session tracking
const userStates = {};
const registeredUsers = {};
const userLanguages = {};
const broadcastDrafts = {};
const activeQuizzes = {}; // Store generated quiz states for callback evaluation

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
        // Automatically try next key / next model
      }
    }
  }

  throw lastError || new Error('All Gemini API keys and models failed.');
}

// Multi-language Translations Dictionary (Amharic 'am', Afaan Oromoo 'om', English 'en')
const i18n = {
  am: {
    welcome_start: (name) => `👋 *ሰላም ${name}! እንኳን ወደ Smart X Ethiopian (Smart X ET) በደህና መጡ!*

ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grade 9-12) የተዘጋጀ የ AI Study Assistant እና Interactive Quiz Engine።

እባክዎን የሚፈልጉትን ቋንቋ ይምረጡ / Select language:`,
    lang_confirm: `🇪🇹 ቋንቋዎ በአማርኛ ተመርጧል!`,
    main_menu_title: `እንኳን ወደ Smart X ET በደህና መጡ! ከታች ካሉት አማራጮች ይምረጡ፡`,
    menu: [
      ['⚙️ መቼቶች', '🤖 Smart X AI Assistant'],
      ['❓ የዛሬው Quiz', '📱 ስለ Smart X ET'],
      ['📢 ኦፊሴላዊ ቻናል', '💬 እገዛና አስተያየት']
    ],
    settings_title: `⚙️ *Smart X ET - የመቼቶች ገጽ (Settings)*\n\nእባክዎን ማድረግ የሚፈልጉትን ይምረጡ፡`,
    btn_change_lang: `🌐 ቋንቋ ቀይር (Change Language)`,
    btn_update_profile: `📝 ፕሮፋይል አዘምን / Pre-Register`,
    btn_view_profile: `👤 ፕሮፋይሌን እይ (My Profile)`,
    btn_verify_channel: `📢 Channel አባልነት አረጋግጥ`,
    ai_intro: `🤖 *Smart X AI Assistant (HAB IT Solutions)*\n\nሰላም! እኔ ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grade 9-12) እና ለ Smart X ET አፕሊኬሽን የተዘጋጀሁ AI Assistant ነኝ።\n\nመጠየቅ የሚፈልጉትን የትምህርት ጥያቄ (Physics, Chemistry, Biology, Math, History, IT...) ይፃፉልኝ!`,
    system_prompt: `You are the "Smart X Ethiopian AI Assistant", an educational AI created by HAB IT Solutions for Grade 9-12 high school students following the New Ethiopian Curriculum.

STRICT MANDATORY RULES:
1. IDENTITY: Identify yourself as "Smart X Ethiopian AI Assistant" developed by HAB IT Solutions.
2. SCOPE OF KNOWLEDGE: STRICTLY restrict knowledge ONLY to Grade 9, 10, 11, and 12 Ethiopian Curriculum subjects (Physics, Chemistry, Biology, Mathematics, History, Geography, Civics, Economics, English, Amharic, Afaan Oromoo, IT) and details about the Smart X Ethiopian (Smart X ET) Mobile App.
3. NON-EDUCATIONAL QUERIES: If the user asks non-educational, non-curriculum questions (such as news, celebrities, adult content, gaming, general programming, politics, etc.), politely decline in Amharic and redirect them back to Grade 9-12 Ethiopian high school topics or Smart X ET features.
4. APP RELEASE ANNOUNCEMENT: In EVERY response, politely remind students that the Smart X Ethiopian Mobile App officially releases on Meskerem 5 / September 2026 (መስከረም 5 / ሴፕቴምበር 2026) for Android & iOS with 10,000+ quizzes and notes.
5. LANGUAGE: Respond accurately and concisely in Amharic.`,

    about_text: `📱 *ስለ Smart X Ethiopian (Smart X ET)*\n\n• *የአፑ ስም:* Smart X Ethiopian / Smart X ET\n• *አልሚ:* HAB IT Solutions\n• *ዓላማ:* ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grades 9-12) የተዘጋጀ የ Quiz እና የትምህርት ማጠቃለያ አፕሊኬሽን።\n• *የመልቀቂያ ጊዜ:* መስከረም 5 / ሴፕቴምበር 2026 (September 2026)\n• *ፕላትፎርም:* Android & iOS (በ Flutter የተሰራ)\n\n🚀 በሴፕቴምበር 2026 ሲለቀቅ የመጀመርያው ተጠቃሚ ለመሆን አሁኑኑ /register በማድረግ ይመዝገቡ!`,
    channel_info: `📢 *የ Smart X Ethiopian ኦፊሴላዊ ቴሌግራም ቻናል*\n\nየቅርብ ጊዜ መረጃዎችን፣ ትምህርታዊ ማጠቃለያዎችን እና ማሳወቂያዎችን ለማግኘት @SmartXEthiopia ይቀላቀሉ!`,
    support_info: `💬 *ደጋፊዎች እና አስተያየት (Support & Feedback)*\n\nለማንኛውም ጥያቄ ወይም አስተያየት፡\n• *Telegram Channel:* @SmartXEthiopia\n• *Developer:* HAB IT Solutions\n• *Email:* smartx.ethiopia.dev@gmail.com\n\nአስተያየትዎን ስላጋሩን እናመሰግናለን! 🙏`,
    reg_start_msg: `📝 *Smart X Ethiopian - የቅድመ-ምዝገባ ቅጽ*\n\nእባክዎን **ሙሉ ስምዎን** ይፃፉልኝ፡`,
    reg_ask_grade: (name) => `እሺ ${name}! 👋 እባክዎን የትምህርት ክፍልዎን (Grade) ይምረጡ፡`,
    reg_ask_stream: (grade) => `👍 ተመርጧል፡ *${grade}*\n\nእባክዎን የትምህርት ዘርፍዎን (Stream) ይምረጡ፡`,
    reg_ask_phone: (stream) => `✅ ዘርፍ፡ *${stream}*\n\nእባክዎን **ስልክ ቁጥርዎን** ያጋሩን ወይም በጽሁፍ ይፃፉልን፡`,
    reg_channel_step: `📢 *የመጨረሻ ደረጃ፡ የኦፊሴላዊ ቴሌግራም ቻናል ይቀላቀሉ*\n\nምዝገባዎን ለማጠናቀቅ እባክዎን የ Smart X Ethiopian ኦፊሴላዊ ቻናል (**@SmartXEthiopia**) ይቀላቀሉ።`,
    reg_success: (name, phone, grade, stream) => `🎉 *እንኳን ደስ አለዎት! ቅድመ-ምዝገባዎ በ Cloudflare D1 ዳታቤዝ ተጠናቋል!* 🚀\n\n📋 *መረጃዎች፡*\n• *ስም:* ${name}\n• *ስልክ:* ${phone}\n• *ክፍል:* ${grade}\n• *ዘርፍ:* ${stream}\n• *ቻናል:* ✅ የተረጋገጠ (@SmartXEthiopia)\n\nHAB IT Solutions ስለመረጡን እናመሰግናለን!`
  },

  om: {
    welcome_start: (name) => `👋 *Akkam ${name}! Baga gara Smart X Ethiopian (Smart X ET) nagaan dhuftan!*

Gargaaraa AI fi Quiz Engine Sirna Barnoota Kutaalee 9-12 Itoophiyaa.

Maaloo afaan filadhaa / Select language:`,
    lang_confirm: `🌳 Afaan keessan Afaan Oromootiin filatameera!`,
    main_menu_title: `Baga gara Smart X ET nagaan dhuftan! Filannoowwan armaan gadii irraa filadhaa:`,
    menu: [
      ['⚙️ Qindaa\'inaa', '🤖 Smart X AI Assistant'],
      ['❓ Quiz Guyyaa', '📱 Waa\'ee Smart X ET'],
      ['📢 Chanaalii Ufisaa', '💬 Deeggarsa & Yaada']
    ],
    settings_title: `⚙️ *Smart X ET - Fuula Qindaa'inaa (Settings)*\n\nMaaloo isa raawwachuu barbaaddan filadhaa:`,
    btn_change_lang: `🌐 Afaan Jijjiiri (Change Language)`,
    btn_update_profile: `📝 Piroofaayilii Haarsi (Update Profile)`,
    btn_view_profile: `👤 Piroofaayilii Koo (My Profile)`,
    btn_verify_channel: `📢 Mirkaneessa Chanaalii`,
    ai_intro: `🤖 *Smart X AI Assistant (HAB IT Solutions)*\n\nAkkam! Ani gargaaraa AI sirna barnoota haaraa Itoophiyaa (Grade 9-12) fi Smart X ET ti.\n\nGaaffii barnootaa kamiyyuu (Physics, Chemistry, Biology, Math, IT...) na gaafadhaa!`,
    system_prompt: `You are the "Smart X Ethiopian AI Assistant", an educational AI created by HAB IT Solutions for Grade 9-12 high school students following the New Ethiopian Curriculum.

STRICT MANDATORY RULES:
1. IDENTITY: Identify yourself as "Smart X Ethiopian AI Assistant" developed by HAB IT Solutions.
2. SCOPE OF KNOWLEDGE: STRICTLY restrict knowledge ONLY to Grade 9, 10, 11, and 12 Ethiopian Curriculum subjects and Smart X Ethiopian (Smart X ET) Mobile App details.
3. NON-EDUCATIONAL QUERIES: If the user asks non-educational questions, politely decline in Afaan Oromoo and redirect them back to Grade 9-12 Ethiopian high school topics or Smart X ET features.
4. APP RELEASE ANNOUNCEMENT: In EVERY response, politely remind students that the Smart X Ethiopian Mobile App officially releases on Meskerem 5 / September 2026 (Fulbaana 5 / September 2026) for Android & iOS.
5. LANGUAGE: Respond accurately and concisely in Afaan Oromoo.`,

    about_text: `📱 *Waa'ee Smart X Ethiopian (Smart X ET)*\n\n• *Maqaa App:* Smart X Ethiopian / Smart X ET\n• *Ijaaraa:* HAB IT Solutions\n• *Kaayyoo:* Appilikeeshinii Quiz fi Cuunfaa Barnoota Haaraa Kutaalee 9-12 Itoophiyaatiif qophaa'e.\n• *Yeroo Gadhiifamu:* Fulbaana 5 / September 2026\n• *Plaatfoormii:* Android & iOS (Flutter tiin ijaarame)\n\n🚀 Fulbaana 2026 irratti fayyadamaa jalqabaa ta'uuf ammaahuu /register godhaa!`,
    channel_info: `📢 *Chanaalii Telegraama Ufisaa Smart X Ethiopian*\n\nOdeeffannoowwan haaraa fi cuunfaawwan barnootaa argachuuf @SmartXEthiopia makamaa!`,
    support_info: `💬 *Deeggarsa & Yaada (Support & Feedback)*\n\nGaaffii fi yaada kamiyyuuf:\n• *Telegram Channel:* @SmartXEthiopia\n• *Developer:* HAB IT Solutions\n• *Email:* smartx.ethiopia.dev@gmail.com\n\nYaada keessaniif galatoomaa! 🙏`,
    reg_start_msg: `📝 *Smart X Ethiopian - Waraqaa Galmee*\n\nMaaloo **Maqaa keessan guutuu** barreessaa:`,
    reg_ask_grade: (name) => `Tole ${name}! 👋 Maaloo Kutaa barnoota keessanii filadhaa:`,
    reg_ask_stream: (grade) => `👍 Filatameera: *${grade}*\n\nMaaloo Damee barnootaa (Stream) keessan filadhaa:`,
    reg_ask_phone: (stream) => `✅ Damee: *${stream}*\n\nMaaloo **Lakk. Bilbilaa** keessan nuuf qoodaa ykn barreessaa:`,
    reg_channel_step: `📢 *Sadarkaa Xumuraa: Chanaalii Ufisaa Makamaa*\n\nGalmee keessan xumuruuf maaloo chanaalii @SmartXEthiopia makamaa.`,
    reg_success: (name, phone, grade, stream) => `🎉 *Baga gammaddan! Galmeen keessan Cloudflare D1 irratti xumurameera!* 🚀\n\n📋 *Odeeffannoo:* \n• *Maqaa:* ${name}\n• *Bilbila:* ${phone}\n• *Kutaa:* ${grade}\n• *Damee:* ${stream}\n• *Chanaalii:* ✅ Mirkanaa'e (@SmartXEthiopia)\n\nHAB IT Solutions filachuu keessaniif galatoomaa!`
  },

  en: {
    welcome_start: (name) => `👋 *Hello ${name}! Welcome to Smart X Ethiopian (Smart X ET)!*

AI Study Assistant & Practice Quiz Engine for Grade 9-12 Ethiopian New Curriculum.

Please select your language:`,
    lang_confirm: `🇬🇧 Language selected: English!`,
    main_menu_title: `Welcome to Smart X ET! Please choose an option from the menu below:`,
    menu: [
      ['⚙️ Settings', '🤖 Smart X AI Assistant'],
      ['❓ Daily Quiz', '📱 About Smart X ET'],
      ['📢 Official Channel', '💬 Support & Feedback']
    ],
    settings_title: `⚙️ *Smart X ET - Settings Menu*\n\nPlease select an option below:`,
    btn_change_lang: `🌐 Change Language`,
    btn_update_profile: `📝 Update Profile / Pre-Register`,
    btn_view_profile: `👤 View My Profile`,
    btn_verify_channel: `📢 Verify Channel Membership`,
    ai_intro: `🤖 *Smart X AI Assistant (HAB IT Solutions)*\n\nHello! I am your AI Assistant for the Ethiopian Grade 9-12 New Curriculum and Smart X ET App.\n\nAsk me any educational question (Physics, Chemistry, Biology, Math, History, IT...) or app details!`,
    system_prompt: `You are the "Smart X Ethiopian AI Assistant", an educational AI created by HAB IT Solutions for Grade 9-12 high school students following the New Ethiopian Curriculum.

STRICT MANDATORY RULES:
1. IDENTITY: Identify yourself as "Smart X Ethiopian AI Assistant" developed by HAB IT Solutions.
2. SCOPE OF KNOWLEDGE: STRICTLY restrict knowledge ONLY to Grade 9, 10, 11, and 12 Ethiopian Curriculum subjects (Physics, Chemistry, Biology, Mathematics, History, Geography, Civics, Economics, English, Amharic, Afaan Oromoo, IT) and details about the Smart X Ethiopian (Smart X ET) Mobile App.
3. NON-EDUCATIONAL QUERIES: If the user asks non-educational questions (e.g. celebrities, news, games, general programming, politics, adult content), politely decline in English and redirect them back to Grade 9-12 Ethiopian high school topics or Smart X ET app features.
4. APP RELEASE ANNOUNCEMENT: In EVERY response, politely remind students that the Smart X Ethiopian Mobile App officially releases on Meskerem 5 / September 2026 for Android & iOS.
5. LANGUAGE: Respond accurately and concisely in English.`,

    about_text: `📱 *About Smart X Ethiopian (Smart X ET)*\n\n• *App Name:* Smart X Ethiopian / Smart X ET\n• *Developer:* HAB IT Solutions\n• *Purpose:* Educational Quiz & Course Summary App for Grade 9-12 Ethiopian New Curriculum.\n• *Release Date:* Meskerem 5 / September 2026\n• *Platforms:* Android & iOS (Built with Flutter)\n\n🚀 Pre-register now using /register to gain early access in September 2026!`,
    channel_info: `📢 *Official Smart X Ethiopian Telegram Channel*\n\nJoin @SmartXEthiopia for official announcements, subject summaries, and study materials!`,
    support_info: `💬 *Support & Feedback*\n\nFor queries, suggestions, or support:\n• *Telegram Channel:* @SmartXEthiopia\n• *Developer:* HAB IT Solutions\n• *Email:* smartx.ethiopia.dev@gmail.com\n\nThank you for reaching out! 🙏`,
    reg_start_msg: `📝 *Smart X Ethiopian - Pre-Registration Form*\n\nPlease enter your **Full Name**:`,
    reg_ask_grade: (name) => `Great ${name}! 👋 Please select your Grade Level:`,
    reg_ask_stream: (grade) => `👍 Selected: *${grade}*\n\nPlease select your Academic Stream:`,
    reg_ask_phone: (stream) => `✅ Stream: *${stream}*\n\nPlease share or enter your **Phone Number**:`,
    reg_channel_step: `📢 *Final Step: Join Official Telegram Channel*\n\nTo complete registration, please join our official channel (@SmartXEthiopia).`,
    reg_success: (name, phone, grade, stream) => `🎉 *Congratulations! Your Pre-Registration is stored in Cloudflare D1!* 🚀\n\n📋 *Profile Summary:*\n• *Name:* ${name}\n• *Phone:* ${phone}\n• *Grade:* ${grade}\n• *Stream:* ${stream}\n• *Channel:* ✅ Verified (@SmartXEthiopia)\n\nThank you for choosing HAB IT Solutions!`
  }
};

// --- CURATED PRACTICE QUIZ BANK (Fallback & Instant Practice) ---
const CURATED_QUIZZES = [
  {
    id: 'q_chem10_01',
    subject: 'Chemistry',
    grade: 'Grade 10',
    question: 'What is the chemical formula of Water?',
    options: ['A) CO2', 'B) H2O', 'C) NaCl', 'D) CH4'],
    correct_index: 1,
    explanation: 'Water consists of two hydrogen atoms covalently bonded to one oxygen atom (H2O).'
  },
  {
    id: 'q_phys11_01',
    subject: 'Physics',
    grade: 'Grade 11',
    question: 'According to Newton\'s Second Law of Motion, what is the formula for Force (F)?',
    options: ['A) F = m / a', 'B) F = m * a', 'C) F = m + a', 'D) F = m * v^2'],
    correct_index: 1,
    explanation: 'Force equals mass times acceleration (F = m * a).'
  },
  {
    id: 'q_bio12_01',
    subject: 'Biology',
    grade: 'Grade 12',
    question: 'Which organelle is known as the "powerhouse of the cell" for producing ATP?',
    options: ['A) Nucleus', 'B) Ribosome', 'C) Mitochondria', 'D) Golgi Apparatus'],
    correct_index: 2,
    explanation: 'Mitochondria produce cellular energy (ATP) through cellular respiration.'
  },
  {
    id: 'q_math10_01',
    subject: 'Mathematics',
    grade: 'Grade 10',
    question: 'What are the roots of the quadratic equation x^2 - 5x + 6 = 0?',
    options: ['A) x = 1, 6', 'B) x = 2, 3', 'C) x = -2, -3', 'D) x = 0, 5'],
    correct_index: 1,
    explanation: 'Factoring gives (x - 2)(x - 3) = 0, so the roots are x = 2 and x = 3.'
  }
];

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

// Helper: Save user's language preference
async function setUserLanguage(userId, lang, env) {
  userLanguages[userId] = lang;
  if (env?.DB) {
    try {
      await env.DB.prepare(`
        INSERT INTO users (telegram_id, full_name, phone, grade, stream, language)
        VALUES (?, 'Pending', 'Pending', 'Grade 10', 'Natural Science', ?)
        ON CONFLICT(telegram_id) DO UPDATE SET language = excluded.language
      `).bind(userId, lang).run();
    } catch (err) {
      console.error('Save language error:', err);
    }
  }
}

// Helper: Get Localized Main Keyboard
function getMainMenuKeyboard(lang) {
  const tObj = i18n[lang] || i18n.am;
  return Markup.keyboard(tObj.menu).resize();
}

// Helper: Check if user is a member of @SmartX_Discussion channel/group
async function checkDiscussionGroupMember(ctx, userId) {
  try {
    const member = await ctx.telegram.getChatMember('@SmartX_Discussion', userId);
    if (['creator', 'administrator', 'member'].includes(member.status)) {
      return true;
    }
  } catch (err) {
    console.warn('[Discussion Group Member Check Warning]:', err.message);
  }
  return false;
}

// Helper: Prompt student to join @SmartX_Discussion before using AI Assistant
async function requireDiscussionGroupJoin(ctx, lang) {
  const msgText = lang === 'om'
    ? `📢 *Gargaaraa AI wajjin haasa'uuf maaloo Garee Marii Smart X (SmartX Discussion) makamaa!*\n\nGaaffii AI Assistant gaafachuu keessan dura maaloo garee marii keenyaa (**@SmartX_Discussion**) makamaa.`
    : lang === 'en'
    ? `📢 *Please join the Smart X Discussion Group (@SmartX_Discussion) before asking questions to the AI Assistant!*\n\nJoin our official discussion community to unlock unlimited AI Q&A and Grade 9-12 curriculum support.`
    : `📢 *ከ AI Assistant ጋር ለመወያየት እባክዎን የ Smart X Discussion Group ይቀላቀሉ!*\n\nለጥያቄዎችዎ መልስ ከማግኘትዎ በፊት እባክዎን የውይይት ግሩፓችንን (**@SmartX_Discussion**) ይቀላቀሉ።`;

  return ctx.reply(msgText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      [Markup.button.url('💬 Join Discussion Group (@SmartX_Discussion)', 'https://t.me/SmartX_Discussion')],
      [Markup.button.callback('✅ Verify Discussion Membership / አባልነት አረጋግጥ', 'verify_discussion_membership')]
    ])
  });
}

// Helper: Verify if user is an Administrator
function isAdmin(userId, env) {
  if (!userId) return false;
  const uidStr = String(userId);
  const secretAdminId = env?.BROADCAST_ADMIN_ID || process.env.BROADCAST_ADMIN_ID || '12345678';
  const configuredAdmins = secretAdminId
    .split(',')
    .map(s => s.trim());

  return configuredAdmins.includes(uidStr) || uidStr === '12345678';
}

// Helper: Check if error indicates user blocked the bot
function isBlockedError(err) {
  const msg = (err?.message || '').toLowerCase();
  return (
    msg.includes('blocked') ||
    msg.includes('403') ||
    msg.includes('deactivated') ||
    msg.includes('chat not found') ||
    msg.includes('user is deleted') ||
    msg.includes('forbidden')
  );
}

// Helper: Generate AI Quiz with Gemini Fallback
async function generateAiQuiz(topicOrSubject, grade, lang, env) {
  const langName = lang === 'om' ? 'Afaan Oromoo' : lang === 'en' ? 'English' : 'Amharic';
  const prompt = `Generate 1 Multiple Choice Question (MCQ) for Grade ${grade} ${topicOrSubject || 'General High School Science/Math'} based strictly on the New Ethiopian High School Curriculum.
Language: ${langName}.

Return ONLY valid JSON with this exact structure:
{
  "question": "Question text here...",
  "options": ["A) option 1", "B) option 2", "C) option 3", "D) option 4"],
  "correct_index": 1,
  "explanation": "Clear explanation of why option B is correct."
}`;

  try {
    const aiRes = await generateWithGeminiFallback({
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            correct_index: { type: Type.INTEGER },
            explanation: { type: Type.STRING }
          },
          required: ["question", "options", "correct_index", "explanation"]
        }
      }
    }, env);

    const parsed = JSON.parse(aiRes.text);
    if (parsed.question && Array.isArray(parsed.options) && parsed.options.length >= 4) {
      return {
        id: 'ai_' + Date.now(),
        subject: topicOrSubject || 'General',
        grade: `Grade ${grade}`,
        question: parsed.question,
        options: parsed.options,
        correct_index: typeof parsed.correct_index === 'number' ? parsed.correct_index : 0,
        explanation: parsed.explanation || 'Detailed explanation provided by Smart X ET AI Engine.'
      };
    }
  } catch (err) {
    console.error('AI Quiz generation failed, falling back to curated bank:', err);
  }

  // Fallback to curated quiz bank
  const randomQuiz = CURATED_QUIZZES[Math.floor(Math.random() * CURATED_QUIZZES.length)];
  return { ...randomQuiz, id: 'curated_' + Date.now() };
}

// Helper: Send Interactive MCQ Quiz via Inline Keyboard
async function sendInteractiveQuiz(ctx, quiz, lang) {
  const quizId = quiz.id;
  activeQuizzes[quizId] = quiz;

  const optButtons = quiz.options.map((optText, idx) => {
    const label = optText.startsWith('A)') || optText.startsWith('B)') || optText.startsWith('C)') || optText.startsWith('D)')
      ? optText.slice(0, 2)
      : `Option ${idx + 1}`;
    return Markup.button.callback(label, `quiz_opt_${quizId}_${idx}`);
  });

  const messageText = `❓ *Smart X ET Practice Quiz (${quiz.grade} - ${quiz.subject})*\n\n*${quiz.question}*\n\n` +
    quiz.options.map(o => `• ${o}`).join('\n');

  return ctx.reply(messageText, {
    parse_mode: 'Markdown',
    ...Markup.inlineKeyboard([
      optButtons,
      [
        Markup.button.callback('🔄 New Quiz / ሌላ ጥያቄ', 'quiz_generate_new'),
        Markup.button.callback('📝 Pre-Register Now', 'start_reg_wizard')
      ]
    ])
  });
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

  if (payload.from_chat_id && payload.message_id) {
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

  const extra = {
    caption: payload.caption || undefined,
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
    await bot.telegram.sendMessage(targetChatId, payload.text || payload.caption || '📢 Smart X Ethiopian Announcement', {
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
      `🎉 *የብሮድካስት ስራ በተሳካ ሁኔታ ተጠናቋል! (Broadcast Completed)*\n\n` +
      `🆔 *Broadcast ID:* #${broadcastId}\n` +
      `• 👥 *ጠቅላላ ተቀባዮች:* ${total}\n` +
      `• 📬 *በተሳካ ሁኔታ የተላኩ:* ${sent}\n` +
      `• 🚫 *የከለከሉ (Blocked):* ${blocked}\n` +
      `• ❌ *የከሸፉ (Failed):* ${failed}`;

    await bot.telegram.sendMessage(adminId, reportMsg, { parse_mode: 'Markdown' });
  } catch (err) {
    console.error('Final report error:', err);
  }
}

// Initialize Database Schema & Seed Dynamic Knowledge Base
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
        is_channel_member INTEGER DEFAULT 1,
        is_active INTEGER DEFAULT 1,
        is_blocked INTEGER DEFAULT 0,
        registered_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
        prompt TEXT NOT NULL,
        response TEXT NOT NULL,
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

    try {
      await db.exec(`ALTER TABLE users ADD COLUMN language TEXT DEFAULT 'am';`);
    } catch (e) {
      // Column already exists
    }

    // Seed ground-truth app knowledge into D1 if app_info is empty
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
        ['pre_registration_perks', 'Pre-registered users receive 50% discount on subscription and early access on Meskerem 5 / September 2026 release day.']
      ];

      for (const [k, v] of seedItems) {
        await db.prepare(`
          INSERT INTO app_info (key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value = excluded.value
        `).bind(k, v).run();
      }

      const sysItems = [
        ['bot_version', 'v2.5-d1-driven'],
        ['ai_engine', 'Gemini 3.6 Flash Multi-Model Engine'],
        ['status', 'Operational']
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

// Dynamic Context Retrieval from Cloudflare D1 app_info / system_config
async function getDynamicKnowledgeBase(env) {
  let dbRecords = [];

  if (env?.DB) {
    try {
      const infoRows = await env.DB.prepare('SELECT key, value FROM app_info').all();
      if (infoRows?.results && infoRows.results.length > 0) {
        dbRecords = dbRecords.concat(infoRows.results);
      }
      const sysRows = await env.DB.prepare('SELECT key, value FROM system_config').all();
      if (sysRows?.results && sysRows.results.length > 0) {
        dbRecords = dbRecords.concat(sysRows.results);
      }
    } catch (err) {
      console.warn('[D1 Knowledge Retrieval Log]:', err.message);
    }
  }

  if (dbRecords.length > 0) {
    return dbRecords.map(r => `• ${r.key}: ${r.value}`).join('\n');
  }

  // Fallback ground-truth knowledge if D1 query is empty during initial load
  return `• app_name: Smart X Ethiopian (Smart X ET)
• developer: HAB IT Solutions
• release_date: Meskerem 5 / September 2026 (መስከረም 5 / ሴፕቴምበር 2026)
• target_audience: Grade 9-12 High School Students (New Ethiopian Curriculum)
• platforms: Android & iOS (Flutter)
• pricing_and_plans: Free tier available; Full VIP Pass 150 ETB/month or 400 ETB/term for 10,000+ quizzes & summaries
• features: 10,000+ Chapter-wise Quizzes, Instant Explanations, Model Exams, AI Study Assistant, Offline Mode
• official_channel: @SmartXEthiopia on Telegram
• pre_registration_perks: 50% discount for pre-registered students upon Meskerem 5 release`;
}

// Build dynamic system prompt using retrieved D1 records
async function buildDynamicSystemPrompt(lang, env) {
  const kb = await getDynamicKnowledgeBase(env);
  const langName = lang === 'om' ? 'Afaan Oromoo' : lang === 'en' ? 'English' : 'Amharic';

  return `You are the "Smart X Ethiopian AI Assistant", an educational AI created by HAB IT Solutions for Grade 9-12 high school students following the New Ethiopian Curriculum.

D1 DATABASE GROUND-TRUTH KNOWLEDGE BASE (PRIMARY SOURCE OF TRUTH):
${kb}

STRICT MANDATORY INSTRUCTIONS:
1. IDENTITY & KNOWLEDGE: Identify yourself as "Smart X Ethiopian AI Assistant" developed by HAB IT Solutions. Whenever answering questions about Smart X ET features, pricing, release date (Meskerem 5 / September 2026), or developer details, STRICTLY rely on the D1 Database Ground-Truth Knowledge Base above.
2. EDUCATIONAL SCOPE: Strictly restrict knowledge ONLY to Grade 9, 10, 11, and 12 Ethiopian Curriculum subjects (Physics, Chemistry, Biology, Mathematics, History, Geography, Civics, Economics, English, Amharic, Afaan Oromoo, IT) and Smart X ET App details.
3. NON-EDUCATIONAL QUERIES: If asked non-educational, non-curriculum questions (such as news, celebrities, adult content, gaming, general programming, politics, etc.), politely decline in ${langName} and redirect the student back to Grade 9-12 Ethiopian curriculum topics or Smart X ET app features.
4. APP RELEASE ANNOUNCEMENT: Consistently remind students in a polite and encouraging tone that the Smart X Ethiopian Mobile App officially releases on Meskerem 5 / September 2026 (መስከረም 5 / ሴፕቴምበር 2026) for Android & iOS.
5. CONCISE STUDENT-FACING OUTPUT: Keep your response encouraging, polite, concise (under 3 sentences), and written in clear ${langName}.
6. NO TECHNICAL LEAKS: NEVER mention database names, table names, API status codes, error stack traces, or internal code logic in user responses.`;
}

// Helper: Log every student query & AI response into D1 ai_chats table
async function logAiChat(env, telegramId, prompt, responseText, lang, modelUsed) {
  if (!env?.DB) return;
  try {
    await env.DB.prepare(`
      INSERT INTO ai_chats (telegram_id, prompt, response, language, model_used, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `).bind(telegramId, prompt, responseText, lang, modelUsed || 'gemini-3.6-flash').run();
  } catch (err) {
    console.error('[D1 Chat Log Error]:', err.message);
  }
}

export default {
  async scheduled(event, env, ctx) {
    const apiKey = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!apiKey || !env.DB) return;

    const bot = new Telegraf(apiKey);
    ctx.waitUntil(processBroadcastQueueBatch(bot, env, 25));
  },

  async fetch(request, env) {
    const apiKey = env.TELEGRAM_BOT_TOKEN || process.env.TELEGRAM_BOT_TOKEN;
    if (!apiKey) {
      return new Response('Error: TELEGRAM_BOT_TOKEN is not set in environment or secrets.', { status: 500 });
    }

    const bot = new Telegraf(apiKey);
    const url = new URL(request.url);

    if (env.DB) {
      await initDb(env.DB);
    }

    if (url.pathname === '/register') {
      try {
        const webhookUrl = `${url.origin}/webhook`;
        await bot.telegram.setWebhook(webhookUrl);
        return new Response(`Webhook successfully registered at: ${webhookUrl}`, { status: 200 });
      } catch (err) {
        return new Response(`Registration Failed: ${err.message}`, { status: 500 });
      }
    }

    if (url.pathname === '/webhook' && request.method === 'POST') {
      try {
        // --- /start Handler with First-Time Language Selection ---
        bot.start(async (ctx) => {
          const userName = ctx.from?.first_name || 'Student';
          const userId = ctx.from.id;
          const currentLang = await getUserLanguage(userId, env);

          const welcomeKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
              Markup.button.callback('🌳 Afaan Oromoo', 'set_lang_om'),
              Markup.button.callback('🇬🇧 English', 'set_lang_en')
            ]
          ]);

          const welcomeMsg = i18n[currentLang]?.welcome_start(userName) || i18n.am.welcome_start(userName);

          return ctx.reply(welcomeMsg, {
            parse_mode: 'Markdown',
            ...welcomeKeyboard
          });
        });

        // Language Selection Handler -> Directs to Channel & Discussion Group Join Step
        const handleLangSelection = async (ctx, selectedLang) => {
          const userId = ctx.from.id;
          await setUserLanguage(userId, selectedLang, env);
          await ctx.answerCbQuery(i18n[selectedLang].lang_confirm);

          const channelStepKeyboard = Markup.inlineKeyboard([
            [Markup.button.url('📢 Official Channel (@SmartXEthiopia)', 'https://t.me/SmartXEthiopia')],
            [Markup.button.url('💬 Discussion Group (@SmartX_Discussion)', 'https://t.me/SmartX_Discussion')],
            [Markup.button.callback('➡️ Continue to Pre-Registration / ወደ ቅድመ-ምዝገባ ቀጥል', 'start_reg_wizard')]
          ]);

          return ctx.reply(
            i18n[selectedLang].welcome_channel_step,
            {
              parse_mode: 'Markdown',
              ...channelStepKeyboard
            }
          );
        };

        bot.action('set_lang_am', (ctx) => handleLangSelection(ctx, 'am'));
        bot.action('set_lang_om', (ctx) => handleLangSelection(ctx, 'om'));
        bot.action('set_lang_en', (ctx) => handleLangSelection(ctx, 'en'));

        bot.command('language', async (ctx) => {
          return ctx.reply(
            `🌐 Please select your language / እባክዎን ቋንቋ ይምረጡ / Maaloo afaan filadhaa:`,
            {
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
                  Markup.button.callback('🌳 Afaan Oromoo', 'set_lang_om'),
                  Markup.button.callback('🇬🇧 English', 'set_lang_en')
                ]
              ])
            }
          );
        });

        // --- PRE-REGISTRATION WIZARD ---
        const startRegistrationFlow = async (ctx) => {
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(ctx.from.id, env);
          userStates[chatId] = { step: 'AWAITING_NAME', data: {} };

          return ctx.reply(i18n[lang].reg_start_msg, { parse_mode: 'Markdown' });
        };

        bot.command('register', startRegistrationFlow);
        bot.action('start_reg_wizard', async (ctx) => {
          await ctx.answerCbQuery();
          return startRegistrationFlow(ctx);
        });

        // Registration Step: Grade
        bot.action(/reg_grade_(.+)/, async (ctx) => {
          const chatId = ctx.chat.id;
          const gradeNum = ctx.match[1];
          const lang = await getUserLanguage(ctx.from.id, env);

          if (!userStates[chatId]) userStates[chatId] = { step: 'AWAITING_GRADE', data: {} };
          userStates[chatId].data.grade = `Grade ${gradeNum}`;
          userStates[chatId].step = 'AWAITING_STREAM';

          await ctx.answerCbQuery();
          return ctx.reply(
            i18n[lang].reg_ask_stream(`Grade ${gradeNum}`),
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('🔬 Natural Science', 'reg_stream_natural'),
                  Markup.button.callback('📚 Social Science', 'reg_stream_social')
                ],
                [Markup.button.callback('🎓 General High School', 'reg_stream_general')]
              ])
            }
          );
        });

        // Registration Step: Stream -> Phone
        bot.action(/reg_stream_(.+)/, async (ctx) => {
          const chatId = ctx.chat.id;
          const streamRaw = ctx.match[1];
          const lang = await getUserLanguage(ctx.from.id, env);
          const streamMap = { natural: 'Natural Science', social: 'Social Science', general: 'General High School' };
          const stream = streamMap[streamRaw] || streamRaw;

          if (!userStates[chatId]) userStates[chatId] = { step: 'AWAITING_STREAM', data: {} };
          userStates[chatId].data.stream = stream;
          userStates[chatId].step = 'AWAITING_PHONE';

          await ctx.answerCbQuery();
          return ctx.reply(
            i18n[lang].reg_ask_phone(stream),
            {
              parse_mode: 'Markdown',
              ...Markup.keyboard([
                [Markup.button.contactRequest('📱 Share Phone Number / ስልክ አጋራ')],
                ['❌ Cancel / ሰርዝ']
              ]).resize().oneTime()
            }
          );
        });

        // Complete Registration Helper
        const completeUserRegistration = async (ctx, userData) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(userId, env);

          const fullName = userData.fullName || ctx.from?.first_name || 'Student';
          const phone = userData.phone || 'N/A';
          const grade = userData.grade || 'Grade 10';
          const stream = userData.stream || 'Natural Science';

          if (env.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO users (telegram_id, full_name, phone, grade, stream, language, is_channel_member, is_active, registered_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(telegram_id) DO UPDATE SET
                  full_name = excluded.full_name,
                  phone = excluded.phone,
                  grade = excluded.grade,
                  stream = excluded.stream,
                  language = excluded.language,
                  is_active = 1
              `).bind(userId, fullName, phone, grade, stream, lang).run();
            } catch (err) {
              console.error('User save error:', err);
            }
          }

          registeredUsers[userId] = { telegram_id: userId, fullName, phone, grade, stream, language: lang, is_active: true };
          if (userStates[chatId]) userStates[chatId].step = null;

          const mainKeyboard = getMainMenuKeyboard(lang);

          return ctx.reply(
            i18n[lang].reg_success(fullName, phone, grade, stream),
            {
              parse_mode: 'Markdown',
              ...mainKeyboard
            }
          );
        };

        bot.on('contact', async (ctx) => {
          const chatId = ctx.chat.id;
          const phone = ctx.message.contact?.phone_number || '';
          const state = userStates[chatId];
          if (state && state.step === 'AWAITING_PHONE') {
            state.data.phone = phone;
            return completeUserRegistration(ctx, state.data);
          }
        });

        const showChannelVerifyStep = async (ctx, data) => {
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(ctx.from.id, env);
          if (userStates[chatId]) userStates[chatId].step = 'AWAITING_CHANNEL_VERIFY';

          return ctx.reply(
            i18n[lang].reg_channel_step,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.url('📢 Channel (@SmartXEthiopia)', 'https://t.me/SmartXEthiopia')],
                [Markup.button.callback('✅ Verify Membership / አባልነት አረጋግጥ', 'verify_channel_membership')]
              ])
            }
          );
        };

        bot.action('verify_channel_membership', async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(userId, env);
          const state = userStates[chatId];
          const userData = state?.data || registeredUsers[userId] || {};

          let isMember = false;
          try {
            const member = await ctx.telegram.getChatMember('@SmartXEthiopia', userId);
            if (['creator', 'administrator', 'member'].includes(member.status)) isMember = true;
          } catch (err) {
            isMember = true;
          }

          if (!isMember) {
            await ctx.answerCbQuery('Please join @SmartXEthiopia channel first! ❌', { show_alert: true });
            return showChannelVerifyStep(ctx, userData);
          }

          const fullName = userData.fullName || ctx.from.first_name || 'Student';
          const phone = userData.phone || 'N/A';
          const grade = userData.grade || 'Grade 10';
          const stream = userData.stream || 'Natural Science';

          if (env.DB) {
            try {
              await env.DB.prepare(`
                INSERT INTO users (telegram_id, full_name, phone, grade, stream, language, is_channel_member, is_active, registered_at)
                VALUES (?, ?, ?, ?, ?, ?, 1, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(telegram_id) DO UPDATE SET
                  full_name = excluded.full_name,
                  phone = excluded.phone,
                  grade = excluded.grade,
                  stream = excluded.stream,
                  language = excluded.language,
                  is_active = 1
              `).bind(userId, fullName, phone, grade, stream, lang).run();
            } catch (err) {
              console.error('User save error:', err);
            }
          }

          registeredUsers[userId] = { telegram_id: userId, fullName, phone, grade, stream, language: lang, is_active: true };
          if (userStates[chatId]) userStates[chatId].step = null;

          await ctx.answerCbQuery('Verified! 🎉');
          const mainKeyboard = getMainMenuKeyboard(lang);

          return ctx.reply(
            i18n[lang].reg_success(fullName, phone, grade, stream),
            {
              parse_mode: 'Markdown',
              ...mainKeyboard
            }
          );
        });

        // --- ROW 1: Settings & AI Assistant ---
        const handleSettings = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);
          const tObj = i18n[lang];

          let profileText = '';
          if (env.DB) {
            try {
              const u = await env.DB.prepare('SELECT * FROM users WHERE telegram_id = ?').bind(userId).first();
              if (u) {
                profileText = `\n\n👤 *Your Current Profile:*\n• Name: ${u.full_name}\n• Phone: ${u.phone}\n• Grade: ${u.grade}\n• Stream: ${u.stream}\n• Language: ${u.language.toUpperCase()}`;
              }
            } catch (e) {}
          }

          return ctx.reply(
            `${tObj.settings_title}${profileText}`,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.callback(tObj.btn_change_lang, 'show_lang_options')],
                [Markup.button.callback(tObj.btn_update_profile, 'start_reg_wizard')],
                [Markup.button.callback(tObj.btn_verify_channel, 'verify_channel_membership')]
              ])
            }
          );
        };

        bot.action('show_lang_options', async (ctx) => {
          await ctx.answerCbQuery();
          return ctx.reply(
            `🌐 Please select your language / እባክዎን ቋንቋ ይምረጡ / Maaloo afaan filadhaa:`,
            {
              ...Markup.inlineKeyboard([
                [
                  Markup.button.callback('🇪🇹 አማርኛ', 'set_lang_am'),
                  Markup.button.callback('🌳 Afaan Oromoo', 'set_lang_om'),
                  Markup.button.callback('🇬🇧 English', 'set_lang_en')
                ]
              ])
            }
          );
        });

        bot.action('verify_discussion_membership', async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);
          const isMember = await checkDiscussionGroupMember(ctx, userId);

          if (!isMember) {
            await ctx.answerCbQuery('Please join @SmartX_Discussion group first! ❌', { show_alert: true });
            return requireDiscussionGroupJoin(ctx, lang);
          }

          await ctx.answerCbQuery('Discussion Group Verified! 🎉');
          const chatId = ctx.chat.id;
          userStates[chatId] = { step: 'AI_CHAT_MODE' };

          const successMsg = lang === 'om'
            ? `🎉 *Gareen Marii Mirkanaa'eera!* Amma gaaffii barnootaa kamiyyuu AI Assistant gaafachuu dandeessu.`
            : lang === 'en'
            ? `🎉 *Discussion Group Verified!* You can now ask any Grade 9-12 curriculum question to the Smart X AI Assistant.`
            : `🎉 *የውይይት ግሩፕ አባልነትዎ ተረጋግጧል!* አሁን ማንኛውንም የ Grade 9-12 ትምህርታዊ ጥያቄ ለ AI Assistant መጠየቅ ይችላሉ።`;

          return ctx.reply(successMsg, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard(lang)
          });
        });

        bot.hears(['⚙️ Settings / መቼቶች', '⚙️ መቼቶች', '⚙️ Qindaa\'inaa', '⚙️ Settings', 'መቼቶች', 'Qindaa\'inaa'], handleSettings);
        bot.command('settings', handleSettings);

        const handleAiMode = async (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;
          const lang = await getUserLanguage(userId, env);

          const isMember = await checkDiscussionGroupMember(ctx, userId);
          if (!isMember) {
            return requireDiscussionGroupJoin(ctx, lang);
          }

          userStates[chatId] = { step: 'AI_CHAT_MODE' };
          return ctx.reply(i18n[lang].ai_intro, { parse_mode: 'Markdown' });
        };

        bot.hears(['🤖 Smart X AI Assistant', 'AI Assistant', 'AI', 'አሲስታንት', 'Gargaaraa AI'], handleAiMode);
        bot.command('ai', handleAiMode);

        // --- ROW 2: Interactive Quiz Engine & Practice System ---
        const handleQuizTrigger = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);

          // Generate or select dynamic quiz
          const quiz = await generateAiQuiz('Chemistry', '10', lang, env);
          return sendInteractiveQuiz(ctx, quiz, lang);
        };

        bot.hears(['❓ Daily Quiz / የዛሬው Quiz', '❓ የዛሬው Quiz', '❓ Gaaffii Guyyaa', '❓ Daily Quiz', 'የዛሬው Quiz', 'ጥያቄ', 'Quiz'], handleQuizTrigger);
        bot.command('quiz', handleQuizTrigger);

        // Native Telegram Quiz Poll Command (/poll)
        bot.command('poll', async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);
          const quiz = await generateAiQuiz('Physics', '11', lang, env);

          const cleanOptions = quiz.options.map(o => o.replace(/^[A-D]\)\s*/, ''));

          return ctx.replyWithQuiz(
            `[Grade 11 Physics] ${quiz.question}`,
            cleanOptions,
            {
              correct_option_id: quiz.correct_index,
              explanation: `${quiz.explanation}\n\n📲 Smart X ET App releases Meskerem 5 / September 2026!`,
              is_anonymous: false
            }
          );
        });

        // Callback handler for Interactive Quiz Button Selections
        bot.action(/quiz_opt_(.+)_(\d+)/, async (ctx) => {
          const quizId = ctx.match[1];
          const selectedIdx = parseInt(ctx.match[2], 10);
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);

          const quiz = activeQuizzes[quizId] || CURATED_QUIZZES[0];
          const isCorrect = selectedIdx === quiz.correct_index;

          const alertMsg = isCorrect ? '🎉 Correct Answer!' : '❌ Incorrect Answer!';
          await ctx.answerCbQuery(alertMsg, { show_alert: true });

          const releaseReminder = lang === 'om'
            ? `\n\n📲 *Appilikeeshiniin Smart X Ethiopian Fulbaana 5 / September 2026 irratti gadhiifama!*`
            : lang === 'en'
            ? `\n\n📲 *Smart X Ethiopian Mobile App releases on Meskerem 5 / September 2026!*`
            : `\n\n📲 *የ Smart X Ethiopian ሞባይል አፕሊኬሽን በመስከረም 5 / ሴፕቴምበር 2026 ይለቀቃል!*`;

          const resultText = isCorrect
            ? `🎉 *ትክክለኛ መልስ አግኝተዋል! (Correct!)*\n\n💡 *መግለጫ (Explanation):* ${quiz.explanation}${releaseReminder}`
            : `❌ *መልሱ የተሳሳተ ነው! (Incorrect)*\n\n• *ትክክለኛ መልስ:* ${quiz.options[quiz.correct_index]}\n💡 *መግለጫ (Explanation):* ${quiz.explanation}${releaseReminder}`;

          return ctx.editMessageText(resultText, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [
                Markup.button.callback('🔄 Next Quiz / ሌላ ጥያቄ', 'quiz_generate_new'),
                Markup.button.callback('📝 Pre-Register Now', 'start_reg_wizard')
              ]
            ])
          });
        });

        bot.action('quiz_generate_new', async (ctx) => {
          await ctx.answerCbQuery('Generating next quiz...');
          const lang = await getUserLanguage(ctx.from.id, env);
          const subjects = ['Physics', 'Chemistry', 'Biology', 'Mathematics', 'History'];
          const randomSub = subjects[Math.floor(Math.random() * subjects.length)];
          const randomGrade = String(Math.floor(Math.random() * 4) + 9); // Grade 9-12

          const quiz = await generateAiQuiz(randomSub, randomGrade, lang, env);
          return sendInteractiveQuiz(ctx, quiz, lang);
        });

        const handleAbout = async (ctx) => {
          const lang = await getUserLanguage(ctx.from.id, env);
          return ctx.reply(i18n[lang].about_text, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([[Markup.button.callback('📝 Pre-Register Now', 'start_reg_wizard')]])
          });
        };

        bot.hears(['📱 About Smart X ET / ስለ አፑ', '📱 ስለ Smart X ET', '📱 Waa\'ee Smart X ET', '📱 About Smart X ET', 'ስለ አፑ'], handleAbout);
        bot.command('info', handleAbout);

        // --- ROW 3: Official Channel & Support ---
        const handleChannel = async (ctx) => {
          const lang = await getUserLanguage(ctx.from.id, env);
          return ctx.reply(
            i18n[lang].channel_info,
            {
              parse_mode: 'Markdown',
              ...Markup.inlineKeyboard([
                [Markup.button.url('📢 Channel (@SmartXEthiopia)', 'https://t.me/SmartXEthiopia')],
                [Markup.button.callback('✅ Verify Membership', 'verify_channel_membership')]
              ])
            }
          );
        };

        bot.hears(['📢 Official Channel', '📢 ኦፊሴላዊ ቻናል', '📢 Chanaalii Ufisaa', 'ቻናል'], handleChannel);

        const handleSupport = async (ctx) => {
          const lang = await getUserLanguage(ctx.from.id, env);
          return ctx.reply(i18n[lang].support_info, { parse_mode: 'Markdown' });
        };

        bot.hears(['💬 Support & Feedback', '💬 አስተያየትና እገዛ', '💬 Deeggarsa & Yaada', 'እገዛ'], handleSupport);

        // --- FAQ HANDLER ---
        const handleFaq = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);

          const faqTextMap = {
            am: `❓ *Smart X Ethiopian (Smart X ET) - ተደጋግመው የሚጠየቁ ጥያቄዎች (FAQ)*\n\n` +
                `1️⃣ *Smart X ET ምንድነው?*\n` +
                `• ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grade 9-12) የተዘጋጀ የ AI Study Assistant እና 10,000+ Quizzes የያዘ የሞባይል አፕሊኬሽን ነው።\n\n` +
                `2️⃣ *አፑ መቼ ይለቀቃል?*\n` +
                `• አፑ በይፋ **መስከረም 5 / ሴፕቴምበር 2026** ለ Android እና iOS ይለቀቃል።\n\n` +
                `3️⃣ *የ AI Assistant አገልግሎት እንዴት መጠቀም እችላለሁ?*\n` +
                `• የ \`🤖 Smart X AI Assistant\` በተንን በመጫን ማንኛውንም የትምህርት ጥያቄ መጠየቅ ይችላሉ።\n\n` +
                `4️⃣ *የእገዛ እና የውይይት ቻናሎች የት ይገኛሉ?*\n` +
                `• Telegram Channel: @SmartXEthiopia\n` +
                `• Discussion Group: @SmartX_Discussion\n` +
                `• Developer: HAB IT Solutions (smartx.ethiopia.dev@gmail.com)`,

            om: `❓ *Smart X Ethiopian (Smart X ET) - Gaaffiilee Yeroo Baay'ee Gaafataman (FAQ)*\n\n` +
                `1️⃣ *Smart X ET maali?*\n` +
                `• Appilikeeshinii AI Study Assistant fi Quizzes 10,000+ Sirna Barnoota Haaraa Itoophiyaa (Grade 9-12) tiif qophaa'eedha.\n\n` +
                `2️⃣ *Appiin yoom gadhiifama?*\n` +
                `• Officialy **Fulbaana 5 / September 2026** irratti Android fi iOS tiif gadhiifama.\n\n` +
                `3️⃣ *Gargaaraa AI akkamitti fayyadamuun danda'ama?*\n` +
                `• Botoonii \`🤖 Smart X AI Assistant\` cuqaasuun gaaffii barnootaa kamiyyuu gaafachuu dandeessu.\n\n` +
                `4️⃣ *Chanaalii fi Gareen marii eessa jira?*\n` +
                `• Telegram Channel: @SmartXEthiopia\n` +
                `• Discussion Group: @SmartX_Discussion\n` +
                `• Developer: HAB IT Solutions`,

            en: `❓ *Smart X Ethiopian (Smart X ET) - Frequently Asked Questions (FAQ)*\n\n` +
                `1️⃣ *What is Smart X ET?*\n` +
                `• An AI-powered study assistant & interactive quiz application designed for the New Ethiopian High School Curriculum (Grades 9-12).\n\n` +
                `2️⃣ *When will the app officially release?*\n` +
                `• The mobile app officially launches on **Meskerem 5 / September 2026** for Android & iOS.\n\n` +
                `3️⃣ *How do I ask questions to the AI Assistant?*\n` +
                `• Click the \`🤖 Smart X AI Assistant\` button and type any Grade 9-12 subject question.\n\n` +
                `4️⃣ *Official Community & Channels:*\n` +
                `• Channel: @SmartXEthiopia\n` +
                `• Discussion Group: @SmartX_Discussion\n` +
                `• Developer: HAB IT Solutions (smartx.ethiopia.dev@gmail.com)`
          };

          return ctx.reply(faqTextMap[lang] || faqTextMap.am, {
            parse_mode: 'Markdown',
            ...Markup.inlineKeyboard([
              [Markup.button.url('💬 Discussion Group', 'https://t.me/SmartX_Discussion')],
              [Markup.button.url('📢 Official Channel', 'https://t.me/SmartXEthiopia')]
            ])
          });
        };

        bot.hears(['❓ FAQ / ጥያቄዎች', '❓ FAQ / Gaaffiilee', '❓ FAQ', 'FAQ', 'ጥያቄዎች', 'Gaaffiilee'], handleFaq);
        bot.command('faq', handleFaq);

        // --- ADMIN BROADCAST SYSTEM ---
        const handleAdminBroadcastCommand = (ctx) => {
          const userId = ctx.from.id;
          const chatId = ctx.chat.id;

          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ Access Denied! Admin command only.', { parse_mode: 'HTML' });
          }

          userStates[chatId] = { step: 'AWAITING_BROADCAST_CONTENT' };

          return ctx.reply(
            `📢 <b>Admin Broadcast Creation (HTML Mode)</b>\n\n` +
            `Send or forward the message you want to broadcast to all pre-registered users in D1 Database.\n\n` +
            `Supports HTML formatting (<b>bold</b>, <i>italic</i>, <code>code</code>, <a href="...">link</a>, and plain text with underscores <code>_</code>).\n\n` +
            `Type <code>/cancel_broadcast</code> to cancel.`,
            { parse_mode: 'HTML' }
          );
        };

        bot.command('broadcast', handleAdminBroadcastCommand);

        bot.command('cancel_broadcast', (ctx) => {
          const chatId = ctx.chat.id;
          if (userStates[chatId]?.step === 'AWAITING_BROADCAST_CONTENT') {
            userStates[chatId].step = null;
            delete broadcastDrafts[chatId];
            return ctx.reply('❌ Broadcast creation cancelled.');
          }
          return ctx.reply('No active broadcast session.');
        });

        bot.command('send_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) {
            return ctx.reply('⛔ Access Denied! Admin command only.');
          }

          let payload = null;
          if (ctx.message.reply_to_message) {
            payload = extractMessagePayload(ctx.message.reply_to_message);
          } else {
            const text = ctx.message.text.replace('/send_broadcast', '').trim();
            if (!text) return ctx.reply('⚠️ Please provide message text or reply to a message.');
            payload = { type: 'text', text, caption: '', parse_mode: 'Markdown', from_chat_id: ctx.chat.id, message_id: ctx.message.message_id };
          }

          return startBroadcastProcess(ctx, payload);
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
              .filter(id => registeredUsers[id].is_active !== false)
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

          await ctx.reply(
            `🚀 *Broadcast queued in Cloudflare D1!*\n\n🆔 *ID:* #${broadcastId}\n📬 *Total:* ${totalRecipients}\n⚡ *Rate Limit:* ~25-30 msgs/min (Rate-Limit Safe)`,
            { parse_mode: 'Markdown' }
          );

          const batchRes = await processBroadcastQueueBatch(bot, env, 25);

          return ctx.reply(
            `📊 *First Batch Result:*\n• Delivered: ${batchRes.sent || 0}\n• Blocked: ${batchRes.blocked || 0}\n• Failed: ${batchRes.failed || 0}\n\nRemaining items will be processed via Cloudflare Worker Cron Trigger. Use \`/broadcast_status\` for reports.`,
            { parse_mode: 'Markdown' }
          );
        }

        const handleBroadcastStatus = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ Admin command only.');
          if (!env.DB) return ctx.reply('⚠️ D1 Database not available.');

          try {
            const b = await env.DB.prepare(`SELECT * FROM broadcasts ORDER BY id DESC LIMIT 1`).first();
            if (!b) return ctx.reply('ℹ️ No broadcast logs found.');

            const total = b.total_recipients || 0;
            const sent = b.sent_count || 0;
            const blocked = b.blocked_count || 0;
            const failed = b.failed_count || 0;
            const pending = b.pending_count || 0;
            const totalAttempted = sent + blocked + failed;
            const successRate = totalAttempted > 0 ? ((sent / totalAttempted) * 100).toFixed(1) : '100.0';

            return ctx.reply(
              `📊 *Smart X ET Broadcast Status Report*\n\n` +
              `🆔 *ID:* #${b.id}\n` +
              `📌 *Status:* ${b.status}\n` +
              `• 👥 *Total:* ${total}\n` +
              `• 📬 *Delivered:* ${sent}\n` +
              `• 🚫 *Blocked:* ${blocked}\n` +
              `• ❌ *Failed:* ${failed}\n` +
              `• ⏳ *Pending:* ${pending}\n` +
              `🎯 *Success Rate:* ${successRate}%`,
              { parse_mode: 'Markdown' }
            );
          } catch (err) {
            return ctx.reply(`⚠️ Error fetching report: ${err.message}`);
          }
        };

        bot.command('broadcast_status', handleBroadcastStatus);
        bot.command('broadcast_report', handleBroadcastStatus);

        // --- ADMIN USER MANAGEMENT COMMANDS ---
        bot.command(['delete_user', 'delete_registration', 'delete'], async (ctx) => {
          const adminId = ctx.from.id;
          if (!isAdmin(adminId, env)) {
            return ctx.reply('⛔ Access Denied! Admin authority command only.');
          }

          const args = ctx.message.text.split(' ').slice(1);
          const targetId = args[0] ? parseInt(args[0], 10) : null;

          if (!targetId || isNaN(targetId)) {
            return ctx.reply(
              '⚠️ *Admin Delete User Command Usage:*\n\n`/delete_user <telegram_id>`\nExample: `/delete_user 123456789`',
              { parse_mode: 'Markdown' }
            );
          }

          let deletedCount = 0;
          if (env.DB) {
            try {
              const res = await env.DB.prepare('DELETE FROM users WHERE telegram_id = ?').bind(targetId).run();
              deletedCount = res.meta?.changes || 0;
            } catch (err) {
              console.error('Delete user error:', err);
            }
          }

          delete registeredUsers[targetId];
          delete userLanguages[targetId];

          return ctx.reply(
            `🗑️ *Admin Authority Action Completed:*\n\nUser registration data for Telegram ID \`#${targetId}\` has been permanently deleted from Cloudflare D1 database and active session cache!`,
            { parse_mode: 'Markdown' }
          );
        });

        bot.command(['users', 'list_users', 'registered_users'], async (ctx) => {
          const adminId = ctx.from.id;
          if (!isAdmin(adminId, env)) return ctx.reply('⛔ Access Denied! Admin authority command only.');

          let totalCount = 0;
          let userRows = [];

          if (env.DB) {
            try {
              const countRes = await env.DB.prepare('SELECT COUNT(*) as total FROM users').first();
              totalCount = countRes?.total || 0;

              const rowsRes = await env.DB.prepare('SELECT telegram_id, full_name, phone, grade, language FROM users ORDER BY registered_at DESC LIMIT 10').all();
              userRows = rowsRes?.results || [];
            } catch (e) {}
          }

          let userListText = userRows.map((u, i) => `${i + 1}. *${u.full_name}* (\`#${u.telegram_id}\`) - ${u.grade} [${u.phone}]`).join('\n');

          return ctx.reply(
            `👥 *Total Pre-Registered Users:* ${totalCount}\n\n*Recent Registrations:*\n${userListText || 'No registered users in DB.'}\n\nTo delete a registered user, run:\n\`/delete_user <telegram_id>\``,
            { parse_mode: 'Markdown' }
          );
        });

        // --- Catch-all Message Handler ---
        bot.on(['message'], async (ctx) => {
          const chatId = ctx.chat.id;
          const msg = ctx.message;
          const text = (msg.text || msg.caption || '').trim();
          const userId = ctx.from.id;
          const lang = await getUserLanguage(userId, env);

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

            return ctx.reply(
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

            const btnPreview = draft.button ? `• <b>Inline Button:</b> <a href="${draft.button.url}">${draft.button.text}</a>` : `• <b>Inline Button:</b> None`;
            const contentPreview = draft.text || draft.caption || '(No text content)';

            const previewKeyboard = [];
            if (draft.button) {
              previewKeyboard.push([Markup.button.url(draft.button.text, draft.button.url)]);
            }
            previewKeyboard.push([
              Markup.button.callback('🚀 Start Broadcast', 'start_broadcast_confirm'),
              Markup.button.callback('❌ Cancel Draft', 'cancel_broadcast_draft')
            ]);

            return ctx.reply(
              `🔍 <b>Broadcast Message Preview (HTML Mode):</b>\n\n` +
              `• <b>Type:</b> ${draft.type.toUpperCase()}\n` +
              `${btnPreview}\n\n` +
              `<b>Content Preview:</b>\n` +
              `${contentPreview}\n\n` +
              `<i>Ready to send to all pre-registered users in Cloudflare D1?</i>`,
              {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard(previewKeyboard)
              }
            );
          }

          // Registration Wizard State
          const state = userStates[chatId];
          if (state && state.step) {
            if (state.step === 'AWAITING_NAME' && text) {
              state.data.fullName = text;
              state.step = 'AWAITING_GRADE';

              return ctx.reply(
                i18n[lang].reg_ask_grade(text),
                {
                  parse_mode: 'Markdown',
                  ...Markup.inlineKeyboard([
                    [
                      Markup.button.callback('Grade 9', 'reg_grade_9'),
                      Markup.button.callback('Grade 10', 'reg_grade_10')
                    ],
                    [
                      Markup.button.callback('Grade 11', 'reg_grade_11'),
                      Markup.button.callback('Grade 12', 'reg_grade_12')
                    ]
                  ])
                }
              );
            }

            if (state.step === 'AWAITING_PHONE' && text) {
              if (text.includes('Cancel') || text.includes('ሰርዝ')) {
                userStates[chatId].step = null;
                return ctx.reply('Cancelled / ተሰርዟል።', { ...getMainMenuKeyboard(lang) });
              }

              state.data.phone = text;
              return completeUserRegistration(ctx, state.data);
            }
          }

          // Interactive Quiz / Practice Request Detection
          const lowerText = text.toLowerCase();
          if (lowerText.includes('quiz') || lowerText.includes('question') || lowerText.includes('ጥያቄ') || lowerText.includes('gaaffii') || lowerText.includes('practice') || lowerText.includes('mcq')) {
            let extractedSubject = 'General High School';
            let extractedGrade = '10';

            if (lowerText.includes('physic')) extractedSubject = 'Physics';
            else if (lowerText.includes('chemis')) extractedSubject = 'Chemistry';
            else if (lowerText.includes('bio')) extractedSubject = 'Biology';
            else if (lowerText.includes('math')) extractedSubject = 'Mathematics';
            else if (lowerText.includes('histor')) extractedSubject = 'History';

            if (lowerText.includes('9') || lowerText.includes('9ኛ')) extractedGrade = '9';
            else if (lowerText.includes('11') || lowerText.includes('11ኛ')) extractedGrade = '11';
            else if (lowerText.includes('12') || lowerText.includes('12ኛ')) extractedGrade = '12';

            const quiz = await generateAiQuiz(extractedSubject, extractedGrade, lang, env);
            return sendInteractiveQuiz(ctx, quiz, lang);
          }

          // --- AI Assistant Query Handler with Dynamic D1 Knowledge Base & Discussion Group Requirement ---
          const isGroupMember = await checkDiscussionGroupMember(ctx, userId);
          if (!isGroupMember) {
            return requireDiscussionGroupJoin(ctx, lang);
          }

          let aiResponseText = '';
          let usedModelName = 'gemini-3.6-flash';

          try {
            const dynamicSystemInstruction = await buildDynamicSystemPrompt(lang, env);

            const aiResponse = await generateWithGeminiFallback({
              contents: text,
              config: {
                systemInstruction: dynamicSystemInstruction
              }
            }, env);

            if (aiResponse && aiResponse.text) {
              aiResponseText = aiResponse.text;
              usedModelName = aiResponse.modelUsed || 'gemini-3.6-flash';
            }
          } catch (err) {
            // Keep technical errors strictly in internal developer logs (never show stack traces to students)
            console.error('[AI Assistant Engine Log]:', err.message || err);
          }

          // Student-Facing Clean Fallback Text (Polite, encouraging, under 3 sentences, no tech jargon)
          if (!aiResponseText) {
            if (lang === 'om') {
              aiResponseText = `Baga nagaan dhuftan! Appilikeeshiniin Smart X Ethiopian Kutaalee 9-12 tiif Fulbaana 5 / September 2026 irratti gadhiifama. Shaakalaaf /quiz tuqaa ykn galmeeffachuuf /register fayyadamaa.`;
            } else if (lang === 'en') {
              aiResponseText = `Welcome! Smart X Ethiopian Mobile App for Grades 9-12 officially releases on Meskerem 5 / September 2026. Try /quiz for practice or /register to join.`;
            } else {
              aiResponseText = `ሰላም! Smart X Ethiopian ሞባይል አፕሊኬሽን ለ Grade 9-12 ተማሪዎች በመስከረም 5 / ሴፕቴምበር 2026 ይለቀቃል። ለማንኛውም ጥያቄ /quiz በማለት ይለማመዱ ወይም በ /register ይመዝገቡ!`;
            }
          }

          // Save chat query and response into Cloudflare D1 ai_chats table
          await logAiChat(env, userId, text, aiResponseText, lang, usedModelName);

          return ctx.reply(aiResponseText, {
            parse_mode: 'Markdown',
            ...getMainMenuKeyboard(lang)
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
