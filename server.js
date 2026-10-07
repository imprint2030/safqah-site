const express = require('express');
const session = require('express-session');
const crypto = require('crypto');
const path = require('path');
const db = require('./db');
const { registerUser, loginUser, requireAuth } = require('./auth');
const { parseForm, MAX_FILE_SIZE, UPLOAD_DIR } = require('./utils');
const layout = require('./views/layout');
const pages = require('./views/pages');

const app = express();
const PORT = process.env.PORT || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const CATEGORIES = Object.keys(pages.categoriesMap);

// ───────── مفتاح الجلسة من متغير بيئة ─────────
let sessionSecret = process.env.SESSION_SECRET;
if (!sessionSecret) {
    if (IS_PROD) {
        console.error('خطأ: يجب ضبط SESSION_SECRET في بيئة الإنتاج.');
        process.exit(1);
    }
    sessionSecret = crypto.randomBytes(32).toString('hex');
    console.warn('تنبيه: SESSION_SECRET غير مضبوط، تم توليد مفتاح مؤقت (ستُفقد الجلسات عند إعادة التشغيل).');
}

if (IS_PROD) app.set('trust proxy', 1);
app.disable('x-powered-by');

// ───────── ترويسات أمان أساسية ─────────
app.use((req, res, next) => {
    res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'same-origin',
        'Content-Security-Policy': [
            "default-src 'self'",
            "style-src 'self' https://fonts.googleapis.com",
            "font-src https://fonts.gstatic.com",
            "img-src 'self' data:",
            "script-src 'none'",
            "object-src 'none'",
            "base-uri 'self'",
            "form-action 'self'",
            "frame-ancestors 'none'"
        ].join('; ')
    });
    next();
});

app.use(express.urlencoded({ extended: false, limit: '20kb' }));
app.use('/uploads', express.static(UPLOAD_DIR, { dotfiles: 'deny', index: false }));
app.use(express.static(path.join(__dirname, 'public'), { dotfiles: 'deny' }));
app.use(session({
    name: 'safqa.sid',
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    // ملاحظة: المخزن الافتراضي (MemoryStore) للتطوير فقط، استخدم connect-sqlite3 أو Redis في الإنتاج
    cookie: {
        httpOnly: true,
        sameSite: 'lax',
        secure: IS_PROD,
        maxAge: 24 * 60 * 60 * 1000 // يوم واحد
    }
}));

// ───────── حماية CSRF (رمز مخزّن في الجلسة) ─────────
function getCsrfToken(req) {
    if (!req.session.csrfToken) req.session.csrfToken = crypto.randomBytes(32).toString('hex');
    return req.session.csrfToken;
}

function isValidCsrf(req, token) {
    const expected = req.session && req.session.csrfToken;
    if (!expected || typeof token !== 'string' || token.length !== expected.length) return false;
    return crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected));
}

function csrfProtection(req, res, next) {
    const token = (req.body && req.body._csrf) || req.query._csrf;
    if (!isValidCsrf(req, token)) {
        return res.status(403).send(render(req, res, 'طلب مرفوض', pages.notFound('انتهت صلاحية النموذج، حدّث الصفحة وحاول مجدداً.')));
    }
    next();
}

// ───────── تحديد محاولات الدخول (في الذاكرة) ─────────
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

function rateLimit(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const entry = attempts.get(key);
    if (!entry || now - entry.start > WINDOW_MS) {
        attempts.set(key, { start: now, count: 1 });
        return next();
    }
    entry.count++;
    if (entry.count > MAX_ATTEMPTS) {
        return res.status(429).send(render(req, res, 'محاولات كثيرة', pages.login({
            csrfToken: getCsrfToken(req),
            error: 'محاولات كثيرة، يرجى المحاولة بعد 15 دقيقة.'
        })));
    }
    next();
}
setInterval(() => {
    const now = Date.now();
    for (const [k, v] of attempts) if (now - v.start > WINDOW_MS) attempts.delete(k);
}, WINDOW_MS).unref();

