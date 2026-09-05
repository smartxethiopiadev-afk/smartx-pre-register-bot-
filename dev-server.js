import express from 'express';
import dotenv from 'dotenv';
import { Telegraf, Telegram } from 'telegraf';
import worker from './worker.js';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.text());

// Webhook endpoint (forward to worker)
app.all('/webhook', async (req, res) => {
  await forwardToWorker(req, res);
});

// Register webhook endpoint (forward to worker)
app.all('/register', async (req, res) => {
  await forwardToWorker(req, res);
});

// In-Memory Cloudflare D1 Mock for Local Dev Server
class LocalD1DatabaseMock {
  constructor() {
    this.tables = {
      users: new Map([
        [12345678, { telegram_id: 12345678, full_name: 'Admin / Student', phone: '+251912345678', grade: 'Grade 10', stream: 'Natural Science', language: 'am', referred_by: null, referral_count: 3, points: 30, is_vip: 0, is_active: 1, registered_at: new Date().toISOString() }],
        [98765432, { telegram_id: 98765432, full_name: 'Abebe Bikila', phone: '+251987654321', grade: 'Grade 12', stream: 'Natural Science', language: 'am', referred_by: 12345678, referral_count: 5, points: 50, is_vip: 1, is_active: 1, registered_at: new Date().toISOString() }],
        [55555555, { telegram_id: 55555555, full_name: 'Chala Gemechu', phone: '+251955555555', grade: 'Grade 11', stream: 'Social Science', language: 'om', referred_by: 12345678, referral_count: 1, points: 10, is_vip: 0, is_active: 1, registered_at: new Date().toISOString() }]
      ]),
      broadcasts: [],
      broadcast_queue: [],
      channel_polls: [],
      promo_templates: [
        { id: 1, title: '📚 ለ 9-12ኛ ክፍል አጠቃላይ', grade: 'All', button_text: '✨ አዎ! እንፈልጋለን', content_html: '✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹\n\nየትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?', is_active: 1 },
        { id: 2, title: '📗 ለ 9ኛ ክፍል ተማሪዎች', grade: '9', button_text: '📚 የ 9ኛ ክፍል ማጠቃለያ አግኝ', content_html: '📚 <b>ለ 9ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹\n\nየትምህርት ውጤታችሁን ለማሻሻል አጋዥ <b>Short Note</b> እና <b>Worksheet</b> ማግኘት ትፈልጋላችሁ?', is_active: 1 },
        { id: 3, title: '📘 ለ 10ኛ ክፍል ተማሪዎች', grade: '10', button_text: '🎯 የ 10ኛ ክፍል Worksheet አግኝ', content_html: '🎯 <b>ለ 10ኛ ክፍል ተማሪዎች የተዘጋጀ ልዩ አጋዥ!</b> 🇪🇹\n\nለፈተና በብቃት ለመዘጋጀት የሁሉንም ትምህርቶች <b>Short Notes</b> እና <b>Model Worksheets</b> ይፈልጋሉ?', is_active: 1 },
        { id: 4, title: '📙 ለ 11ኛ ክፍል ተማሪዎች', grade: '11', button_text: '💡 የ 11ኛ ክፍል ጥያቄዎች አግኝ', content_html: '💡 <b>ለ 11ኛ ክፍል Natural እና Social Science ተማሪዎች!</b> 🇪🇹\n\nየከበዷችሁን የትምህርት ምዕራፎች በቀላሉ ለመረዳት አጋዥ <b>Short Notes</b> እና <b>Worksheets</b> ማግኘት ትፈልጋላችሁ?', is_active: 1 },
        { id: 5, title: '🎓 ለ 12ኛ ክፍል ተማሪዎች', grade: '12', button_text: '🏆 የ 12ኛ ክፍል Model Exam አግኝ', content_html: '🏆 <b>ለ 12ኛ ክፍል የዩኒቨርሲቲ መግቢያ ፈተና ተፈታኞች!</b> 🇪🇹\n\nለብሔራዊ ፈተና ከፍተኛ ውጤት ለማምጣት አጋዥ <b>Short Notes</b> እና <b>Model Exams</b> ይፈልጋሉ?', is_active: 1 }
      ],
      app_info: new Map([
        ['app_name', 'Smart X Ethiopian (Smart X ET)'],
        ['release_date', 'መስከረም 5, 2019 EC (September 2026)'],
        ['developer', 'HAB IT Solutions'],
        ['status', 'Pre-Registration Active'],
        ['download_status', 'Coming Soon on መስከረም 5'],
        ['pricing_and_plans', 'Free Tier & VIP Pass (150 ETB/mo)'],
        ['features', '10,000+ Quizzes, Summaries, Offline AI Tutor'],
        ['official_channel', '@SmartXEthiopia'],
        ['discussion_group', '@SmartX_Ethio'],
        ['poll_channel', '@SmartX_Discussion'],
        ['poll_group', '@SmartX_Ethio']
      ]),
      system_config: new Map([
        ['bot_status', 'Operational'],
        ['required_channel', '@SmartX_Discussion'],
        ['official_channel', '@SmartXEthiopia'],
        ['discussion_group', '@SmartX_Ethio'],
        ['poll_channel', '@SmartX_Discussion'],
        ['poll_group', '@SmartX_Ethio'],
        ['bot_version', 'v3.0-enterprise'],
        ['ai_engine', 'Gemini 3.6 Flash Multi-Model'],
        ['ai_system_prompt', `You are Smart X AI, an expert tutor designed for Ethiopian secondary school students (Grades 9-12).

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
   - Keep answers well-structured and direct.`],
        ['maintenance_mode', 'false']
      ]),
      ai_chats: []
    };
  }

  async exec(sql) {
    return { count: 0, duration: 1 };
  }

