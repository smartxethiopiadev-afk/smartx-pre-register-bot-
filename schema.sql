-- =========================================================
-- Smart X Ethiopian - Cloudflare D1 Database Schema
-- Production Ready & Fully Optimized (Clean Architecture - Zero AI)
-- =========================================================

-- Clean up any legacy or old AI tables if present
DROP TABLE IF EXISTS ai_chats;
DROP TABLE IF EXISTS ai_conversations;
DROP TABLE IF EXISTS gemini_logs;
DROP TABLE IF EXISTS ai_history;

-- 1. Users Table: Registered students, preferences & referral metrics
CREATE TABLE IF NOT EXISTS users (
  telegram_id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  phone TEXT DEFAULT 'N/A',
  grade TEXT NOT NULL,
  stream TEXT DEFAULT 'General',
  language TEXT DEFAULT 'am',
  referred_by INTEGER,
  referral_count INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  q_answers TEXT,                     -- JSON Array of 5 diagnostic answers ['Yes', 'Yes', ...]
  app_notification INTEGER DEFAULT 1, -- 1: Opted-in for App Launch Notification
  is_channel_member INTEGER DEFAULT 1,
  is_active INTEGER DEFAULT 1,        -- 1: Active, 0: Blocked/Inactive
  is_blocked INTEGER DEFAULT 0,
  registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Fast query indexes
CREATE INDEX IF NOT EXISTS idx_users_referred_by ON users(referred_by);
CREATE INDEX IF NOT EXISTS idx_users_points ON users(points DESC);
CREATE INDEX IF NOT EXISTS idx_users_grade ON users(grade);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users(is_active);

-- 2. Promo Templates (Customizable Group Messages & Customizable Button Labels)
CREATE TABLE IF NOT EXISTS promo_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,                         -- Title shown in Telegram inline query list
  grade TEXT DEFAULT 'All',                    -- '9', '10', '11', '12', 'All'
  button_text TEXT DEFAULT '✨ አዎ! እንፈልጋለን',  -- Customizable button label (Clean, no arrow)
  content_html TEXT NOT NULL,                  -- Admin customized HTML message
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_promo_templates_active ON promo_templates(is_active);

-- Seed High-Converting Default Grade Promotional Templates (No Parentheses)
INSERT OR IGNORE INTO promo_templates (id, title, grade, button_text, content_html, is_active) VALUES
(
  1,
  '📚 ለ 9-12ኛ ክፍል አጠቃላይ',
  'All',
  '✨ አዎ! እንፈልጋለን',
  '✨ <b>ለ 9-12ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹\n\nየትምህርት ውጤታችሁን ለማሻሻል አጋዥ Short Note እና Worksheet ማግኘት ትፈልጋላችሁ?\n\nየሁሉንም ትምህርቶች ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!',
  1
),
(
  2,
  '📗 ለ 9ኛ ክፍል ተማሪዎች',
  '9',
  '📚 የ 9ኛ ክፍል ማጠቃለያ አግኝ',
  '📚 <b>ለ 9ኛ ክፍል ተማሪዎች የቀረበ ልዩ ጥሪ!</b> 🇪🇹\n\nየትምህርት ውጤታችሁን ለማሻሻል አጋዥ Short Note እና Worksheet ማግኘት ትፈልጋላችሁ?\n\nየ 9ኛ ክፍል አዲሱ ካሪኩለም ምዕራፍ ተኮር ማጠቃለያዎች፣ የፈተና ጥያቄዎች እና መልሶችን አዘጋጅተንላችኋል!',
  1
),
(
  3,
  '📘 ለ 10ኛ ክፍል ተማሪዎች',
  '10',
  '🎯 የ 10ኛ ክፍል Worksheet አግኝ',
  '🎯 <b>ለ 10ኛ ክፍል ተማሪዎች የተዘጋጀ ልዩ አጋዥ!</b> 🇪🇹\n\nለፈተና በብቃት ለመዘጋጀት የሁሉንም ትምህርቶች Short Notes እና Model Worksheets ይፈልጋሉ?\n\nሁሉንም ጥያቄዎች ከነዝርዝር ማብራሪያቸው በአንድ ላይ ያግኙ!',
  1
),
(
  4,
  '📙 ለ 11ኛ ክፍል ተማሪዎች',
  '11',
  '💡 የ 11ኛ ክፍል ጥያቄዎች አግኝ',
  '💡 <b>ለ 11ኛ ክፍል Natural እና Social Science ተማሪዎች!</b> 🇪🇹\n\nየከበዷችሁን የትምህርት ምዕራፎች በቀላሉ ለመረዳት አጋዥ Short Notes እና Worksheets ማግኘት ትፈልጋላችሁ?\n\nየ 11ኛ ክፍል የሁሉንም ትምህርቶች አጋዥ ቁሳቁሶች ተዘጋጅተዋል!',
  1
),
(
  5,
  '🎓 ለ 12ኛ ክፍል ተማሪዎች',
  '12',
  '🏆 የ 12ኛ ክፍል Model Exam አግኝ',
  '🏆 <b>ለ 12ኛ ክፍል የዩኒቨርሲቲ መግቢያ ፈተና ተፈታኞች!</b> 🇪🇹\n\nለብሔራዊ ፈተና ከፍተኛ ውጤት ለማምጣት አጋዥ Short Notes እና Model Exams ይፈልጋሉ?\n\nያለፉት አመታት የፈተና ጥያቄዎች እና የሞዴል ፈተናዎች ከነመልሳቸው ተዘጋጅተዋል!',
  1
);

-- 3. System Configuration & Metadata
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO system_config (key, value) VALUES 
  ('app_name', 'Smart X Ethiopian'),
  ('release_date', 'መስከረም 5'),
  ('required_channel', '@SmartX_Discussion'),
  ('official_channel', '@SmartXEthiopia'),
  ('support_username', '@smart_x_help'),
  ('bot_version', 'v5.5-production');

-- 4. App Information / Knowledge Base
CREATE TABLE IF NOT EXISTS app_info (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO app_info (key, value) VALUES
  ('about_app', 'Smart X Ethiopian — ለ 9-12ኛ ክፍል ተማሪዎች የተዘጋጀ 100% Offline የሚሰራ የፈተና፣ የ Short Note እና የ Worksheet መተግበሪያ።'),
  ('contact_email', 'smartx.ethiopia.dev@gmail.com');

-- 5. Broadcast Campaigns Master Table
CREATE TABLE IF NOT EXISTS broadcasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  message_type TEXT DEFAULT 'text',   -- 'text', 'photo', 'video', 'document', 'audio', 'voice'
  payload_json TEXT NOT NULL,         -- JSON payload
  target_grade TEXT DEFAULT 'All',    -- '9', '10', '11', '12', 'All'
  total_recipients INTEGER DEFAULT 0,
  sent_count INTEGER DEFAULT 0,
  failed_count INTEGER DEFAULT 0,
  blocked_count INTEGER DEFAULT 0,
  pending_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',       -- 'queued', 'processing', 'completed', 'cancelled'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 6. Broadcast Dispatch Queue (Safe Batch Processing via Cloudflare Cron)
CREATE TABLE IF NOT EXISTS broadcast_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  broadcast_id INTEGER NOT NULL,
  telegram_id INTEGER NOT NULL,
  status TEXT DEFAULT 'pending',      -- 'pending', 'sent', 'failed', 'blocked'
  attempts INTEGER DEFAULT 0,
  sent_at DATETIME,
  error TEXT,
  FOREIGN KEY (broadcast_id) REFERENCES broadcasts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_broadcast_queue_status ON broadcast_queue(status);
CREATE INDEX IF NOT EXISTS idx_broadcast_queue_broadcast_id ON broadcast_queue(broadcast_id);

-- 7. Telegram Channel & Group Poll Quizzes Table
CREATE TABLE IF NOT EXISTS channel_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  admin_id INTEGER,
  title TEXT NOT NULL,
  question TEXT NOT NULL,
  options_json TEXT NOT NULL,
  correct_option_id INTEGER DEFAULT 0,
  explanation TEXT,
  target_destination TEXT DEFAULT 'both',  -- 'channel', 'group', 'both'
  channel_handle TEXT DEFAULT '@SmartX_Discussion',
  group_handle TEXT DEFAULT '@SmartX_Ethio',
  telegram_poll_id TEXT,
  sent_status TEXT DEFAULT 'sent',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_channel_polls_created ON channel_polls(created_at DESC);
