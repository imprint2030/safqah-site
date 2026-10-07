const formidable = require('formidable');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// في الاستضافة: اضبط UPLOAD_DIR على مسار القرص الدائم (مثلاً /data/uploads)
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'public', 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_IMAGE_TYPES = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/gif': '.gif'
};
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 ميجابايت

// تهريب أي نص قبل وضعه داخل HTML (يمنع XSS)
function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatPrice(price) {
    const n = Number(price);
    if (!Number.isFinite(n)) return '—';
    return n.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

function formatRelativeTime(dateString) {
    if (!dateString) return '';
    // SQLite يخزن CURRENT_TIMESTAMP بتوقيت UTC بدون علامة المنطقة، فنضيفها
    const iso = /Z|[+-]\d\d:?\d\d$/.test(dateString) ? dateString : dateString.replace(' ', 'T') + 'Z';
    const date = new Date(iso);
    if (isNaN(date)) return '';

    const diffMins = Math.max(0, Math.floor((Date.now() - date) / 60000));
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'الآن';
    if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
    if (diffHours < 24) return `منذ ${diffHours} ساعة`;
    if (diffDays < 30) return `منذ ${diffDays} يوم`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `منذ ${diffMonths} شهر`;
    return `منذ ${Math.floor(diffMonths / 12)} سنة`;
}

function removeFile(file) {
    if (file && file.filepath) fs.unlink(file.filepath, () => {});
}

function parseForm(req, callback) {
    // في formidable v3 يجب تمرير الخيارات عند الإنشاء، وإلا تُحفظ الملفات في /tmp
    const form = formidable.formidable({
        uploadDir: UPLOAD_DIR,
        maxFiles: 1,
        maxFileSize: MAX_FILE_SIZE,
        maxFields: 20,
        maxFieldsSize: 100 * 1024,
        allowEmptyFiles: false,
        minFileSize: 1,
        filename: (name, ext, part) => {
            // اسم عشوائي بامتداد مأخوذ من نوع الملف وليس من اسمه الأصلي
            const safeExt = ALLOWED_IMAGE_TYPES[part.mimetype] || '.bin';
            return crypto.randomBytes(16).toString('hex') + safeExt;
        },
        filter: ({ name, mimetype }) => name === 'image' && Boolean(ALLOWED_IMAGE_TYPES[mimetype])
    });

    form.parse(req, (err, fields, files) => {
        const file = files && files.image ? (Array.isArray(files.image) ? files.image[0] : files.image) : null;
        if (err) {
            removeFile(file);
            return callback(err);
        }

        // تسطيح الحقول (formidable الحديث يعيد مصفوفات)
        const cleanedFields = {};
        for (const key of Object.keys(fields)) {
            const v = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
            cleanedFields[key] = typeof v === 'string' ? v : '';
        }

        const imageUrl = file && file.newFilename ? '/uploads/' + file.newFilename : null;
        callback(null, cleanedFields, imageUrl, () => removeFile(file));
    });
}

module.exports = { escapeHtml, formatPrice, formatRelativeTime, parseForm, MAX_FILE_SIZE, UPLOAD_DIR };
