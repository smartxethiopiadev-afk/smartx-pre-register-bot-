import { Telegraf, Markup } from 'telegraf';

// In-memory session tracking and fallback state
const userStates = {};
const registeredUsers = {};
const broadcastDrafts = {};
const adminActionDrafts = {};
const lastBotMessages = {};

// Fallback Default Promo Templates (Grade 9-12 + General)
const defaultPromoTemplates = [
  {
    id: 1,
    title: '📚 ለ 9-12ኛ ክፍል (አጠቃላይ)',
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
    button_text: '✨ አዎ! እንፈልጋለን',
    content_html:
`📚 <b>ለ 9ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?

የ 9ኛ ክፍል አዲሱ ካሪኩለም ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!`
  },
  {
    id: 3,
    title: '📘 ለ 10ኛ ክፍል ተማሪዎች',
    grade: '10',
    button_text: '✨ አዎ! እንፈልጋለን',
    content_html:
`🎯 <b>ለ 10ኛ ክፍል ተማሪዎች የተዘጋጀ ልዩ አጋዥ!</b> 🇪🇹

ለፈተና በብቃት ለመዘጋጀት የሁሉንም ትምህርቶች <b>Short Notes</b> እና <b>Model Worksheets</b> ይፈልጋሉ?

ሁሉንም ጥያቄዎች ከነዝርዝር ማብራሪያቸው በአንድ ላይ ያግኙ!`
  },
  {
    id: 4,
    title: '📙 ለ 11ኛ ክፍል ተማሪዎች',
    grade: '11',
    button_text: '✨ አዎ! እንፈልጋለን',
    content_html:
`💡 <b>ለ 11ኛ ክፍል Natural እና Social Science ተማሪዎች!</b> 🇪🇹

የከበዷችሁን የትምህርት ምዕራፎች በቀላሉ ለመረዳት አጋዥ <b>Short Notes</b> እና <b>Worksheets</b> ማግኘት ትፈልጋላችሁ?

የ 11ኛ ክፍል የሁሉንም ትምህርቶች አጋዥ ቁሳቁሶች ተዘጋጅተዋል!`
  },
  {
    id: 5,
    title: '🎓 ለ 12ኛ ክፍል ተማሪዎች',
    grade: '12',
    button_text: '✨ አዎ! እንፈልጋለን',
    content_html:
`🏆 <b>ለ 12ኛ ክፍል የዩኒቨርሲቲ መግቢያ ፈተና ተፈታኞች!</b> 🇪🇹

ለብሔራዊ ፈተና ከፍተኛ ውጤት ለማምጣት አጋዥ <b>Short Notes</b> እና <b>Model Exams</b> ይፈልጋሉ?

ያለፉት አመታት የፈተና ጥያቄዎች እና የሞዴል ፈተናዎች ከነመልሳቸው ተዘጋጅተዋል!`
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

// Helper: Dynamically get Bot Username
function getBotUsername(ctx, env) {
  if (ctx?.botInfo?.username) return ctx.botInfo.username;
  if (ctx?.me?.username) return ctx.me.username;
  if (env?.BOT_USERNAME) return env.BOT_USERNAME.replace('@', '');
  if (process.env.BOT_USERNAME) return process.env.BOT_USERNAME.replace('@', '');
  return 'testing_pent_bot';
}

// Helper: Dynamically fetch channel or system configs from D1
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

// Multi-language UI Texts, Questions, Help & Settings
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
      '📱 <b>ጥያቄ 4 ከ 5:</b>\n\nያለ ኢንተርኔት በ 100% Offline የሚሰራ የጥናት መተግበሪያ መጠቀም ትፈልጋለህ?',
      '🎯 <b>ጥያቄ 5 ከ 5:</b>\n\nበዚህ አመት ከፍተኛ የትምህርት ውጤት (High Score) ለማምጣት ቆርጠሃል?'
    ],
    yes: '✅ አዎ',
    no: '❌ አይ',
    channel_step: (grade, channel) => `✅ የተመረጠ ክፍል: <b>${escapeHtml(grade)}</b>\n\n📢 <b>ቴሌግራም ቻናል:</b>\nሁሉንም የትምህርት ቁሳቁሶች ለማግኘት <b>${escapeHtml(channel)}</b> ይቀላቀሉ:`,
    join_channel: '💬 ቻናሉን ተቀላቀል',
    verify_channel: '✅ አረጋግጥ',
    channel_joined_alert: '✅ ቻናል አባልነትዎ ተረጋግጧል!',
    channel_not_joined_alert: (channel) => `⚠️ እባክዎን መጀመሪያ ${channel} ይቀላቀሉ!`,
    phone_step: '📱 <b>የስልክ ቁጥር:</b>\n\nምዝገባውን ለማጠናቀቅ ከታች ያለውን አዝራር በመጫን ስልክ ቁጥርህን ላክ:',
    share_contact_btn: '📱 ስልክ ቁጥር አጋራ',
    notify_prompt: '🔔 <b>የሞባይል አፕሊኬሽን ማሳወቂያ:</b>\n\nየ <b>Smart X Ethiopian</b> ሞባይል አፕሊኬሽን <b>በመስከረም 5</b> ሲለቀቅ ማሳወቂያ (Notification) እንዲደርስህ ትፈልጋለህ?',
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
• <b>ስልክ:</b> <code>${escapeHtml(user.phone || 'N/A')}</code>
• <b>ቋንቋ:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'አማርኛ'}</code>
• <b>ማሳወቂያ:</b> <code>${user.app_notification ? '🔔 የበራ' : '🔕 የጠፋ'}</code>
• <b>ነጥብ:</b> <code>${user.points || 0} pts (${user.referral_count || 0} የተጋበዙ)</code>
━━━━━━━━━━━━━━━━━━━━
የሚፈልጉትን ማስተካከያ ይምረጡ ⬇️`,
    change_lang_btn: '🌐 ቋንቋ ቀይር',
    change_grade_btn: '🎓 ክፍል ቀይር',
    toggle_notify_btn: (status) => status ? '🔕 ማሳወቂያ አጥፋ' : '🔔 ማሳወቂያ አብራ',
    back_to_menu_btn: '🔙 ወደ ዋናው ማውጫ',
    back_btn: '🔙 ተመለስ',
    help_title: '📞 <b>እገዛ እና ግንኙነት — Smart X Ethiopian</b> 🇪🇹',
    help_body:
`📱 <b>ስለ Smart X Ethiopian የሞባይል አፕሊኬሽን:</b>

