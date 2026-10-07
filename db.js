const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'data', 'safqa.db');
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

const db = new sqlite3.Database(dbPath);

db.serialize(() => {
    db.run('PRAGMA foreign_keys = ON');

    // جدول المستخدمين
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // جدول الإعلانات
    db.run(`CREATE TABLE IF NOT EXISTS listings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        price REAL NOT NULL CHECK (price >= 0),
        category TEXT NOT NULL,
        image_url TEXT,
        user_id INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(user_id) REFERENCES users(id)
    )`);

    db.run('CREATE INDEX IF NOT EXISTS idx_listings_category ON listings(category, created_at)');
    db.run('CREATE INDEX IF NOT EXISTS idx_listings_created ON listings(created_at)');

    // بيانات تجريبية عند أول تشغيل فقط.
    // user_id = NULL لأنه لا يوجد مستخدم بعد؛ ربطها بالمعرّف 1 كان سيجعل أول من يسجّل "مالكاً" لها.
    db.get('SELECT COUNT(*) AS count FROM listings', (err, row) => {
        if (err || !row || row.count !== 0) return;
        const stmt = db.prepare('INSERT INTO listings (title, description, price, category, image_url, user_id) VALUES (?, ?, ?, ?, ?, NULL)');
        stmt.run('سيارة تويوتا كامري 2020', 'بحالة ممتازة، ممشى قليل، فحص جديد والمكيف ثلج.', 65000, 'vehicles', null);
        stmt.run('شقة مؤثثة للإيجار بالرياض', 'ثلاث غرف وصالة، موقع متميز بحي الملقا وقريب من الخدمات.', 45000, 'realestate', null);
        stmt.run('آيفون 15 برو ماكس', 'مساحة 256 جيجا، لون تيتانيوم طبيعي، نسبة البطارية 98%.', 3800, 'electronics', null);
        stmt.finalize();
        console.log('تم إدخال البيانات التجريبية بنجاح.');
    });
});

module.exports = db;