// ───────── سياق المستخدم العام ─────────
app.use((req, res, next) => {
    res.locals.user = null;
    if (!req.session.userId) return next();
    db.get('SELECT id, username, email FROM users WHERE id = ?', [req.session.userId], (err, user) => {
        if (err) return next(err);
        if (!user) delete req.session.userId; // المستخدم حُذف
        res.locals.user = user || null;
        next();
    });
});

function render(req, res, title, content, extra = {}) {
    return layout(title, content, {
        user: res.locals.user,
        csrfToken: res.locals.user ? getCsrfToken(req) : '',
        ...extra
    });
}

// تجديد الجلسة عند الدخول لمنع تثبيت الجلسة (Session Fixation)
function establishSession(req, userId, cb) {
    req.session.regenerate((err) => {
        if (err) return cb(err);
        req.session.userId = userId;
        req.session.save(cb);
    });
}

// ───────── المسارات ─────────

// فحص صحة للاستضافة
app.get('/healthz', (req, res) => res.type('text').send('ok'));

// 1. الرئيسية والبحث
app.get('/', (req, res, next) => {
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    let query = 'SELECT * FROM listings ORDER BY created_at DESC, id DESC LIMIT 60';
    let params = [];

    if (search) {
        // تهريب محارف LIKE الخاصة حتى يُبحث عنها حرفياً
        const term = `%${search.replace(/[\\%_]/g, (c) => '\\' + c)}%`;
        query = "SELECT * FROM listings WHERE title LIKE ? ESCAPE '\\' OR description LIKE ? ESCAPE '\\' ORDER BY created_at DESC, id DESC LIMIT 100";
        params = [term, term];
    }

    db.all(query, params, (err, listings) => {
        if (err) return next(err);
        res.send(render(req, res, search ? `بحث: ${search}` : 'الرئيسية', pages.home(listings, search), { search }));
    });
});

// 2. التصنيفات (قائمة مسموحة فقط)
app.get('/category/:name', (req, res, next) => {
    const categoryKey = req.params.name;
    if (!CATEGORIES.includes(categoryKey)) {
        return res.status(404).send(render(req, res, 'غير موجود', pages.notFound('التصنيف غير موجود.')));
    }
    db.all('SELECT * FROM listings WHERE category = ? ORDER BY created_at DESC, id DESC LIMIT 100', [categoryKey], (err, listings) => {
        if (err) return next(err);
        res.send(render(req, res, `تصنيف ${pages.categoriesMap[categoryKey]}`, pages.category(categoryKey, listings)));
    });
});

// 3. تفاصيل الإعلان
app.get('/listing/:id', (req, res, next) => {
    if (!/^\d{1,10}$/.test(req.params.id)) {
        return res.status(404).send(render(req, res, 'غير موجود', pages.notFound('الإعلان غير موجود.')));
    }
    db.get(`
        SELECT listings.*, users.username
        FROM listings
        LEFT JOIN users ON listings.user_id = users.id
        WHERE listings.id = ?`,
    [Number(req.params.id)], (err, listing) => {
        if (err) return next(err);
        if (!listing) return res.status(404).send(render(req, res, 'غير موجود', pages.notFound('الإعلان غير موجود.')));
        res.send(render(req, res, listing.title, pages.detail(listing)));
    });
});

// 4. المصادقة
app.get('/login', (req, res) => {
    if (res.locals.user) return res.redirect('/');
    res.send(render(req, res, 'تسجيل الدخول', pages.login({ csrfToken: getCsrfToken(req) })));
});

app.post('/login', rateLimit, csrfProtection, (req, res, next) => {
    const { email, password } = req.body;
    loginUser(email, password, (err, user) => {
        if (err) return next(err);
        if (!user) {
            return res.status(401).send(render(req, res, 'تسجيل الدخول', pages.login({
                csrfToken: getCsrfToken(req),
                error: 'بيانات الاعتماد غير صحيحة، حاول مجدداً.',
                values: { loginEmail: email }
            })));
        }
        establishSession(req, user.id, (err) => (err ? next(err) : res.redirect('/')));
    });
});