<b>Smart X Ethiopian</b> ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ ዘመናዊ የትምህርት መተግበሪያ ነው።

✨ <b>ዋና ዋና አገልግሎቶች:</b>
• 📚 የሁሉንም ትምህርቶች አጫጭር ማጠቃለያዎች (Short Notes)
• 📝 የሞዴል ፈተናዎች እና የ Worksheet ጥያቄዎች ከነመልሶቻቸው
• ⚡ <b>100% Offline</b> — ያለ ምንም ኢንተርኔት በነፃ ይሰራል
• 🎯 ለአዲሱ ካሪኩለም በልዩ ጥራት የተዘጋጀ

🗓️ <b>የሚለቀቅበት ቀን:</b> <b>መስከረም 5</b>

💬 <b>እገዛ ወይም ጥያቄ ካለዎት:</b>
• 📢 ኦፊሴላዊ ቻናል: @SmartXEthiopia
• 💬 የውይይት ግሩፕ: @SmartX_Discussion
• 👨‍💻 የደንበኞች አገልግሎት: @SmartXSupport`,
    contact_admin_btn: '👨‍💻 ድጋፍ አግኝ',
    join_channel_btn: '📢 ቻናሉን ተቀላቀል'
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
      '📝 <b>Question 2 of 5:</b>\n\nDo you want to practice Model Exams and Worksheets with solutions?',
      '💡 <b>Question 3 of 5:</b>\n\nDo you need step-by-step assistance to easily solve difficult exam questions?',
      '📱 <b>Question 4 of 5:</b>\n\nDo you want to use a 100% Offline study application without internet?',
      '🎯 <b>Question 5 of 5:</b>\n\nAre you determined to achieve a High Score this academic year?'
    ],
    yes: '✅ Yes',
    no: '❌ No',
    channel_step: (grade, channel) => `✅ Selected Grade: <b>${escapeHtml(grade)}</b>\n\n📢 <b>Telegram Channel:</b>\nJoin <b>${escapeHtml(channel)}</b> to receive all educational resources:`,
    join_channel: '💬 Join Channel',
    verify_channel: '✅ Verify',
    channel_joined_alert: '✅ Channel membership confirmed!',
    channel_not_joined_alert: (channel) => `⚠️ Please join ${channel} first!`,
    phone_step: '📱 <b>Phone Number:</b>\n\nClick the button below to share your phone number and complete registration:',
    share_contact_btn: '📱 Share Contact',
    notify_prompt: '🔔 <b>Mobile App Release Notification:</b>\n\nWould you like to receive an instant notification when the <b>Smart X Ethiopian</b> mobile app launches on <b>September 15 (መስከረም 5)</b>?',
    notify_yes: '🔔 Yes, Notify Me',
    notify_no: '🔕 No, Skip',
    reg_success: (name) => `🎉 <b>Congratulations ${escapeHtml(name)}! Registration Completed!</b> 🚀\n\nYou are now pre-registered for VIP early access to <b>Smart X Ethiopian</b> launching on <b>September 15 (መስከረም 5)</b>.\n\nChoose an option below ⬇️`,
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
• <b>Phone:</b> <code>${escapeHtml(user.phone || 'N/A')}</code>
• <b>Language:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'Amharic'}</code>
• <b>Notification:</b> <code>${user.app_notification ? '🔔 Enabled' : '🔕 Disabled'}</code>
• <b>Points:</b> <code>${user.points || 0} pts (${user.referral_count || 0} invites)</code>
━━━━━━━━━━━━━━━━━━━━
Choose a setting to modify ⬇️`,
    change_lang_btn: '🌐 Change Language',
    change_grade_btn: '🎓 Change Grade',
    toggle_notify_btn: (status) => status ? '🔕 Disable Notification' : '🔔 Enable Notification',
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

