const icons = require('../icons');
const { escapeHtml } = require('../utils');

/**
 * @param {string} title   نص عادي (سيتم تهريبه)
 * @param {string} content HTML جاهز ومُهرَّب مسبقاً من pages
 * @param {object} ctx     { user, csrfToken, search }
 */
function layout(title, content, ctx = {}) {
    const { user = null, csrfToken = '', search = '' } = ctx;

    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(title)} | صفقة</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body>
    <header class="main-header">
        <div class="container header-wrapper">
            <a href="/" class="logo">صفقة <span>Safqa</span></a>

            <form action="/" method="GET" class="search-form" role="search">
                <input type="search" name="search" value="${escapeHtml(search)}" maxlength="100" placeholder="ابحث عن سيارات، عقارات، إلكترونيات..." aria-label="بحث">
                <button type="submit" aria-label="بحث">${icons.search}</button>
            </form>

            <nav class="nav-links">
                <a href="/category/vehicles">سيارات</a>
                <a href="/category/realestate">عقارات</a>
                <a href="/category/electronics">أجهزة</a>
                ${user ? `
                <a href="/add-listing" class="btn btn-primary">${icons.plus} أضف إعلانًا</a>
                <span class="user-welcome">${icons.user} ${escapeHtml(user.username)}</span>
                <form action="/logout" method="POST" class="inline-form">
                    <input type="hidden" name="_csrf" value="${escapeHtml(csrfToken)}">
                    <button type="submit" class="btn btn-secondary">خروج</button>
                </form>
                ` : `
                <a href="/login" class="btn btn-secondary">دخول / تسجيل</a>
                `}
            </nav>
        </div>
    </header>

    <main class="container">
        ${content}
    </main>

    <footer class="main-footer">
        <div class="container">
            <p>&copy; ${new Date().getFullYear()} موقع صفقة - جميع الحقوق محفوظة.</p>
            <div class="footer-identity">
                <span class="color-dot clay"></span> بني طيني |
                <span class="color-dot noura"></span> أبيض نورة |
                <span class="color-dot qamari"></span> أزرق قمريات |
                <span class="color-dot coral"></span> أحمر مرجاني
            </div>
        </div>
    </footer>
</body>
</html>`;
}

module.exports = layout;
