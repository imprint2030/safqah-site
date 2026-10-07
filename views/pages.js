const { escapeHtml: e, formatPrice, formatRelativeTime } = require('../utils');
const icons = require('../icons');

const categoriesMap = {
    vehicles: 'سيارات',
    realestate: 'عقارات',
    electronics: 'إلكترونيات وأجهزة'
};

const PLACEHOLDER_IMG = '/img/placeholder.svg';

// نقبل فقط صوراً مرفوعة على المنصة نفسها
function imageSrc(url) {
    return typeof url === 'string' && /^\/uploads\/[a-f0-9]{32}\.(jpg|png|webp|gif)$/.test(url) ? url : PLACEHOLDER_IMG;
}

function categoryLabel(key) {
    return categoriesMap[key] || key;
}

const csrfField = (token) => `<input type="hidden" name="_csrf" value="${e(token)}">`;

const errorBox = (msg) => (msg ? `<div class="alert alert-danger" role="alert">${e(msg)}</div>` : '');

function renderListingCard(listing) {
    return `
    <article class="card">
        <a href="/listing/${Number(listing.id)}" class="card-img-link" tabindex="-1">
            <img src="${e(imageSrc(listing.image_url))}" alt="${e(listing.title)}" class="card-img" loading="lazy">
        </a>
        <div class="card-body">
            <h3 class="card-title"><a href="/listing/${Number(listing.id)}">${e(listing.title)}</a></h3>
            <p class="card-price">${formatPrice(listing.price)} ر.س</p>
            <div class="card-meta">
                <span>${icons.tag} ${e(categoryLabel(listing.category))}</span>
                <span>${icons.clock} ${e(formatRelativeTime(listing.created_at))}</span>
            </div>
        </div>
    </article>`;
}

function renderGrid(listings, emptyMessage) {
    return `
        <div class="grid">
            ${listings.length ? listings.map(renderListingCard).join('') : `<p class="no-data">${e(emptyMessage)}</p>`}
        </div>`;
}