🗓️ <b>Launch Date:</b> <b>September 15 (መስከረም 5)</b>

💬 <b>Need Help or Have Questions?</b>
• 📢 Official Channel: @SmartXEthiopia
• 💬 Community Group: @SmartX_Discussion
• 👨‍💻 Support Admin: @SmartXSupport`,
    contact_admin_btn: '👨‍💻 Contact Support',
    join_channel_btn: '📢 Join Channel'
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
      '📝 <b>Gaaffii 2 / 5:</b>\n\nQorumsa moodeelaa fi gaaffilee Worksheet boqonnaa boqonnaan deebii waliin hojjechuu barbaaddaa?',
      '💡 <b>Gaaffii 3 / 5:</b>\n\nGaaffilee qorumsaa ciccimoo ta\'an salphaatti hubachuuf gargaarsa barbaaddaa?',
      '📱 <b>Gaaffii 4 / 5:</b>\n\nTajaajila barnootaa 100% toora intarneetiin ala (Offline) hojjetu fayyadamuu barbaaddaa?',
      '🎯 <b>Gaaffii 5 / 5:</b>\n\nBarana qabxii olaanaa fiduuf qophiidhaa?'
    ],
    yes: '✅ Eeyyee',
    no: '❌ Lakki',
    channel_step: (grade, channel) => `✅ Kutaa Filatame: <b>${escapeHtml(grade)}</b>\n\n📢 <b>Chaanaalii Telegram:</b>\nQophiiwwan barnootaa hunda argachuuf <b>${escapeHtml(channel)}</b> seenaa:`,
    join_channel: '💬 Chaanaalii Seeni',
    verify_channel: '✅ Mirkaneessi',
    channel_joined_alert: '✅ Chaanaalii seenuun keessan mirkanaa\'eera!',
    channel_not_joined_alert: (channel) => `⚠️ Mee dura ${channel} seenaa!`,
    phone_step: '📱 <b>Lakkoofsa Bilbilaa:</b>\n\nGalmee xumuruuf lakkoofsa bilbila keessanii ergaa:',
    share_contact_btn: '📱 Lakkoofsa Bilbilaa Ergi',
    notify_prompt: '🔔 <b>Beeksisa Appilikeeshinii:</b>\n\nAppilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5 (መስከረም 5)</b> gadhiifamu beeksisni akka isin ga\'u barbaadduu?',
    notify_yes: '🔔 Eeyyee, Na Ga\'i',
    notify_no: '🔕 Lakki, Hin Barbaadu',
    reg_success: (name) => `🎉 <b>Baga gammaddan ${escapeHtml(name)}! Galmeen keessan xumurameera!</b> 🚀\n\nAppilikeeshiniin <b>Smart X Ethiopian</b> yeroo <b>Fulbaana 5 (መስከረም 5)</b> gadhiifamu carraa addaa argattu.\n\nTajaajiloota armaan gadii filadhaa ⬇️`,
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
• <b>Bilbila:</b> <code>${escapeHtml(user.phone || 'N/A')}</code>
• <b>Afaan:</b> <code>${user.language === 'en' ? 'English' : user.language === 'om' ? 'Afaan Oromoo' : 'Amharic'}</code>
• <b>Beeksisa:</b> <code>${user.app_notification ? '🔔 Kan Baname' : '🔕 Kan Cufame'}</code>
• <b>Qabxii:</b> <code>${user.points || 0} pts (${user.referral_count || 0} afeeraman)</code>
━━━━━━━━━━━━━━━━━━━━
Qindaa'ina jijjiiruu barbaaddan filadhaa ⬇️`,
    change_lang_btn: '🌐 Afaan Jijjiiri',
    change_grade_btn: '🎓 Kutaa Jijjiiri',
    toggle_notify_btn: (status) => status ? '🔕 Beeksisa Cufi' : '🔔 Beeksisa Bani',
    back_to_menu_btn: '🔙 Gara Fuula Duraatti',
    back_btn: '🔙 Duubatti',
    help_title: '📞 <b>Gargaarsa & Quunnamtii — Smart X Ethiopian</b> 🇪🇹',
    help_body:
