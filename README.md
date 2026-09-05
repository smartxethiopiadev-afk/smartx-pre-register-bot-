# Smart X Ethiopian Telegram Bot 🇪🇹

Telegram Bot የተማሪዎች ምዝገባ፣ የትምህርት ጥያቄዎች (Gemini 3.1 Quiz Polls) እና የአድሚን ማኔጅመንት ቦት።

---

## 🚀 እንዴት ማስኬድ (Run) ይቻላል?

### 1. በኮምፒውተር / VPS ላይ በቀጥታ ለማስኬድ (Long Polling)
ምንም አይነት የዌብሁክ ወይም የ Cloudflare ድካም ሳይኖር በቀጥታ ከቴሌግራም ሰርቨር ጋር እንዲገናኝ፡
```bash
# 1. ፓኬጆችን ጫን
npm install

# 2. በ .env ውስጥ የእርስዎን BOT TOKEN እና GEMINI KEY ያስገቡ
# TELEGRAM_BOT_TOKEN=...
# GEMINI_API_KEY=...
# ADMIN_IDS=...

# 3. ቦቱን በቀጥታ አስጀምር
npm run polling
```
ቦቱ ወዲያውኑ መልዕክቶችን መቀበልና መመለስ ይጀምራል!

---

### 2. ወደ Cloudflare Workers ለመልቀቅ (Deploy to Cloudflare)
```bash
# 1. Deploy አድርግ
npx wrangler deploy

# 2. ዌብሁክ ለማስመዝገብ በ browser ይክፈቱ፦
# https://<የእርስዎ-worker-ስም>.workers.dev/register
```
**ማሳሰቢያ:** ዌብሁክ ካልተመዘገበ ቴሌግራም መልዕክት ወደ Worker አይልክም! `/register` የሚለውን ሊንክ አንድ ጊዜ መክፈት በቂ ነው።

---

### 3. ወደ GitHub Push ለማድረግ (Git & GitHub)
ቀደም ሲል የነበረው የ API Key ሚስጥር ከኮዱ ስለተወገደ፣ አሁን ያለምንም ችግር ወደ GitHub Push ማድረግ ይችላሉ፦
```bash
git add .
git commit -m "Fix Telegram bot command handling, zero-db support and remove hardcoded secrets"
git push origin main
```

---

## 🎯 ዋና ዋና ትዕዛዛት (Bot Commands)

| Command | ተግባር (Function) |
|---|---|
| `/start` | የተማሪ ምዝገባ መጀመሪያ (Onboarding & Registration) |
| `/myid` | የእርስዎን ቴሌግራም ID እና የአድሚን ፍቃድ ሁኔታ ያሳያል |
| `/quiz <ርዕስ>` | በ Gemini 3.1 አዲስ ፖል ኩዊዝ ያመነጫል (ለምሳሌ፦ `/quiz 10ኛ ክፍል ፊዚክስ motion`) |
| `/admin` | የአድሚን ዳሽቦርድ (የተመዝጋቢዎችና የፖሎች ብዛት) |
| `/setquizchannel @channel` | ፖል የሚላክበትን ቻናል ለመቀየር |
| `/setquizgroup @group` | ፖል የሚላክበትን ግሩፕ ለመቀየር |
| `/help` | የእርዳታና የድጋፍ መረጃ |
