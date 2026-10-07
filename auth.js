const bcrypt = require('bcrypt');
const crypto = require('crypto');
const db = require('./db');

const BCRYPT_ROUNDS = 12;
// هاش وهمي لمقارنة ثابتة الزمن عندما لا يوجد المستخدم (يمنع كشف البريد المسجّل عبر التوقيت)
const DUMMY_HASH = bcrypt.hashSync(crypto.randomBytes(16).toString('hex'), BCRYPT_ROUNDS);

const USERNAME_RE = /^[\p{L}\p{N}_.-]{3,30}$/u;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function validateRegistration(username, email, password) {
    if (!USERNAME_RE.test(String(username || '').trim())) return 'اسم المستخدم يجب أن يكون من 3 إلى 30 حرفاً (حروف وأرقام و _ . - فقط).';
    if (!EMAIL_RE.test(normalizeEmail(email)) || normalizeEmail(email).length > 254) return 'البريد الإلكتروني غير صالح.';
    if (typeof password !== 'string' || password.length < 8) return 'كلمة المرور يجب ألا تقل عن 8 أحرف.';
    if (Buffer.byteLength(password) > 72) return 'كلمة المرور طويلة جداً (الحد 72 بايت).';
    return null;
}

function registerUser(username, email, password, callback) {
    const validationError = validateRegistration(username, email, password);
    if (validationError) return callback({ userMessage: validationError });

    bcrypt.hash(password, BCRYPT_ROUNDS, (err, hash) => {
        if (err) return callback(err);
        db.run(
            'INSERT INTO users (username, email, password) VALUES (?, ?, ?)',
            [String(username).trim(), normalizeEmail(email), hash],
            function (err) {
                if (err) {
                    if (err.code === 'SQLITE_CONSTRAINT') {
                        return callback({ userMessage: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.' });
                    }
                    return callback(err);
                }
                callback(null, this.lastID);
            }
        );
    });
}

function loginUser(email, password, callback) {
    if (typeof password !== 'string' || !password) return callback(null, false);
    db.get('SELECT * FROM users WHERE email = ?', [normalizeEmail(email)], (err, user) => {
        if (err) return callback(err);
        bcrypt.compare(password, user ? user.password : DUMMY_HASH, (err, ok) => {
            if (err) return callback(err);
            callback(null, ok && user ? user : false);
        });
    });
}

function requireAuth(req, res, next) {
    if (req.session && req.session.userId && res.locals.user) return next();
    res.redirect('/login');
}

module.exports = { registerUser, loginUser, requireAuth };