`📱 <b>Waa'ee Appilikeeshinii Smart X Ethiopian:</b>

<b>Smart X Ethiopian</b> appilikeeshinii barattoota Kutaa 9-12tiif qophaa'ee dha.

✨ <b>Faayidaalee Ijoo:</b>
• 📚 Cuunfaa barumsaa (Short Notes) gosa barnoota hundaaf
• 📝 Qorumsa moodeelaa fi gaaffilee Worksheet deebii waliin
• ⚡ <b>100% Offline</b> — Intarneetii malee guutummaatti hojjeta
• 🎯 Sirna barnootaa haaraa Itoophiyaatiif qulqullinaan kan qophaa'e

🗓️ <b>Guyyaa Gadhiifamu:</b> <b>Fulbaana 5 (መስከረም 5)</b>

💬 <b>Gaaffii yoo qabaattan:</b>
• 📢 Chaanaalii: @SmartXEthiopia
• 💬 Garee Maree: @SmartX_Discussion
• 👨‍💻 Tajaajila Maamiltootaa: @SmartXSupport`,
    contact_admin_btn: '👨‍💻 Gargaarsa Argadhu',
    join_channel_btn: '📢 Chaanaalii Seeni'
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
  let notifyOptinCount = 0;
  let templateCount = 0;
  let gradeBreakdown = {};
  let totalReferrals = 0;

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
    templateCount = defaultPromoTemplates.length;
  }

  const text =