  prepare(sql) {
    const self = this;
    let boundParams = [];

    const stmt = {
      bind(...args) {
        boundParams = args;
        return stmt;
      },
      async first() {
        const res = await stmt.all();
        return res.results && res.results.length > 0 ? res.results[0] : null;
      },
      async all() {
        const lowerSql = sql.toLowerCase();

        if (lowerSql.includes('select count(*) as cnt from app_info')) {
          return { results: [{ cnt: self.tables.app_info.size }] };
        }

        if (lowerSql.includes('select value from app_info where key = ?')) {
          const key = boundParams[0];
          const val = self.tables.app_info.get(key);
          return { results: val ? [{ value: val }] : [] };
        }

        if (lowerSql.includes('select value from system_config where key = ?')) {
          const key = boundParams[0];
          const val = self.tables.system_config.get(key);
          return { results: val ? [{ value: val }] : [] };
        }

        if (lowerSql.includes('select count(*) as total, sum(') || lowerSql.includes('select count(*) as total from users') || (lowerSql.includes('select count(*)') && lowerSql.includes('from users'))) {
          const allUsers = Array.from(self.tables.users.values());
          const total = allUsers.length;
          const active = allUsers.filter(u => u.is_active !== 0).length;
          const inactive = allUsers.filter(u => u.is_active === 0 || u.is_blocked === 1).length;
          const total_refs = allUsers.reduce((sum, u) => sum + (u.referral_count || 0), 0);
          return { results: [{ total, active, inactive, total_refs }] };
        }

        if (lowerSql.includes('select grade, count(*) as count from users group by grade')) {
          const counts = {};
          for (const u of self.tables.users.values()) {
            if (u.grade) counts[u.grade] = (counts[u.grade] || 0) + 1;
          }
          const results = Object.entries(counts).map(([grade, count]) => ({ grade, count }));
          return { results };
        }

        if (lowerSql.includes('select language, count(*) as count from users group by language')) {
          const counts = {};
          for (const u of self.tables.users.values()) {
            if (u.language) counts[u.language] = (counts[u.language] || 0) + 1;
          }
          const results = Object.entries(counts).map(([language, count]) => ({ language, count }));
          return { results };
        }

        if (lowerSql.includes('select count(*) as total_chats from ai_chats')) {
          return { results: [{ total_chats: self.tables.ai_chats.length }] };
        }

        if (lowerSql.includes('select count(*) as total_bcasts from broadcasts')) {
          return { results: [{ total_bcasts: self.tables.broadcasts.length }] };
        }

        if (lowerSql.includes('select language from users')) {
          const userId = boundParams[0];
          const user = self.tables.users.get(userId);
          return { results: user ? [{ language: user.language }] : [] };
        }

        if (lowerSql.includes('select referral_count, points, is_vip from users where telegram_id = ?') || lowerSql.includes('select full_name, referral_count, points, is_vip from users where telegram_id = ?') || lowerSql.includes('select * from users where telegram_id = ?')) {
          const userId = boundParams[0];
          const user = self.tables.users.get(userId);
          return { results: user ? [user] : [] };
        }

        if (lowerSql.includes('select telegram_id, full_name, phone, grade')) {
          const usersList = Array.from(self.tables.users.values()).slice(0, 10);
          return { results: usersList };
        }

        if (lowerSql.includes('select telegram_id from users')) {
          const activeUsers = Array.from(self.tables.users.values())
            .filter(u => u.is_active !== 0)
            .map(u => ({ telegram_id: u.telegram_id }));
          return { results: activeUsers };
        }

        if (lowerSql.includes('select key, value from app_info')) {
          const rows = Array.from(self.tables.app_info.entries()).map(([k, v]) => ({ key: k, value: v }));
          return { results: rows };
        }

        if (lowerSql.includes('select key, value from system_config')) {
          const rows = Array.from(self.tables.system_config.entries()).map(([k, v]) => ({ key: k, value: v }));
          return { results: rows };
        }

        if (lowerSql.includes('select count(*) as cnt from promo_templates')) {
          return { results: [{ cnt: self.tables.promo_templates.filter(t => t.is_active !== 0).length }] };
        }

        if (lowerSql.includes('from channel_polls') || lowerSql.includes('channel_polls')) {
          if (lowerSql.includes('count(*)')) {
            return { results: [{ cnt: self.tables.channel_polls.length }] };
          }
          return { results: self.tables.channel_polls };
        }

        if (lowerSql.includes('from promo_templates where id = ?') || lowerSql.includes('select * from promo_templates where id = ?')) {
          const tplId = boundParams[0];
          const tpl = self.tables.promo_templates.find(item => item.id === tplId);
          return { results: tpl ? [tpl] : [] };
        }

        if (lowerSql.includes('from promo_templates')) {
          return { results: self.tables.promo_templates.filter(t => t.is_active !== 0) };
        }

        if (lowerSql.includes('select pending_count from broadcasts where id = ?')) {
          const bId = boundParams[0];
          const b = self.tables.broadcasts.find(item => item.id === bId);
          return { results: b ? [{ pending_count: b.pending_count }] : [{ pending_count: 0 }] };
        }

        if (lowerSql.includes('select * from broadcasts where id = ?') || lowerSql.includes('from broadcasts where id = ?')) {
          const bId = boundParams[0];
          const b = self.tables.broadcasts.find(item => item.id === bId);
          return { results: b ? [b] : [] };
        }

        if (lowerSql.includes('select * from broadcasts')) {
          return { results: self.tables.broadcasts.slice(-1) };
        }

        if (lowerSql.includes('broadcast_queue')) {
          const pending = self.tables.broadcast_queue.filter(q => q.status === 'pending');
          const limit = typeof boundParams[0] === 'number' ? boundParams[0] : 20;
          const results = pending.slice(0, limit).map(q => {
            const b = self.tables.broadcasts.find(bcast => bcast.id === q.broadcast_id) || self.tables.broadcasts[self.tables.broadcasts.length - 1];
            return {
              id: q.id,
              broadcast_id: q.broadcast_id,
              telegram_id: q.telegram_id,
              payload_json: b ? b.payload_json : '{"type":"text","text":"Notification"}'
            };
          });
          return { results };
        }

        if (lowerSql.includes('select * from ai_chats')) {
          return { results: self.tables.ai_chats };
        }

        return { results: [] };
      },
      async run() {
        const lowerSql = sql.toLowerCase();

        if (lowerSql.includes('insert into users') || lowerSql.includes('on conflict(telegram_id)')) {
          const [id, name, phone, grade, stream, lang, refBy] = boundParams;
          const existing = self.tables.users.get(id) || {};
          self.tables.users.set(id, {
            ...existing,
            telegram_id: id,
            full_name: name || existing.full_name || 'Pending',
            phone: phone || existing.phone || 'Pending',
            grade: grade || existing.grade || 'Grade 10',
            stream: stream || existing.stream || 'General',
            language: lang || existing.language || 'am',
            referred_by: refBy !== undefined ? refBy : existing.referred_by,
            referral_count: existing.referral_count || 0,
            points: existing.points || 0,
            is_vip: existing.is_vip || 0,
            is_active: 1,
            registered_at: existing.registered_at || new Date().toISOString()
          });
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('update users set referral_count')) {
          const targetId = boundParams[0];
          const user = self.tables.users.get(targetId);
          if (user) {
            user.referral_count = (user.referral_count || 0) + 1;
            user.points = (user.points || 0) + 10;
            if (user.referral_count >= 5) user.is_vip = 1;
          }
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('update users set is_active = 0') || lowerSql.includes('update users set is_blocked = 1')) {
          const targetId = boundParams[0];
          const user = self.tables.users.get(targetId);
          if (user) {
            user.is_active = 0;
            user.is_blocked = 1;
          }
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('delete from users where telegram_id = ?')) {
          const targetId = boundParams[0];
          self.tables.users.delete(targetId);
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('insert into promo_templates')) {
          const [title, grade, btnText, htmlContent] = boundParams;
          const newId = self.tables.promo_templates.length + 1;
          self.tables.promo_templates.push({
            id: newId,
            title: title || 'Promo',
            grade: grade || 'All',
            button_text: btnText || '✨ አዎ! እንፈልጋለን',
            content_html: htmlContent || '',
            is_active: 1
          });
          return { meta: { changes: 1, last_row_id: newId } };
        }

        if (lowerSql.includes('insert into app_info')) {
          const [key, val] = boundParams;
          self.tables.app_info.set(key, val);
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('insert into channel_polls')) {
          const [adminId, title, question, optionsJson, correctOptionId, explanation, targetDest, chanH, grpH, pollId, sentStatus] = boundParams;
          const pollItem = {
            id: self.tables.channel_polls.length + 1,
            admin_id: adminId,
            title: title || 'Academic Quiz',
            question,
            options_json: optionsJson,
            correct_option_id: correctOptionId || 0,
            explanation: explanation || '',
            target_destination: targetDest || 'both',
            channel_handle: chanH || '@SmartX_Discussion',
            group_handle: grpH || '@SmartX_Ethio',
            telegram_poll_id: pollId || 'poll_' + Date.now(),
            sent_status: sentStatus || 'sent',
            created_at: new Date().toISOString()
          };
          self.tables.channel_polls.push(pollItem);
          return { meta: { changes: 1, last_row_id: pollItem.id } };
        }

        if (lowerSql.includes('insert into system_config')) {
          const [key, val] = boundParams;
          self.tables.system_config.set(key, val);
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('insert into ai_chats')) {
          let telegramId, userMsg, botResp, prompt, resp, lang, modelUsed;
          if (boundParams.length >= 7) {
            [telegramId, userMsg, botResp, prompt, resp, lang, modelUsed] = boundParams;
          } else if (boundParams.length === 4) {
            [telegramId, userMsg, botResp, modelUsed] = boundParams;
          } else {
            [telegramId, prompt, resp, lang, modelUsed] = boundParams;
          }

          const chatRecord = {
            id: self.tables.ai_chats.length + 1,
            telegram_id: telegramId,
            user_message: userMsg || prompt || '',
            bot_response: botResp || resp || '',
            prompt: prompt || userMsg || '',
            response: resp || botResp || '',
            language: lang || 'am',
            model_used: modelUsed || 'gemini-3.6-flash',
            created_at: new Date().toISOString()
          };
          self.tables.ai_chats.push(chatRecord);
          return { meta: { changes: 1, last_row_id: chatRecord.id } };
        }

        if (lowerSql.includes('insert into broadcasts')) {
          let adminId, msgType, payloadJson, targetGrade, total, pending;
          if (boundParams.length >= 6) {
            [adminId, msgType, payloadJson, targetGrade, total, pending] = boundParams;
          } else {
            [adminId, msgType, payloadJson, total, pending] = boundParams;
            targetGrade = 'All';
          }
          const bObj = {
            id: self.tables.broadcasts.length + 1,
            admin_id: adminId,
            message_type: msgType,
            payload_json: payloadJson,
            target_grade: targetGrade || 'All',
            total_recipients: total,
            sent_count: 0,
            failed_count: 0,
            blocked_count: 0,
            pending_count: pending,
            status: 'processing'
          };
          self.tables.broadcasts.push(bObj);
          return { meta: { changes: 1, last_row_id: bObj.id } };
        }

        if (lowerSql.includes('insert into broadcast_queue') && lowerSql.includes('select')) {
          const bId = boundParams[0];
          const allActive = Array.from(self.tables.users.values()).filter(u => u.is_active !== 0);
          for (const u of allActive) {
            self.tables.broadcast_queue.push({
              id: self.tables.broadcast_queue.length + 1,
              broadcast_id: bId,
              telegram_id: u.telegram_id,
              status: 'pending',
              attempts: 0
            });
          }
          return { meta: { changes: allActive.length } };
        }

        if (lowerSql.includes('insert into broadcast_queue')) {
          const [bId, tgId] = boundParams;
          self.tables.broadcast_queue.push({
            id: self.tables.broadcast_queue.length + 1,
            broadcast_id: bId,
            telegram_id: tgId,
            status: 'pending',
            attempts: 0
          });
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('update broadcast_queue set status =')) {
          const qId = boundParams[boundParams.length - 1];
          const qItem = self.tables.broadcast_queue.find(item => item.id === qId);
          if (qItem) {
            if (lowerSql.includes("status = 'sent'")) qItem.status = 'sent';
            if (lowerSql.includes("status = 'blocked'")) qItem.status = 'blocked';
            if (lowerSql.includes("status = 'failed'")) qItem.status = 'failed';
          }
          return { meta: { changes: 1 } };
        }

        if (lowerSql.includes('update broadcasts')) {
          const bId = boundParams[boundParams.length - 1];
          const b = self.tables.broadcasts.find(item => item.id === bId);
          if (b) {
            if (lowerSql.includes('sent_count = sent_count + 1')) b.sent_count = (b.sent_count || 0) + 1;
            if (lowerSql.includes('blocked_count = blocked_count + 1')) b.blocked_count = (b.blocked_count || 0) + 1;
            if (lowerSql.includes('failed_count = failed_count + 1')) b.failed_count = (b.failed_count || 0) + 1;
            if (lowerSql.includes('pending_count = max(0, pending_count - 1)')) b.pending_count = Math.max(0, (b.pending_count || 1) - 1);
            if (lowerSql.includes("status = 'completed'")) b.status = 'completed';
          }
          return { meta: { changes: 1 } };
        }

        return { meta: { changes: 1 } };
      }
    };

    return stmt;
  }