const pages = {
    categoriesMap,

    home: (listings, search = '') => search ? `
        <section class="section-title">
            <h2>نتائج البحث عن: «${e(search)}» <small>(${listings.length})</small></h2>
        </section>
        ${renderGrid(listings, 'لا توجد نتائج مطابقة لبحثك.')}
    ` : `
        <section class="hero">
            <h1>منصة صفقة للبيع والشراء الذكي</h1>
            <p>اكتشف أفضل العروض في السيارات، العقارات، والأجهزة الإلكترونية بهوية نجديّة أصيلة وطابع حديث.</p>
        </section>

        <section class="section-title">
            <h2>أحدث الإعلانات المدرجة</h2>
        </section>
        ${renderGrid(listings, 'لا توجد إعلانات بعد. كن أول من يضيف إعلاناً!')}
    `,

    category: (categoryKey, listings) => `
        <section class="section-title">
            <h2>تصفح تصنيف: ${e(categoryLabel(categoryKey))}</h2>
        </section>
        ${renderGrid(listings, 'لا توجد إعلانات في هذا التصنيف حالياً.')}
    `,

    detail: (listing) => `
        <div class="detail-container">
            <div class="detail-main">
                <img src="${e(imageSrc(listing.image_url))}" alt="${e(listing.title)}" class="detail-img">
                <h1 class="detail-title">${e(listing.title)}</h1>
                <p class="detail-price">${formatPrice(listing.price)} ر.س</p>
                <div class="detail-meta">
                    <span>${icons.tag} التصنيف: <a href="/category/${e(listing.category)}">${e(categoryLabel(listing.category))}</a></span>
                    <span>${icons.clock} نُشر: ${e(formatRelativeTime(listing.created_at))}</span>
                </div>
                <div class="detail-description">
                    <h3>الوصف التفصيلي</h3>
                    <p>${e(listing.description)}</p>
                </div>
            </div>
            <aside class="detail-sidebar">
                <div class="sidebar-box">
                    <h3>المعلن</h3>
                    <p class="seller-name">${icons.user} ${e(listing.username || 'عضو صفقة')}</p>
                    <hr>
                    <button type="button" class="btn btn-primary w-100" disabled title="قريباً">تواصل مع البائع (قريباً)</button>
                </div>
            </aside>
        </div>
    `,

    notFound: (message = 'الصفحة أو الإعلان غير موجود.') => `
        <p class="no-data">${e(message)}</p>
    `,

    login: ({ csrfToken, error = null, values = {} } = {}) => `
        <div class="auth-container">
            <div class="auth-box">
                <h2>بوابة الانضمام إلى صفقة</h2>
                ${errorBox(error)}

                <form action="/login" method="POST" class="auth-form">
                    ${csrfField(csrfToken)}
                    <h3>تسجيل الدخول</h3>
                    <div class="form-group">
                        <label for="login-email">البريد الإلكتروني</label>
                        <input id="login-email" type="email" name="email" value="${e(values.loginEmail)}" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="login-password">كلمة المرور</label>
                        <input id="login-password" type="password" name="password" autocomplete="current-password" required>
                    </div>
                    <button type="submit" class="btn btn-primary w-100">دخول</button>
                </form>

                <hr class="auth-divider">

                <form action="/register" method="POST" class="auth-form">
                    ${csrfField(csrfToken)}
                    <h3>إنشاء حساب جديد (مجاني)</h3>
                    <div class="form-group">
                        <label for="reg-username">اسم المستخدم</label>
                        <input id="reg-username" type="text" name="username" value="${e(values.username)}" minlength="3" maxlength="30" autocomplete="username" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-email">البريد الإلكتروني</label>
                        <input id="reg-email" type="email" name="email" value="${e(values.registerEmail)}" autocomplete="email" required>
                    </div>
                    <div class="form-group">
                        <label for="reg-password">كلمة المرور</label>
                        <input id="reg-password" type="password" name="password" minlength="8" maxlength="72" autocomplete="new-password" required>
                    </div>
                    <button type="submit" class="btn btn-secondary w-100">تسجيل حساب جديد</button>
                </form>
            </div>
        </div>
    `,

    // رمز CSRF يُمرَّر في رابط الإرسال لأن النموذج multipart ويُتحقق منه قبل حفظ أي ملف
    addListing: ({ csrfToken, error = null, values = {} } = {}) => `
        <div class="form-container">
            <h2>إضافة إعلان جديد في المنصة</h2>
            ${errorBox(error)}
            <form action="/add-listing?_csrf=${encodeURIComponent(csrfToken || '')}" method="POST" enctype="multipart/form-data" class="listing-form">
                <div class="form-group">
                    <label for="title">عنوان الإعلان</label>
                    <input id="title" type="text" name="title" value="${e(values.title)}" maxlength="120" required placeholder="مثال: تويوتا لاندكروزر 2023 GXR">
                </div>
                <div class="form-group">
                    <label for="category">التصنيف</label>
                    <select id="category" name="category" required>
                        ${Object.entries(categoriesMap).map(([key, label]) =>
                            `<option value="${e(key)}"${values.category === key ? ' selected' : ''}>${e(label)}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label for="price">السعر (ريال سعودي)</label>
                    <input id="price" type="number" name="price" value="${e(values.price)}" min="0" max="100000000" step="0.01" required placeholder="0.00">
                </div>
                <div class="form-group">
                    <label for="image">صورة الإعلان (JPG أو PNG أو WEBP، حتى 5 ميجابايت)</label>
                    <input id="image" type="file" name="image" accept="image/jpeg,image/png,image/webp,image/gif" required>
                </div>
                <div class="form-group">
                    <label for="description">تفاصيل ووصف الإعلان</label>
                    <textarea id="description" name="description" rows="6" maxlength="5000" required placeholder="اكتب تفاصيل السلعة بكل أمانة، شروط البيع، وحالة الفحص والمعاينة...">${e(values.description)}</textarea>
                </div>
                <button type="submit" class="btn btn-primary">نشر الإعلان الآن</button>
            </form>
        </div>
    `
};

module.exports = pages;