`👑 <b>Smart X Ethiopian — Admin Dashboard</b> 🇪🇹

━━━━━━━━━━━━━━━━━━━━
• 👥 <b>ተመዝጋቢ ተማሪዎች:</b> <code>${userCount}</code>
• 🟢 <b>ንቁ ተጠቃሚዎች:</b> <code>${activeUserCount}</code>
• 🔔 <b>አፕ ማሳወቂያ የጠየቁ:</b> <code>${notifyOptinCount}</code>
• 📝 <b>የግሩፕ መልዕክት ቴምፕሌቶች:</b> <code>${templateCount}</code>
• 🔴 <b>ቦት ያቆሙ:</b> <code>${blockedCount}</code>
• 🔗 <b>ጠቅላላ የጥቆማ ግብዣዎች:</b> <code>${totalReferrals}</code>

🎓 <b>የክፍል ክፍፍል:</b>
• 9ኛ ክፍል: <code>${gradeBreakdown['9ኛ ክፍል'] || gradeBreakdown['Grade 9'] || gradeBreakdown['Kutaa 9'] || 0}</code>
• 10ኛ ክፍል: <code>${gradeBreakdown['10ኛ ክፍል'] || gradeBreakdown['Grade 10'] || gradeBreakdown['Kutaa 10'] || 0}</code>
• 11ኛ ክፍል: <code>${gradeBreakdown['11ኛ ክፍል'] || gradeBreakdown['Grade 11'] || gradeBreakdown['Kutaa 11'] || 0}</code>
• 12ኛ ክፍል: <code>${gradeBreakdown['12ኛ ክፍል'] || gradeBreakdown['Grade 12'] || gradeBreakdown['Kutaa 12'] || 0}</code>
━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [
      Markup.button.callback('📢 New Broadcast', 'admin_new_broadcast'),
      Markup.button.callback('📝 Promo Templates', 'admin_manage_templates')
    ],
    [
      Markup.button.callback('👥 Recent Users', 'admin_recent_users'),
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

      CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON broadcast_queue(status);
      CREATE INDEX IF NOT EXISTS idx_broadcast_queue_broadcast_id ON broadcast_queue(broadcast_id);
    `);

    // Seed default system configs
    const sysItems = [
      ['bot_version', 'v5.2-clean'],
      ['required_channel', '@SmartX_Discussion'],
      ['official_channel', '@SmartXEthiopia'],
      ['support_username', '@SmartXSupport'],
      ['release_date', 'መስከረም 5 (September 15)']
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
          INSERT INTO promo_templates (id, title, grade, button_text, content_html, is_active)
          VALUES (?, ?, ?, ?, ?, 1)
        `).bind(t.id, t.title, t.grade, t.button_text, t.content_html).run();
      }
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

          // Case A: User is ALREADY REGISTERED -> Show Welcome Back & Persistent Keyboard Menu
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
            [gradeButtons[2], gradeButtons[3]],
            [Markup.button.callback('🔙 ቋንቋ ቀይር / Change Language', 'back_to_language_select')]
          ]);

          return sendCleanMessage(ctx, langObj.select_grade, {
            parse_mode: 'HTML',
            ...gradeKeyboard
          });
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

          return sendCleanMessage(ctx, i18n.am.select_language, {
            parse_mode: 'HTML',
            ...langKeyboard
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

        bot.hears(/^\+?[0-9]{9,15}$/, async (ctx) => {
          if (userStates[ctx.chat.id]?.step === 'AWAITING_PHONE') {
            return handlePhoneSubmission(ctx, ctx.message.text);
          }
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
            app_notification: wantsNotify,
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

          const shareText = `${langObj.share_title}\n\n${langObj.share_desc(refCount, points, shareLink)}`;

          const shareKeyboard = Markup.inlineKeyboard([
            [Markup.button.switchToChat(langObj.share_btn, '')],
            [Markup.button.callback(langObj.back_to_menu_btn, 'nav_back_to_menu')]
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

          return sendCleanMessage(ctx, `${langObj.settings_title}\n\n${langObj.profile_card(user)}`, {
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
        bot.command(['settings', 'profile'], handleSettings);

        // --- DASHBOARD BUTTON 3: 📞 Help & Support / Contact ---
        const handleHelpAndContact = async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          const supportHandle = await getDynamicConfig(env, 'support_username', '@SmartXSupport');
          const channelHandle = await getDynamicConfig(env, 'official_channel', '@SmartXEthiopia');

          const helpKeyboard = Markup.inlineKeyboard([
            [
              Markup.button.url(langObj.contact_admin_btn, `https://t.me/${supportHandle.replace('@', '')}`),
              Markup.button.url(langObj.join_channel_btn, `https://t.me/${channelHandle.replace('@', '')}`)
            ],
            [
              Markup.button.callback(langObj.back_to_menu_btn, 'nav_back_to_menu')
            ]
          ]);

          return sendCleanMessage(ctx, `${langObj.help_title}\n\n${langObj.help_body}`, {
            parse_mode: 'HTML',
            ...helpKeyboard
          });
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

        // --- NAVIGATION BACK TO MAIN MENU ACTION ---
        bot.action('nav_back_to_menu', async (ctx) => {
          await ctx.answerCbQuery().catch(() => {});
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;
          const userName = ctx.from?.first_name || 'ተማሪ';
          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return sendCleanMessage(ctx, langObj.welcome_back(userName), {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
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
          if (registeredUsers[userId]) registeredUsers[userId].language = newLang;

          if (env.DB) {
            try {
              await env.DB.prepare('UPDATE users SET language = ? WHERE telegram_id = ?').bind(newLang, userId).run();
            } catch (e) {}
          }

          const langObj = i18n[newLang] || i18n.am;
          const mainDashboardKeyboard = Markup.keyboard(langObj.menu).resize();

          return sendCleanMessage(ctx, `✅ <b>ቋንቋ በተሳካ ሁኔታ ተቀይሯል! / Language Updated!</b>\n\n${langObj.welcome_back(ctx.from?.first_name || 'ተማሪ')}`, {
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
            [gradeButtons[2], gradeButtons[3]],
            [Markup.button.callback(langObj.back_btn, 'back_to_settings')]
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
          return sendCleanMessage(ctx, `✅ ክፍል ተቀይሯል: <b>${gradeText}</b>`, {
            parse_mode: 'HTML',
            ...mainDashboardKeyboard
          });
        });

        // Toggle app notification preference
        bot.action('settings_toggle_notify', async (ctx) => {
          const userId = ctx.from.id;
          const lang = await getUserLang(userId, env);
          const langObj = i18n[lang] || i18n.am;

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

        // --- ACTION HANDLER: User clicks '✨ አዎ! እንፈልጋለን' Button in Group ---
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

        // --- DYNAMIC INLINE QUERY HANDLER (PULLS FROM D1 PROMO TEMPLATES + SUPPORTS CUSTOM QUERY) ---
        bot.on('inline_query', async (ctx) => {
          const userId = ctx.from?.id || 0;
          const botUsername = getBotUsername(ctx, env);
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

          // 2. Add all dynamic Grade templates from Database
          templates.forEach((t) => {
            const btnLabel = t.button_text || '✨ አዎ! እንፈልጋለን';
            results.push({
              type: 'article',
              id: `template_${t.id}_${userId}`,
              title: t.title,
              description: `ለ ክፍል: ${t.grade} • መደበኛ አዝራር ያለው`,
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

        // --- ADMIN: MANAGE PROMO TEMPLATES ---
        bot.action('admin_manage_templates', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          let templates = defaultPromoTemplates;
          if (env?.DB) {
            try {
              const rows = await env.DB.prepare('SELECT id, title, grade FROM promo_templates WHERE is_active = 1 ORDER BY id ASC').all();
              if (rows?.results && rows.results.length > 0) {
                templates = rows.results;
              }
            } catch (e) {}
          }

          let text = '📝 <b>የግሩፕ መልዕክት ቴምፕሌቶች አስተዳደር:</b>\n━━━━━━━━━━━━━━━━━━━━\n';
          templates.forEach((t) => {
            text += `• <b>[ID: ${t.id}]</b> ${escapeHtml(t.title)} (ክፍል: <code>${t.grade}</code>)\n`;
          });
          text += '\nአዲስ ቴምፕሌት ለመጨመር ወይም ለማስተካከል ከታች ይምረጡ ⬇️';

          const keyboard = Markup.inlineKeyboard([
            [Markup.button.callback('➕ አዲስ ቴምፕሌት ጨምር', 'admin_add_tpl_start')],
            [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
          ]);

          return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...keyboard });
        });

        // Admin Step 1: Start Adding Template
        bot.action('admin_add_tpl_start', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          adminActionDrafts[userId] = { action: 'ADD_TEMPLATE', step: 'AWAITING_TITLE' };

          const text =
`📝 <b>ደረጃ 1 ከ 3: የቴምፕሌት ርዕስ (Title):</b>

እባክዎ በ Inline ዝርዝር ውስጥ እንዲታይ የሚፈልጉትን ርዕስ ይላኩ (ለምሳሌ: <code>📘 ለ 10ኛ ክፍል ፊዚክስ ልዩ ጥሪ</code>):`;

          const cancelKb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
          ]);

          return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...cancelKb });
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
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
          await ctx.answerCbQuery().catch(() => {});

          const selectedGrade = ctx.match[1];
          if (!adminActionDrafts[userId]) {
            adminActionDrafts[userId] = { action: 'ADD_TEMPLATE' };
          }
          adminActionDrafts[userId].grade = selectedGrade;
          adminActionDrafts[userId].step = 'AWAITING_HTML_BODY';

          const text =
`📝 <b>ደረጃ 3 ከ 3: የ HTML መልዕክት ይዘት (Message Body):</b>

• <b>ርዕስ:</b> ${escapeHtml(adminActionDrafts[userId].title || 'N/A')}
• <b>ክፍል:</b> <code>${selectedGrade}</code>

እባክዎ በግሩፕ ላይ የሚለቀቀውን ማራኪ መልዕክት በ <b>HTML ፎርማት</b> ይላኩ ⬇️
<i>(ለምሳሌ: &lt;b&gt;ወፍራም ጽሑፍ&lt;/b&gt;, &lt;i&gt;ሰያፍ&lt;/i&gt;)</i>`;

          const cancelKb = Markup.inlineKeyboard([
            [Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')]
          ]);

          return sendCleanMessage(ctx, text, { parse_mode: 'HTML', ...cancelKb });
        });

        bot.action('admin_recent_users', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });
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
                  userListText += `${i + 1}. <b>${escapeHtml(u.full_name)}</b> (${escapeHtml(u.grade)}) | <code>${escapeHtml(u.phone)}</code>\n   ⭐️ ${u.points} pts | 📅 ${new Date(u.registered_at).toLocaleDateString()}\n`;
                });
              } else {
                userListText += 'ምንም ተጠቃሚ አልተገኘም።';
              }
            } catch (e) {
              userListText += 'Error fetching users.';
            }
          }

          const backKb = Markup.inlineKeyboard([
            [Markup.button.callback('🔙 ወደ ዳሽቦርድ', 'admin_refresh_stats')]
          ]);

          return sendCleanMessage(ctx, userListText, { parse_mode: 'HTML', ...backKb });
        });

        // --- BROADCAST SYSTEM ---
        const handleNewBroadcastInit = async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.reply('⛔ Admin only!', { parse_mode: 'HTML' });

          broadcastDrafts[userId] = { step: 'AWAITING_MESSAGE' };
          return sendCleanMessage(ctx,
`📢 <b>የአዲስ ብሮድካስት መልዕክት ማዘጋጃ:</b>

እባክዎ ለሁሉም ተማሪዎች እንዲላክ የሚፈልጉትን መልዕክት (ጽሑፍ፣ ፎቶ፣ ቪዲዮ፣ ድምፅ ወይም ዶክመንት) አሁን ይላኩ ⬇️`, {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[Markup.button.callback('❌ ሰርዝ', 'admin_cancel_broadcast')]])
          });
        };

        bot.command('broadcast', handleNewBroadcastInit);
        bot.action('admin_new_broadcast', handleNewBroadcastInit);

        bot.action('admin_cancel_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          delete broadcastDrafts[userId];
          await ctx.answerCbQuery('ብሮድካስት ተሰርዟል!').catch(() => {});
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
              adminDraft.title = ctx.message.text || 'New Template';
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
                  Markup.button.callback('📚 ሁሉም ክፍሎች (All)', 'admin_tpl_grade_All')
                ],
                [
                  Markup.button.callback('❌ ሰርዝ', 'admin_cancel_draft')
                ]
              ]);

              return sendCleanMessage(ctx, `📝 <b>ደረጃ 2 ከ 3: የታለመው የክፍል ደረጃ:</b>\n\n• <b>ርዕስ:</b> ${escapeHtml(adminDraft.title)}\n\nክፍሉን ይምረጡ ⬇️`, {
                parse_mode: 'HTML',
                ...gradeKb
              });
            }

            if (adminDraft.step === 'AWAITING_HTML_BODY') {
              const htmlContent = ctx.message.text || '';
              const title = adminDraft.title;
              const grade = adminDraft.grade || 'All';

              if (env?.DB) {
                try {
                  await env.DB.prepare(`
                    INSERT INTO promo_templates (title, grade, button_text, content_html, is_active)
                    VALUES (?, ?, '✨ አዎ! እንፈልጋለን', ?, 1)
                  `).bind(title, grade, htmlContent).run();

                  delete adminActionDrafts[userId];

                  return sendCleanMessage(ctx,
`✅ <b>አዲስ የመልዕክት ቴምፕሌት በተሳካ ሁኔታ ተጨምሯል!</b> 🎉

• <b>ርዕስ:</b> ${escapeHtml(title)}
• <b>ክፍል:</b> <code>${grade}</code>
• <b>የአዝራር ስም:</b> <code>✨ አዎ! እንፈልጋለን</code>

አሁን ማንኛውም ተማሪ ወይም አድሚን በቴሌግራም ግሩፖች ውስጥ <b>@${getBotUsername(ctx, env)}</b> ብሎ ሲጽፍ ይህንን መልዕክት በቀጥታ መላክ ይችላል!`, {
                    parse_mode: 'HTML',
                    ...Markup.inlineKeyboard([[Markup.button.callback('📝 ወደ ቴምፕሌቶች ዝርዝር', 'admin_manage_templates')]])
                  });
                } catch (err) {
                  return sendCleanMessage(ctx, `❌ Failed to save template: ${err.message}`);
                }
              }

              delete adminActionDrafts[userId];
              return sendCleanMessage(ctx, '✅ Template created (Local Simulator Mode).');
            }
          }

          // Flow 2: Admin Broadcast
          if (draft && draft.step === 'AWAITING_MESSAGE' && isAdmin(userId, env)) {
            const payload = extractMessagePayload(ctx.message);
            draft.payload = payload;
            draft.step = 'CONFIRMATION';

            const previewText =
`📢 <b>የብሮድካስት ማረጋገጫ:</b>

• <b>አይነት:</b> <code>${payload.type}</code>
• <b>ጽሑፍ/መግለጫ:</b> ${escapeHtml(payload.text || payload.caption || '(None)')}

መልዕክቱ ለሁሉም ተጠቃሚዎች ወዲያውኑ ይላክ?`;

            const confirmKb = Markup.inlineKeyboard([
              [
                Markup.button.callback('🚀 አዎ፣ አሁን ላክ (Send Now)', 'admin_confirm_send_broadcast'),
                Markup.button.callback('❌ ሰርዝ', 'admin_cancel_broadcast')
              ]
            ]);

            return sendCleanMessage(ctx, previewText, { parse_mode: 'HTML', ...confirmKb });
          }

          return next();
        });

        bot.action('admin_confirm_send_broadcast', async (ctx) => {
          const userId = ctx.from.id;
          if (!isAdmin(userId, env)) return ctx.answerCbQuery('⛔ Admin only!', { show_alert: true });

          const draft = broadcastDrafts[userId];
          if (!draft || !draft.payload) {
            return ctx.answerCbQuery('⚠️ No active broadcast found!', { show_alert: true });
          }

          await ctx.answerCbQuery('ብሮድካስት እየተዘጋጀ ነው...').catch(() => {});
          const payloadJson = JSON.stringify(draft.payload);

          let totalRecipients = 0;
          if (env.DB) {
            try {
              const countRow = await env.DB.prepare('SELECT COUNT(*) as total FROM users WHERE is_active = 1').first();
              totalRecipients = countRow?.total || 0;

              const insRes = await env.DB.prepare(`
                INSERT INTO broadcasts (admin_id, message_type, payload_json, total_recipients, pending_count, status)
                VALUES (?, ?, ?, ?, ?, 'processing')
              `).bind(userId, draft.payload.type, payloadJson, totalRecipients, totalRecipients).run();

              const broadcastId = insRes.meta.last_row_id;

              await env.DB.prepare(`
                INSERT INTO broadcast_queue (broadcast_id, telegram_id, status)
                SELECT ?, telegram_id, 'pending'
                FROM users
                WHERE is_active = 1
              `).bind(broadcastId).run();

              delete broadcastDrafts[userId];

              // Immediately process first batch
              await processBroadcastQueueBatch(bot, env, 30);

              return sendCleanMessage(ctx,
`✅ <b>ብሮድካስት በተሳካ ሁኔታ ተጀምሯል!</b> 🚀

• 👥 <b>ጠቅላላ ተቀባዮች:</b> <code>${totalRecipients}</code>
• ⚙️ መልዕክቶች በሰከንዶች ውስጥ በባች ይላካሉ!`, {
                parse_mode: 'HTML',
                ...Markup.inlineKeyboard([[Markup.button.callback('📊 ወደ ዳሽቦርድ', 'admin_refresh_stats')]])
              });
            } catch (err) {
              console.error('Broadcast Dispatch Error:', err);
              return sendCleanMessage(ctx, `❌ Failed to dispatch broadcast: ${err.message}`);
            }
          }

          delete broadcastDrafts[userId];
          return sendCleanMessage(ctx, '⚠️ Local simulator mode: broadcast queue mock dispatched.');
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
        version: '5.2.0',
        release_date: 'መስከረም 5 (September 15)',
        features: [
          'Dynamic Promo Templates & Admin HTML Builder',
          'Persistent Menu Keyboard',
          'Help & Contact',
          'Settings & Back Navigation',
          '5 Diagnostic Questions',
          'Multi-language (AM/EN/OM)',
          'Cloudflare D1 Batch Broadcasts'
        ]
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