  async batch(statements) {
    for (const stmt of statements) {
      await stmt.run();
    }
    return [];
  }
}

const mockD1 = new LocalD1DatabaseMock();

function getWorkerEnv() {
  return {
    TELEGRAM_BOT_TOKEN: process.env.TELEGRAM_BOT_TOKEN || 'SIMULATOR_DUMMY_TOKEN_123456',
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_API_KEYS: process.env.GEMINI_API_KEYS,
    BROADCAST_ADMIN_ID: process.env.BROADCAST_ADMIN_ID || '12345678',
    DB: mockD1
  };
}

// Simulator API endpoint for in-browser testing
app.post('/api/simulate', async (req, res) => {
  const capturedResponses = [];

  // Hook Telegram.prototype.callApi for this simulation request
  const originalCallApi = Telegram.prototype.callApi;
  Telegram.prototype.callApi = async function (method, data) {
    if (method === 'getMe') {
      return {
        ok: true,
        result: {
          id: 777888999,
          is_bot: true,
          first_name: 'Smart X Ethiopian Bot',
          username: 'SmartX_PreRegister_bot'
        }
      };
    }

    capturedResponses.push({ method, data });

    if (method === 'sendMessage') {
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 100000),
          date: Math.floor(Date.now() / 1000),
          chat: { id: data.chat_id, type: 'private' },
          text: data.text,
          reply_markup: data.reply_markup
        }
      };
    }
    if (method === 'editMessageText') {
      return {
        ok: true,
        result: {
          message_id: data.message_id || Math.floor(Math.random() * 100000),
          date: Math.floor(Date.now() / 1000),
          chat: { id: data.chat_id, type: 'private' },
          text: data.text,
          reply_markup: data.reply_markup
        }
      };
    }
    if (method === 'editMessageReplyMarkup') {
      return {
        ok: true,
        result: {
          message_id: data.message_id || Math.floor(Math.random() * 100000),
          date: Math.floor(Date.now() / 1000),
          chat: { id: data.chat_id, type: 'private' },
          reply_markup: data.reply_markup
        }
      };
    }
    if (method === 'answerCallbackQuery') {
      return { ok: true, result: true };
    }
    if (method === 'getChatMember') {
      return {
        ok: true,
        result: {
          status: 'member',
          user: { id: data.user_id || 12345678, is_bot: false, first_name: 'የሙከራ ተማሪ' }
        }
      };
    }
    if (method === 'sendPoll') {
      const pollId = 'poll_' + Math.floor(Math.random() * 100000);
      return {
        ok: true,
        result: {
          message_id: Math.floor(Math.random() * 100000),
          date: Math.floor(Date.now() / 1000),
          chat: { id: data.chat_id, type: String(data.chat_id).startsWith('@') ? 'channel' : 'private' },
          poll: {
            id: pollId,
            question: data.question,
            options: (data.options || []).map((opt) => ({ text: typeof opt === 'string' ? opt : opt.text, voter_count: 0 })),
            total_voter_count: 0,
            is_closed: false,
            is_anonymous: data.is_anonymous !== false,
            type: data.type || 'quiz',
            correct_option_id: data.correct_option_id !== undefined ? data.correct_option_id : 0,
            explanation: data.explanation || ''
          }
        }
      };
    }

    return { ok: true, result: {} };
  };

  try {
    const env = getWorkerEnv();

    const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
    const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
    const fullUrl = `${protocol}://${host}/webhook`;

    const webReq = new Request(fullUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    await worker.fetch(webReq, env);

    res.json({
      ok: true,
      responses: capturedResponses
    });
  } catch (err) {
    console.error('Simulation error:', err);
    res.status(500).json({ ok: false, error: err.message });
  } finally {
    Telegram.prototype.callApi = originalCallApi;
  }
});