app.post('/register', rateLimit, csrfProtection, (req, res, next) => {
    const { username, email, password } = req.body;
    registerUser(username, email, password, (err, userId) => {
        if (err) {
            if (!err.userMessage) return next(err);
            return res.status(400).send(render(req, res, 'تسجيل الدخول', pages.login({
                csrfToken: getCsrfToken(req),
                error: err.userMessage,
                values: { username, registerEmail: email }
            })));
        }
        establishSession(req, userId, (err) => (err ? next(err) : res.redirect('/')));
    });
});

// الخروج عبر POST مع CSRF (لا يمكن لموقع آخر إخراج المستخدم برابط)
app.post('/logout', csrfProtection, (req, res) => {
    req.session.destroy(() => {
        res.clearCookie('safqa.sid');
        res.redirect('/');
    });
});

// 5. إضافة إعلان (محمي)
app.get('/add-listing', requireAuth, (req, res) => {
    res.send(render(req, res, 'أضف إعلانك', pages.addListing({ csrfToken: getCsrfToken(req) })));
});

function validateListing(fields, imageUrl) {
    const title = (fields.title || '').trim();
    const description = (fields.description || '').trim();
    const category = fields.category;
    const priceStr = (fields.price || '').trim();
    const price = Number(priceStr);

    if (title.length < 3 || title.length > 120) return { error: 'العنوان يجب أن يكون بين 3 و120 حرفاً.' };
    if (!CATEGORIES.includes(category)) return { error: 'التصنيف غير صالح.' };
    if (!priceStr || !Number.isFinite(price) || price < 0 || price > 100000000) return { error: 'السعر غير صالح.' };
    if (description.length < 10 || description.length > 5000) return { error: 'الوصف يجب أن يكون بين 10 و5000 حرف.' };
    if (!imageUrl) return { error: 'يرجى إرفاق صورة بصيغة JPG أو PNG أو WEBP أو GIF.' };

    return { data: { title, description, category, price: Math.round(price * 100) / 100 } };
}

// CSRF يُتحقق منه من رابط الطلب قبل تحليل النموذج حتى لا يُحفظ أي ملف من طلب مزوّر
app.post('/add-listing', requireAuth, csrfProtection, (req, res, next) => {
    parseForm(req, (err, fields, imageUrl, discardFile) => {
        const showForm = (status, message) => res.status(status).send(render(req, res, 'أضف إعلانك', pages.addListing({
            csrfToken: getCsrfToken(req),
            error: message,
            values: fields || {}
        })));

        if (err) {
            const tooBig = err.httpCode === 413 || /maxFileSize/i.test(err.message || '');
            return showForm(400, tooBig
                ? `حجم الصورة يتجاوز ${MAX_FILE_SIZE / 1024 / 1024} ميجابايت.`
                : 'خطأ في معالجة النموذج أو الملف المرفوع.');
        }

        const { error, data } = validateListing(fields, imageUrl);
        if (error) {
            discardFile();
            return showForm(400, error);
        }

        db.run(
            'INSERT INTO listings (title, description, price, category, image_url, user_id) VALUES (?, ?, ?, ?, ?, ?)',
            [data.title, data.description, data.price, data.category, imageUrl, req.session.userId],
            function (err) {
                if (err) {
                    discardFile();
                    return next(err);
                }
                res.redirect(`/listing/${this.lastID}`);
            }
        );
    });
});

// ───────── 404 ومعالج الأخطاء ─────────
app.use((req, res) => {
    res.status(404).send(render(req, res, 'غير موجود', pages.notFound()));
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).send(render(req, res, 'خطأ', pages.notFound('حدث خطأ في الخادم، حاول لاحقاً.')));
});

app.listen(PORT, () => {
    console.log(`خادم منصة صفقة يعمل الآن على الرابط: http://localhost:${PORT}`);
});
