# صفقة — منصة الإعلانات المبوبة

موقع إعلانات مبوبة مبني على Node.js وExpress وSQLite.

## التشغيل محلياً

```bash
npm install
npm start
```

ثم افتح http://localhost:3000

## متغيرات البيئة

| المتغير | الوصف | مثال |
|---|---|---|
| `NODE_ENV` | ضعه `production` على الاستضافة | `production` |
| `SESSION_SECRET` | مفتاح سري طويل وعشوائي (إلزامي في الإنتاج) | 64 حرفاً عشوائياً |
| `DB_PATH` | مسار ملف قاعدة البيانات | `/data/safqa.db` |
| `UPLOAD_DIR` | مجلد الصور المرفوعة | `/data/uploads` |
| `PORT` | المنفذ (تضبطه الاستضافة تلقائياً) | `3000` |

لتوليد `SESSION_SECRET`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## النشر على Railway

1. ارفع المشروع إلى مستودع على GitHub.
2. من railway.com أنشئ مشروعاً جديداً واختر **Deploy from GitHub repo**، ثم اختر المستودع.
3. من الخدمة اضغط بالزر الأيمن واختر **Attach Volume** (أو من القائمة **+ New → Volume**)، واجعل مسار التركيب (Mount Path): `/data`
4. من تبويب **Variables** أضف:
   ```
   NODE_ENV=production
   SESSION_SECRET=<المفتاح الذي ولّدته>
   DB_PATH=/data/safqa.db
   UPLOAD_DIR=/data/uploads
   ```
5. من **Settings → Networking** اضغط **Generate Domain** لتحصل على رابط، أو اربط دومينك الخاص.
6. (اختياري) من **Settings → Deploy** اجعل Healthcheck Path: `/healthz`

كل `git push` إلى المستودع سيعيد النشر تلقائياً، والإعلانات والصور تبقى محفوظة على القرص `/data`.

## ملاحظات

- الجلسات محفوظة في الذاكرة، لذلك يُسجَّل خروج المستخدمين عند كل إعادة نشر. عند نمو الموقع استخدم `connect-sqlite3` أو Redis.
- خذ نسخة احتياطية من `/data` دورياً.