// Helper function to forward request to Cloudflare worker handler
async function forwardToWorker(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const fullUrl = `${protocol}://${host}${req.originalUrl}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        value.forEach(v => headers.append(key, v));
      } else {
        headers.set(key, value);
      }
    }
  }

  let body = undefined;
  if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
    body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  }

  const webReq = new Request(fullUrl, {
    method: req.method,
    headers: headers,
    body: body
  });

  const env = getWorkerEnv();

  try {
    const webRes = await worker.fetch(webReq, env);
    res.status(webRes.status);
    webRes.headers.forEach((val, key) => {
      res.setHeader(key, val);
    });
    const text = await webRes.text();
    res.send(text);
  } catch (err) {
    console.error('Worker error:', err);
    res.status(500).send('Worker Error: ' + err.message);
  }
}

// API Endpoint to fetch promo templates
app.get('/api/templates', (req, res) => {
  res.json({ ok: true, templates: mockD1.tables.promo_templates });
});

// API Endpoint to save or update promo template
app.post('/api/templates', (req, res) => {
  const { id, title, grade, button_text, content_html } = req.body;
  if (id) {
    const existing = mockD1.tables.promo_templates.find(t => t.id === parseInt(id, 10));
    if (existing) {
      existing.title = title || existing.title;
      existing.grade = grade || existing.grade;
      existing.button_text = button_text || existing.button_text;
      existing.content_html = content_html || existing.content_html;
      return res.json({ ok: true, message: 'Template updated successfully', template: existing });
    }
  }

  const newId = mockD1.tables.promo_templates.length + 1;
  const newTpl = {
    id: newId,
    title: title || 'አዲስ ቴምፕሌት',
    grade: grade || 'All',
    button_text: button_text || '✨ አዎ! እንፈልጋለን',
    content_html: content_html || '<b>አዲስ የመልዕክት ይዘት...</b>',
    is_active: 1
  };
  mockD1.tables.promo_templates.push(newTpl);
  res.json({ ok: true, message: 'Template created successfully', template: newTpl });
});

// Interactive Dashboard & Chat Simulator at GET /
app.get('/', (req, res) => {
  const tokenSet = Boolean(process.env.TELEGRAM_BOT_TOKEN);
  const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || `localhost:${PORT}`;
  const webhookUrl = `${protocol}://${host}/webhook`;

  const html = `<!DOCTYPE html>
<html lang="am" class="h-full bg-slate-900 text-slate-100">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SmartX Telegram Bot - Dashboard & Simulator</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+Ethiopic:wght@400;500;600;700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body { font-family: 'Plus Jakarta Sans', 'Noto Sans Ethiopic', sans-serif; }
    .chat-bg { background-color: #0f172a; background-image: radial-gradient(#1e293b 1px, transparent 1px); background-size: 16px 16px; }
  </style>
</head>
<body class="h-full flex flex-col antialiased">
  <!-- Top Navigation Header -->
  <header class="border-b border-slate-800 bg-slate-950/80 backdrop-blur shrink-0 px-6 py-4 flex items-center justify-between">
    <div class="flex items-center space-x-3">
      <div class="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 font-bold text-lg">
        🤖
      </div>
      <div>
        <h1 class="text-base font-semibold text-slate-100">Smart X Ethiopian (Smart X ET) Bot</h1>
        <p class="text-xs text-slate-400">By HAB IT Solutions • Grade 9-12 Quiz & Course Summary Assistant</p>
      </div>
    </div>
    <div class="flex items-center space-x-3">
      <span class="inline-flex items-center gap-x-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${tokenSet ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}">
        <span class="w-1.5 h-1.5 rounded-full ${tokenSet ? 'bg-emerald-400' : 'bg-amber-400'}"></span>
        ${tokenSet ? 'Telegram Token Connected' : 'Simulator Mode (Token Optional)'}
      </span>
      <a href="/register" target="_blank" class="px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition">
        Register Webhook
      </a>
    </div>
  </header>

  <!-- Main Container -->
  <main class="flex-1 max-w-7xl w-full mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 overflow-hidden">
    <!-- Left Column: Bot Details & Webhook Info -->
    <div class="lg:col-span-5 flex flex-col space-y-6 overflow-y-auto pr-1">
      <!-- Status Card -->
      <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 class="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>⚡</span> Service Status
        </h2>
        <div class="space-y-3 text-xs">
          <div class="flex justify-between items-center py-1.5 border-b border-slate-800/80">
            <span class="text-slate-400">Environment</span>
            <span class="font-mono text-slate-200">Cloud Run / Node.js 22</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-slate-800/80">
            <span class="text-slate-400">Port</span>
            <span class="font-mono text-slate-200">3000 (0.0.0.0)</span>
          </div>
          <div class="flex justify-between items-center py-1.5 border-b border-slate-800/80">
            <span class="text-slate-400">Webhook URL</span>
            <span class="font-mono text-cyan-400 truncate max-w-[200px]" title="${webhookUrl}">${webhookUrl}</span>
          </div>
          <div class="flex justify-between items-center py-1.5">
            <span class="text-slate-400">Cloudflare Worker file</span>
            <span class="font-mono text-slate-200">worker.js</span>
          </div>
        </div>
      </div>

      <!-- Quick Actions & Instructions -->
      <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <h2 class="text-sm font-semibold text-slate-200 flex items-center gap-2">
          <span>📚</span> Bot Features & Usage
        </h2>
        <p class="text-xs text-slate-400 leading-relaxed">
          ቦቱ በ HAB IT Solutions የተገነባ ሲሆን ለአዲሱ የኢትዮጵያ የስርዓተ-ትምህርት (Grade 9-12) የ Quiz እና የትምህርት ማጠቃለያ አፕሊኬሽን (በሴፕቴምበር 2026 የሚለቀቅ) ቅድመ-ምዝገባ ረዳት ነው።
        </p>
        <div class="space-y-2">
          <label class="text-xs font-medium text-slate-300">Quick Test Trigger</label>
          <div class="grid grid-cols-2 gap-2">
            <button onclick="sendQuickMessage('/start')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition font-mono">
              /start (መጀመሪያ)
            </button>
            <button onclick="sendQuickMessage('🔗 ለጓደኞች አጋራ')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition">
              🔗 ለጓደኞች አጋራ
            </button>
            <button onclick="sendQuickMessage('⚙️ ቅንብሮች')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition">
              ⚙️ ቅንብሮች
            </button>
            <button onclick="sendQuickMessage('📞 እገዛ እና ግንኙነት')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition">
              📞 እገዛ እና ግንኙነት
            </button>
            <button onclick="sendQuickMessage('/admin')" class="px-3 py-2 text-xs bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 rounded-lg text-cyan-200 text-left transition font-mono">
              👑 /admin (Dashboard)
            </button>
            <button onclick="sendQuickMessage('/broadcast')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition font-mono">
              📢 /broadcast (Admin)
            </button>
            <button onclick="sendQuickMessage('/quiz')" class="px-3 py-2 text-xs bg-amber-950/60 hover:bg-amber-900/60 border border-amber-700/60 rounded-lg text-amber-200 text-left transition font-mono">
              🎯 /quiz (Interactive)
            </button>
            <button onclick="sendQuickMessage('/quiz 10ኛ ክፍል ፊዚክስ motion')" class="px-3 py-2 text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-slate-200 text-left transition font-mono truncate" title="/quiz 10ኛ ክፍል ፊዚክስ motion">
              ⚡ /quiz 10ኛ ፊዚክስ
            </button>
          </div>
        </div>
      </div>

      <!-- Configuration Guide -->
      <div class="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-5 text-xs space-y-2">
        <h3 class="font-medium text-slate-300">💡 Connect Real Telegram Bot</h3>
        <p class="text-slate-400">
          To connect a live Telegram Bot, set <code class="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded">TELEGRAM_BOT_TOKEN</code> in your environment or <code class="text-cyan-400 bg-slate-900 px-1 py-0.5 rounded">.env</code> file, then click <strong class="text-slate-200">Register Webhook</strong>.
        </p>
      </div>

      <!-- Group Button Customizer & SQL Generator Form -->
      <div class="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-sm font-semibold text-slate-200 flex items-center gap-2">
            <span>🔘</span> Group Button & Promo Customizer
          </h2>
          <span class="text-[10px] text-cyan-400 bg-cyan-950 border border-cyan-800 px-2 py-0.5 rounded-full">HTML & SQL Form</span>
        </div>

        <form id="templateForm" onsubmit="handleSaveTemplate(event)" class="space-y-3 text-xs">
          <div>
            <label class="block text-slate-400 mb-1">Select Template to Edit</label>
            <select id="tplSelect" onchange="loadSelectedTemplate()" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500">
              <option value="new">+ Create New Template</option>
              <option value="1" selected>1. 📚 ለ 9-12ኛ ክፍል አጠቃላይ (Grade: All)</option>
              <option value="2">2. 📗 ለ 9ኛ ክፍል ተማሪዎች (Grade: 9)</option>
              <option value="3">3. 📘 ለ 10ኛ ክፍል ተማሪዎች (Grade: 10)</option>
              <option value="4">4. 📙 ለ 11ኛ ክፍል ተማሪዎች (Grade: 11)</option>
              <option value="5">5. 🎓 ለ 12ኛ ክፍል ተማሪዎች (Grade: 12)</option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-slate-400 mb-1">Inline Title</label>
              <input type="text" id="tplTitle" value="📚 ለ 9-12ኛ ክፍል አጠቃላይ" placeholder="e.g. 📘 ለ 10ኛ ክፍል ጥያቄዎች" required class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"/>
            </div>
            <div>
              <label class="block text-slate-400 mb-1">Target Grade</label>
              <select id="tplGrade" class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500">
                <option value="All" selected>All (9-12)</option>
                <option value="9">Grade 9</option>
                <option value="10">Grade 10</option>
                <option value="11">Grade 11</option>
                <option value="12">Grade 12</option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-cyan-400 font-medium mb-1">🔘 Button Label (ከስር የሚመጣው የአዝራር ስም)</label>
            <input type="text" id="tplBtnText" value="✨ አዎ! እንፈልጋለን" placeholder="e.g. ✨ አዎ! እንፈልጋለን or 📚 የ 10ኛ ክፍል Worksheet አግኝ" required class="w-full bg-slate-900 border border-cyan-800/80 rounded-lg px-3 py-2 text-slate-100 font-medium focus:outline-none focus:border-cyan-400"/>
          </div>

          <div>
            <label class="block text-slate-400 mb-1">Message HTML Content</label>
            <textarea id="tplContentHtml" rows="3" required class="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono text-[11px] focus:outline-none focus:border-cyan-500">✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹

የትምህርት ውጤታችሁን ለማሻሻል አጋዥ Short Note እና Worksheet ማግኘት ትፈልጋላችሁ?

የሁሉንም ትምህርቶች ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!</textarea>
          </div>

          <div class="flex gap-2 pt-1">
            <button type="submit" class="flex-1 px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium transition text-center">
              💾 Save to Simulator
            </button>
            <button type="button" onclick="generateD1Sql()" class="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg font-medium transition">
              📋 Generate D1 SQL
            </button>
          </div>
        </form>

        <div id="sqlOutputContainer" class="hidden space-y-2 pt-2 border-t border-slate-800/80">
          <div class="flex justify-between items-center text-[11px]">
            <span class="font-medium text-amber-400">⚡ Ready D1 SQL Query:</span>
            <button onclick="copySqlCode()" class="text-cyan-400 hover:underline">Copy SQL</button>
          </div>
          <pre id="sqlOutput" class="p-3 bg-slate-900 border border-slate-800 rounded-lg text-emerald-400 font-mono text-[10px] overflow-x-auto whitespace-pre-wrap select-all"></pre>
        </div>
      </div>
    </div>

    <!-- Right Column: Live Telegram Chat Simulator -->
    <div class="lg:col-span-7 flex flex-col bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl h-[620px]">
      <!-- Chat Header -->
      <div class="px-5 py-3.5 bg-slate-900 border-b border-slate-800 flex items-center justify-between shrink-0">
        <div class="flex items-center space-x-3">
          <div class="relative">
            <div class="w-9 h-9 rounded-full bg-cyan-600 flex items-center justify-center text-white font-bold text-sm">
              እ
            </div>
            <span class="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-900"></span>
          </div>
          <div>
            <h3 class="text-sm font-semibold text-slate-100">Smart X Ethiopian (Smart X ET)</h3>
            <p class="text-[11px] text-cyan-400">bot @SmartX_PreRegister_bot • HAB IT Solutions</p>
          </div>
        </div>
        <button onclick="resetChat()" class="text-xs text-slate-400 hover:text-slate-200 px-2 py-1 rounded hover:bg-slate-800 transition">
          Clear Chat
        </button>
      </div>

      <!-- Chat Messages Scroll Area -->
      <div id="chatContainer" class="flex-1 p-4 overflow-y-auto space-y-4 chat-bg">
        <!-- System Welcome Message -->
        <div class="flex justify-center">
          <div class="bg-slate-900/90 border border-slate-800/80 rounded-full px-4 py-1 text-[11px] text-slate-400">
            Chat session initialized. Send /start or click a command to test.
          </div>
        </div>
      </div>

      <!-- Keyboard Options Container (Dynamic Telegraf Reply Keyboard) -->
      <div id="replyKeyboard" class="hidden px-3 py-2 bg-slate-900 border-t border-slate-800 shrink-0">
        <div id="replyKeyboardButtons" class="grid grid-cols-2 gap-1.5"></div>
      </div>

      <!-- Alert Banner for Callback Notifications -->
      <div id="alertBanner" class="hidden px-4 py-2 bg-cyan-900/80 border-t border-cyan-700 text-xs text-cyan-200 flex justify-between items-center">
        <span id="alertText">Notification</span>
        <button onclick="closeAlert()" class="text-cyan-400 hover:text-white font-bold ml-2">&times;</button>
      </div>

      <!-- Chat Input Area -->
      <form onsubmit="handleFormSubmit(event)" class="p-3 bg-slate-900 border-t border-slate-800 flex items-center space-x-2 shrink-0">
        <input 
          type="text" 
          id="messageInput" 
          placeholder="ይጻፉ... (Write message, e.g. /start or Abel Bekele, 10B)" 
          class="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          autocomplete="off"
        />
        <button 
          type="submit" 
          class="px-4 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-medium transition shadow-lg shadow-cyan-950 shrink-0">
          Send
        </button>
      </form>
    </div>
  </main>

  <script>
    let messageIdCounter = 1;

    // Send update payload to simulation API
    async function sendUpdate(updatePayload) {
      try {
        const response = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        const data = await response.json();
        
        if (data.ok && data.responses) {
          data.responses.forEach(res => {
            if (res.method === 'sendMessage') {
              renderBotMessage(res.data.text, res.data.reply_markup, res.data.message_id);
            } else if (res.method === 'editMessageText') {
              renderBotMessage(res.data.text, res.data.reply_markup, res.data.message_id, true);
            } else if (res.method === 'editMessageReplyMarkup') {
              updateBotMessageMarkup(res.data.message_id, res.data.reply_markup);
            } else if (res.method === 'answerCallbackQuery' && res.data.text) {
              showAlert(res.data.text);
            } else if (res.method === 'sendPoll') {
              renderPollWidget(res.data, res.result);
            }
          });
        }
      } catch (err) {
        console.error('Failed to send update:', err);
      }
    }

    function sendQuickMessage(text) {
      document.getElementById('messageInput').value = text;
      handleFormSubmit(new Event('submit'));
    }

    function handleFormSubmit(e) {
      e.preventDefault();
      const input = document.getElementById('messageInput');
      const text = input.value.trim();
      if (!text) return;

      input.value = '';
      renderUserMessage(text);

      const entities = [];
      if (text.startsWith('/')) {
        const cmdMatch = text.match(/^\/\w+/);
        if (cmdMatch) {
          entities.push({ offset: 0, length: cmdMatch[0].length, type: 'bot_command' });
        }
      }

      const update = {
        update_id: Math.floor(Math.random() * 100000),
        message: {
          message_id: messageIdCounter++,
          from: { id: 12345678, is_bot: false, first_name: 'የሙከራ ተማሪ' },
          chat: { id: 12345678, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: text,
          ...(entities.length > 0 ? { entities } : {})
        }
      };

      sendUpdate(update);
    }

    function handleCallback(callbackData, messageId) {
      const update = {
        update_id: Math.floor(Math.random() * 100000),
        callback_query: {
          id: 'cb_' + Math.floor(Math.random() * 100000),
          from: { id: 12345678, is_bot: false, first_name: 'የሙከራ ተማሪ' },
          message: {
            message_id: messageId || messageIdCounter,
            chat: { id: 12345678, type: 'private' },
            text: ''
          },
          data: callbackData
        }
      };

      sendUpdate(update);
    }

    function renderUserMessage(text) {
      const container = document.getElementById('chatContainer');
      const msgDiv = document.createElement('div');
      msgDiv.className = 'flex justify-end';
      msgDiv.innerHTML = '<div class="bg-cyan-600 text-white rounded-2xl rounded-tr-none px-4 py-2.5 max-w-[80%] text-xs shadow-md"><p class="whitespace-pre-wrap font-sans">' + escapeHtml(text) + '</p><span class="text-[9px] text-cyan-200 block text-right mt-1">' + formatTime() + '</span></div>';
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }

    function renderBotMessage(text, replyMarkup, msgId, isEdit = false) {
      const container = document.getElementById('chatContainer');
      const timeStr = formatTime();

      // Convert standard Telegram HTML tags safely
      let formattedText = (text || '')
        .split('&lt;').join('<')
        .split('&gt;').join('>')
        .split('\\n').join('<br/>');

      let inlineButtonsHtml = '';
      if (replyMarkup && replyMarkup.inline_keyboard) {
        inlineButtonsHtml = '<div class="inline-buttons-container mt-3 pt-2 border-t border-slate-800 space-y-1.5">';
        replyMarkup.inline_keyboard.forEach(row => {
          inlineButtonsHtml += '<div class="flex flex-wrap gap-1.5">';
          row.forEach(btn => {
            if (btn.url) {
              inlineButtonsHtml += '<a href="' + escapeHtml(btn.url) + '" target="_blank" class="flex-1 px-3 py-1.5 bg-cyan-950/70 hover:bg-cyan-900/80 text-cyan-300 text-xs rounded-lg transition border border-cyan-700/60 text-center font-medium flex items-center justify-center gap-1"><span>' + escapeHtml(btn.text) + '</span><span class="text-[10px]">↗</span></a>';
            } else {
              inlineButtonsHtml += '<button onclick="handleCallback(\'' + escapeHtml(btn.callback_data) + '\', ' + (msgId || 0) + ')" class="flex-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs rounded-lg transition border border-slate-700 text-center font-medium">' + escapeHtml(btn.text) + '</button>';
            }
          });
          inlineButtonsHtml += '</div>';
        });
        inlineButtonsHtml += '</div>';
      }

      // Handle custom reply keyboard buttons at bottom
      if (replyMarkup && replyMarkup.keyboard) {
        renderReplyKeyboard(replyMarkup.keyboard);
      }

      if (isEdit) {
        const lastBotMsg = (msgId ? container.querySelector('[data-msg-id="' + msgId + '"]') : null) || container.querySelector('[data-bot-msg="true"]:last-child');
        if (lastBotMsg) {
          lastBotMsg.innerHTML = '<div class="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-xs shadow-md"><div class="whitespace-pre-wrap leading-relaxed">' + formattedText + '</div>' + inlineButtonsHtml + '<span class="text-[9px] text-slate-500 block text-right mt-1">' + timeStr + ' (edited)</span></div>';
          container.scrollTop = container.scrollHeight;
          return;
        }
      }

      const msgDiv = document.createElement('div');
      msgDiv.className = 'flex justify-start';
      msgDiv.setAttribute('data-bot-msg', 'true');
      if (msgId) msgDiv.setAttribute('data-msg-id', String(msgId));
      msgDiv.innerHTML = '<div class="bg-slate-900 border border-slate-800 text-slate-100 rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] text-xs shadow-md"><div class="whitespace-pre-wrap leading-relaxed">' + formattedText + '</div>' + inlineButtonsHtml + '<span class="text-[9px] text-slate-500 block text-right mt-1">' + timeStr + '</span></div>';
      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }

    function renderPollWidget(pollData, pollResult) {
      const container = document.getElementById('chatContainer');
      const msgDiv = document.createElement('div');
      msgDiv.className = 'flex justify-start';
      msgDiv.setAttribute('data-bot-msg', 'true');

      const question = pollData.question || 'Quiz Question';
      const options = pollData.options || [];
      const correctId = pollData.correct_option_id !== undefined ? pollData.correct_option_id : 0;
      const explanation = pollData.explanation || '';
      const target = pollData.chat_id || 'Current Chat';
      const pollUid = 'poll_' + Math.floor(Math.random() * 100000);

      let optionsHtml = '';
      options.forEach((opt, idx) => {
        const optText = typeof opt === 'string' ? opt : opt.text;
        optionsHtml += '<button onclick="handleVote(\'' + pollUid + '\', ' + idx + ', ' + correctId + ')" id="' + pollUid + '_opt_' + idx + '" class="w-full text-left px-3 py-2.5 bg-slate-800/90 hover:bg-slate-750 border border-slate-700/80 rounded-xl text-xs text-slate-200 transition flex items-center justify-between group">';
        optionsHtml += '<span class="flex items-center gap-2">';
        optionsHtml += '<span class="w-5 h-5 rounded-full border border-slate-600 flex items-center justify-center text-[10px] text-slate-400 group-hover:border-cyan-400 group-hover:text-cyan-400 font-mono font-bold">' + String.fromCharCode(65 + idx) + '</span>';
        optionsHtml += '<span class="opt-label font-medium">' + escapeHtml(optText) + '</span>';
        optionsHtml += '</span>';
        optionsHtml += '<span class="status-indicator text-[11px] font-bold hidden"></span>';
        optionsHtml += '</button>';
      });

      msgDiv.innerHTML = '<div class="bg-slate-900 border border-amber-600/50 text-slate-100 rounded-2xl rounded-tl-none p-4 max-w-[88%] text-xs shadow-xl space-y-3">' +
        '<div class="flex items-center justify-between border-b border-slate-800 pb-2">' +
          '<span class="px-2.5 py-0.5 bg-amber-950 text-amber-300 border border-amber-700/60 rounded-full text-[10px] font-bold flex items-center gap-1.5">' +
            '<span>📊</span> Telegram Quiz Poll' +
          '</span>' +
          '<span class="text-[10px] text-slate-400 font-mono bg-slate-950 px-2 py-0.5 rounded border border-slate-800">' + escapeHtml(target) + '</span>' +
        '</div>' +
        '<div class="font-bold text-slate-100 text-sm leading-snug">' +
          escapeHtml(question) +
        '</div>' +
        '<div class="space-y-1.5" id="' + pollUid + '_options">' +
          optionsHtml +
        '</div>' +
        (explanation ? '<div id="' + pollUid + '_explanation" class="hidden p-2.5 bg-emerald-950/60 border border-emerald-700/70 rounded-xl text-[11px] text-emerald-200 space-y-1">' +
          '<div class="font-bold flex items-center gap-1">💡 ማብራሪያ (Explanation):</div>' +
          '<div>' + escapeHtml(explanation) + '</div>' +
        '</div>' : '') +
        '<div class="text-[9px] text-slate-500 flex justify-between pt-1 border-t border-slate-800/60">' +
          '<span>🎯 Anonymous Quiz • Smart X ET</span>' +
          '<span>' + formatTime() + '</span>' +
        '</div>' +
      '</div>';

      container.appendChild(msgDiv);
      container.scrollTop = container.scrollHeight;
    }

    function handleVote(pollUid, selectedIdx, correctIdx) {
      const container = document.getElementById(pollUid + '_options');
      if (!container || container.getAttribute('data-voted') === 'true') return;
      container.setAttribute('data-voted', 'true');

      const buttons = container.querySelectorAll('button');
      buttons.forEach((btn, idx) => {
        btn.disabled = true;
        btn.classList.remove('hover:bg-slate-750');
        const indicator = btn.querySelector('.status-indicator');

        if (idx === correctIdx) {
          btn.className = 'w-full text-left px-3 py-2.5 bg-emerald-950/80 border border-emerald-500/80 rounded-xl text-xs text-emerald-200 flex items-center justify-between';
          if (indicator) {
            indicator.textContent = '✅ Correct';
            indicator.classList.remove('hidden');
          }
        } else if (idx === selectedIdx) {
          btn.className = 'w-full text-left px-3 py-2.5 bg-rose-950/80 border border-rose-500/80 rounded-xl text-xs text-rose-200 flex items-center justify-between';
          if (indicator) {
            indicator.textContent = '❌ Wrong';
            indicator.classList.remove('hidden');
          }
        } else {
          btn.className = 'w-full text-left px-3 py-2.5 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-500 opacity-60 flex items-center justify-between';
        }
      });

      const expBox = document.getElementById(pollUid + '_explanation');
      if (expBox) expBox.classList.remove('hidden');
    }

    function updateBotMessageMarkup(msgId, replyMarkup) {
      const container = document.getElementById('chatContainer');
      const target = (msgId ? container.querySelector('[data-msg-id="' + msgId + '"]') : null) || container.querySelector('[data-bot-msg="true"]:last-child');
      if (target) {
        const btnContainer = target.querySelector('.inline-buttons-container');
        if (btnContainer && (!replyMarkup || !replyMarkup.inline_keyboard || replyMarkup.inline_keyboard.length === 0)) {
          btnContainer.remove();
        }
      }
    }

    function renderReplyKeyboard(keyboard) {
      const keyboardContainer = document.getElementById('replyKeyboard');
      const buttonsContainer = document.getElementById('replyKeyboardButtons');
      buttonsContainer.innerHTML = '';

      keyboard.forEach(row => {
        row.forEach(btnText => {
          const btn = document.createElement('button');
          btn.className = 'px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-lg border border-slate-700 transition text-center';
          btn.textContent = typeof btnText === 'string' ? btnText : btnText.text;
          btn.onclick = () => sendQuickMessage(btn.textContent);
          buttonsContainer.appendChild(btn);
        });
      });

      keyboardContainer.classList.remove('hidden');
    }

    function showAlert(text) {
      const banner = document.getElementById('alertBanner');
      const bannerText = document.getElementById('alertText');
      bannerText.textContent = text;
      banner.classList.remove('hidden');
      setTimeout(() => closeAlert(), 4000);
    }

    function closeAlert() {
      document.getElementById('alertBanner').classList.add('hidden');
    }

    function resetChat() {
      const container = document.getElementById('chatContainer');
      container.innerHTML = '<div class="flex justify-center"><div class="bg-slate-900/90 border border-slate-800/80 rounded-full px-4 py-1 text-[11px] text-slate-400">Chat cleared. Send /start to begin again.</div></div>';
      document.getElementById('replyKeyboard').classList.add('hidden');
      closeAlert();
    }

    function formatTime() {
      const now = new Date();
      return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function escapeHtml(str) {
      return String(str)
        .split('&').join('&amp;')
        .split('<').join('&lt;')
        .split('>').join('&gt;')
        .split('"').join('&quot;')
        .split("'").join('&#039;');
    }

    async function loadSelectedTemplate() {
      const select = document.getElementById('tplSelect');
      const val = select.value;
      
      if (val === 'new') {
        document.getElementById('tplTitle').value = '';
        document.getElementById('tplGrade').value = 'All';
        document.getElementById('tplBtnText').value = '✨ አዎ! እንፈልጋለን';
        document.getElementById('tplContentHtml').value = '';
        document.getElementById('sqlOutputContainer').classList.add('hidden');
        return;
      }

      try {
        const res = await fetch('/api/templates');
        const data = await res.json();
        if (data.ok && data.templates) {
          const tpl = data.templates.find(t => String(t.id) === String(val));
          if (tpl) {
            document.getElementById('tplTitle').value = tpl.title || '';
            document.getElementById('tplGrade').value = tpl.grade || 'All';
            document.getElementById('tplBtnText').value = tpl.button_text || '✨ አዎ! እንፈልጋለን';
            document.getElementById('tplContentHtml').value = tpl.content_html || '';
            generateD1Sql();
          }
        }
      } catch (err) {
        console.warn('Error fetching templates:', err);
      }
    }

    async function handleSaveTemplate(e) {
      e.preventDefault();
      const id = document.getElementById('tplSelect').value;
      const title = document.getElementById('tplTitle').value;
      const grade = document.getElementById('tplGrade').value;
      const button_text = document.getElementById('tplBtnText').value;
      const content_html = document.getElementById('tplContentHtml').value;

      try {
        const res = await fetch('/api/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: id === 'new' ? null : id, title, grade, button_text, content_html })
        });
        const data = await res.json();
        if (data.ok) {
          showAlert('✅ ቴምፕሌቱ በሙከራ ቦቱ ላይ ተቀምጧል! በ /admin ውስጥ መሞከር ይችላሉ።');
          generateD1Sql();
        }
      } catch (err) {
        showAlert('❌ Error saving template: ' + err.message);
      }
    }

    function generateD1Sql() {
      const id = document.getElementById('tplSelect').value;
      const title = document.getElementById('tplTitle').value || 'አዲስ ቴምፕሌት';
      const grade = document.getElementById('tplGrade').value || 'All';
      const button_text = document.getElementById('tplBtnText').value || '✨ አዎ! እንፈልጋለን';
      const content_html = document.getElementById('tplContentHtml').value || '<b>ይዘት</b>';

      const escTitle = title.split("'").join("''");
      const escBtn = button_text.split("'").join("''");
      const escHtml = content_html.split("'").join("''");

      let sql = '';
      if (id !== 'new') {
        sql = '-- 1. Cloudflare D1 SQL Query: Update existing Group Promo Template (ID: ' + id + ')\\n' +
              'UPDATE promo_templates \\n' +
              'SET title = \'' + escTitle + '\', \\n' +
              '    grade = \'' + grade + '\', \\n' +
              '    button_text = \'' + escBtn + '\', \\n' +
              '    content_html = \'' + escHtml + '\',\\n' +
              '    updated_at = CURRENT_TIMESTAMP \\n' +
              'WHERE id = ' + id + ';';
      } else {
        sql = '-- 1. Cloudflare D1 SQL Query: Insert new Group Promo Template\\n' +
              'INSERT INTO promo_templates (title, grade, button_text, content_html, is_active) \\n' +
              'VALUES (\'' + escTitle + '\', \'' + grade + '\', \'' + escBtn + '\', \'' + escHtml + '\', 1);';
      }

      document.getElementById('sqlOutput').textContent = sql;
      document.getElementById('sqlOutputContainer').classList.remove('hidden');
    }

    function copySqlCode() {
      const text = document.getElementById('sqlOutput').textContent;
      navigator.clipboard.writeText(text);
      showAlert('📋 የ D1 SQL ኮድ ተቀድቷል!');
    }

    // Auto-trigger /start on load
    window.onload = () => {
      sendUpdate({
        update_id: 1000,
        message: {
          message_id: 1,
          from: { id: 12345678, is_bot: false, first_name: 'ተማሪ' },
          chat: { id: 12345678, type: 'private' },
          date: Math.floor(Date.now() / 1000),
          text: '/start'
        }
      });
    };
  </script>
</body>
</html>`;

  res.send(html);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartX Telegram Bot server listening on http://0.0.0.0:${PORT}`);
});
