/* ============================================
   Kebab Chicken Lava — POS Script
   ============================================ */

// Check user session
const userSession = JSON.parse(localStorage.getItem('kebab_user_session'));
if (!userSession) {
    window.location.href = 'login.html';
}

// Replace Supabase config with backend API URLs
const BACKEND_URL = "https://chasierkebabckl.vercel.app/api/checkout";
const API_MENU_URL = "https://chasierkebabckl.vercel.app/api/menu";
const API_TX_URL = "https://chasierkebabckl.vercel.app/api/transactions";

// ---- State ----
let menuItems = [];
let cart = [];
let activeCategory = 'all';
let searchQuery = '';

// Emoji map per category (fallback jika tidak ada gambar)
const CATEGORY_EMOJI = {
    'kebab': '🌯',
    'minuman': '🥤',
    'snack': '🍟',
    'paket': '🎁',
    'default': '🍽️'
};

function getEmoji(item) {
    const cat = (item.category || '').toLowerCase();
    for (const [key, emoji] of Object.entries(CATEGORY_EMOJI)) {
        if (cat.includes(key)) return emoji;
    }
    return CATEGORY_EMOJI.default;
}

// ---- Clock ----
function updateClock() {
    const now = new Date();
    document.getElementById('clock').textContent =
        now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
updateClock();
setInterval(updateClock, 1000 * 10);

// ---- DOM refs ----
const menuContainer = document.getElementById('menu-container');
const cartList = document.getElementById('cart-list');
const cartEmpty = document.getElementById('cart-empty');
const totalPriceEl = document.getElementById('total-price');
const itemCountEl = document.getElementById('item-count');
const paymentInput = document.getElementById('payment-amount');
const changeAmountEl = document.getElementById('change-amount');
const processBtn = document.getElementById('process-btn');
const cartBadge = document.getElementById('cart-badge');
const categoryTabs = document.getElementById('category-tabs');
const searchInput = document.getElementById('search-input');
const cartPanel = document.getElementById('cart-panel');
const overlay = document.getElementById('overlay');
const cartToggleBtn = document.getElementById('cart-toggle-btn');
const closeCartBtn = document.getElementById('close-cart-btn');
const toast = document.getElementById('toast');
const adminLinkBtn = document.querySelector('a[href="admin.html"]');


// if (userSession.role_type === 'kasir' && adminLinkBtn) {
//     adminLinkBtn.style.display = 'none';
// }

// ---- Fetch Menu ----
async function fetchMenu() {
    try {
        const response = await fetch(API_MENU_URL);
        const result = await response.json();

        if (!result.success) throw new Error(result.message);

        menuItems = result.data;
        buildCategoryTabs();
        renderMenu();
    } catch (err) {
        console.error('Gagal mengambil menu:', err);
        menuContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:2rem; margin-bottom:8px;">⚠️</div>
                <p style="font-weight:600;">Gagal memuat menu</p>
                <small>Periksa koneksi dan refresh halaman</small>
            </div>`;
    }
}

// ---- Category Tabs ----
function buildCategoryTabs() {
    const cats = ['all', ...new Set(menuItems.map(i => i.category).filter(Boolean))];
    categoryTabs.innerHTML = '';
    cats.forEach(cat => {
        const btn = document.createElement('button');
        btn.className = 'tab' + (cat === activeCategory ? ' active' : '');
        btn.dataset.cat = cat;
        btn.textContent = cat === 'all' ? 'Semua' : cat;
        btn.addEventListener('click', () => {
            activeCategory = cat;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            btn.classList.add('active');
            renderMenu();
        });
        categoryTabs.appendChild(btn);
    });
}

// ---- Render Menu ----
function renderMenu() {
    const query = searchQuery.trim().toLowerCase();

    let filtered = menuItems.filter(item => {
        const matchCat = activeCategory === 'all' || item.category === activeCategory;
        const matchSearch = !query || item.name.toLowerCase().includes(query);
        return matchCat && matchSearch;
    });

    menuContainer.innerHTML = '';

    if (filtered.length === 0) {
        menuContainer.innerHTML = `
            <div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted);">
                <div style="font-size:2rem; margin-bottom:8px;">🔍</div>
                <p style="font-weight:600;">Menu tidak ditemukan</p>
                <small>Coba kata kunci lain</small>
            </div>`;
        return;
    }

    // Group by category
    const categories = activeCategory !== 'all'
        ? [activeCategory]
        : [...new Set(filtered.map(i => i.category))];

    categories.forEach(cat => {
        const catItems = filtered.filter(i => i.category === cat);
        if (!catItems.length) return;

        if (activeCategory === 'all') {
            const label = document.createElement('div');
            label.className = 'menu-category-label';
            label.textContent = cat;
            menuContainer.appendChild(label);
        }

        catItems.forEach(item => {
            const el = document.createElement('div');
            const inCart = cart.find(c => c.id === item.id);
            el.className = 'menu-item' + (inCart ? ' selected' : '');

            // Logika render: Jika ada image_url tampilkan gambar, jika tidak fallback ke Emoji
            const mediaElement = item.image_url
                ? `<div class="menu-item-image-wrapper"><img src="${item.image_url}" alt="${item.name}" class="menu-item-image" loading="lazy"></div>`
                : `<div class="menu-item-emoji-wrapper"><div class="menu-item-emoji">${getEmoji(item)}</div></div>`;

            el.innerHTML = `
                ${mediaElement}
                <div class="menu-item-content">
                    <h4>${item.name}</h4>
                    <p class="price">Rp ${item.price.toLocaleString('id-ID')}</p>
                    <span class="add-hint">${inCart ? `x${inCart.quantity} di keranjang` : 'Ketuk untuk tambah'}</span>
                </div>
            `;
            el.addEventListener('click', () => addToCart(item));
            menuContainer.appendChild(el);
        });
    });
}

// ---- Cart Operations ----
function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    updateCartBadge(true);
    renderCart();
    renderMenu(); // refresh "di keranjang" hint
}

// Added logic for Payment Method auto-fill
const paymentMethodSelect = document.getElementById('payment-method');
if (paymentMethodSelect) {
    paymentMethodSelect.addEventListener('change', (e) => {
        if (e.target.value === 'qris') {
            const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
            paymentInput.value = total;
            calculateChange();
        }
    });
}

window.changeQuantity = function (id, delta) {
    const item = cart.find(c => c.id === id);
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(c => c.id !== id);
    }
    updateCartBadge(false);
    renderCart();
    renderMenu();
};

function updateCartBadge(bump) {
    const total = cart.reduce((s, i) => s + i.quantity, 0);
    cartBadge.textContent = total;
    if (bump) {
        cartBadge.classList.add('bump');
        setTimeout(() => cartBadge.classList.remove('bump'), 300);
    }
}

// ---- Render Cart ----
function renderCart() {
    cartList.innerHTML = '';
    const hasItems = cart.length > 0;

    cartEmpty.classList.toggle('hidden', hasItems);

    let total = 0;
    let totalItems = 0;

    cart.forEach(item => {
        const sub = item.price * item.quantity;
        total += sub;
        totalItems += item.quantity;

        const li = document.createElement('li');
        li.className = 'cart-item';
        li.innerHTML = `
            <div class="cart-item-emoji">${getEmoji(item)}</div>
            <div class="cart-item-details">
                <div class="cart-item-name">${item.name}</div>
                <div class="cart-item-sub">Rp ${item.price.toLocaleString('id-ID')}</div>
            </div>
            <div class="cart-item-qty">
                <button class="qty-btn qty-minus" onclick="changeQuantity(${item.id}, -1)">−</button>
                <span class="qty-display">${item.quantity}</span>
                <button class="qty-btn qty-plus" onclick="changeQuantity(${item.id}, 1)">+</button>
            </div>
            <div class="cart-item-subtotal">Rp ${sub.toLocaleString('id-ID')}</div>
        `;
        cartList.appendChild(li);
    });

    totalPriceEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    itemCountEl.textContent = `${totalItems} item`;
    calculateChange();
    renderPaymentChips();
}

// ---- Change Calculation ----
function calculateChange() {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change = payment - total;

    if (total > 0 && payment >= total) {
        changeAmountEl.textContent = `Rp ${change.toLocaleString('id-ID')}`;
        changeAmountEl.style.color = 'var(--green, #16a34a)';
        processBtn.disabled = false;
    } else if (total > 0 && payment > 0 && payment < total) {
        const kurang = total - payment;
        changeAmountEl.textContent = `Kurang Rp ${kurang.toLocaleString('id-ID')}`;
        changeAmountEl.style.color = 'var(--red)';
        processBtn.disabled = true;
    } else {
        changeAmountEl.textContent = 'Rp 0';
        changeAmountEl.style.color = '';
        processBtn.disabled = true;
    }
}

paymentInput.addEventListener('input', calculateChange);

// ---- Payment Chips (Autocomplete Nominal) ----
const PECAHAN = [500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
const paymentChipsEl = document.getElementById('payment-chips');

function getPaymentSuggestions(total) {
    if (!total || total <= 0) return [];

    const suggestions = [];

    // 1. Uang pas
    if (total % 500 === 0) {
        suggestions.push({ label: 'Uang Pas', value: total });
    }

    // 2. Nominal "bulat terdekat" — kelipatan 5rb pertama di atas total
    const nearest = Math.ceil(total / 5000) * 5000;
    if (nearest > total) {
        suggestions.push({ label: `Rp ${nearest.toLocaleString('id-ID')}`, value: nearest });
    }

    // 3. Selalu tawarkan 50rb dan 100rb jika belum masuk dan lebih besar dari total
    for (const anchor of [50000, 100000]) {
        if (anchor > total && !suggestions.find(s => s.value === anchor)) {
            suggestions.push({ label: `Rp ${anchor.toLocaleString('id-ID')}`, value: anchor });
        }
    }

    // 4. Jika slot masih ada, isi dengan kelipatan 5rb berikutnya setelah nearest
    const allRound = [];
    for (let v = 5000; v <= 200000; v += 5000) allRound.push(v);
    for (const v of allRound) {
        if (suggestions.length >= 4) break;
        if (v > total && !suggestions.find(s => s.value === v)) {
            suggestions.push({ label: `Rp ${v.toLocaleString('id-ID')}`, value: v });
        }
    }

    // Urutkan ascending by value, uang pas tetap di depan
    const uangPas = suggestions.find(s => s.label === 'Uang Pas');
    const rest = suggestions.filter(s => s.label !== 'Uang Pas').sort((a, b) => a.value - b.value);
    return (uangPas ? [uangPas, ...rest] : rest).slice(0, 4);
}

function renderPaymentChips() {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);

    if (!paymentChipsEl || total <= 0) {
        if (paymentChipsEl) paymentChipsEl.style.display = 'none';
        return;
    }

    const suggestions = getPaymentSuggestions(total);
    if (!suggestions.length) {
        paymentChipsEl.style.display = 'none';
        return;
    }

    paymentChipsEl.innerHTML = suggestions.map(s => `
        <button type="button" class="pay-chip ${parseFloat(paymentInput.value) === s.value ? 'active' : ''}"
            data-value="${s.value}">
            ${s.label}
        </button>
    `).join('');

    paymentChipsEl.style.display = 'flex';

    paymentChipsEl.querySelectorAll('.pay-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            paymentInput.value = btn.dataset.value;
            calculateChange();
            renderPaymentChips(); // refresh active state
        });
    });
}


// ---- Process Order ----
async function processOrder() {
    const total = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change = payment - total;
    const customerNameEl = document.getElementById('customer-name');
    const customerName = customerNameEl ? customerNameEl.value : '';
    const notesEl = document.getElementById('transaction-notes');
    const notes = notesEl ? notesEl.value : '';
    const paymentMethod = paymentMethodSelect ? paymentMethodSelect.value : 'tunai'; // Added

    const orderData = {
        items: cart,
        total_price: total,
        payment_amount: payment,
        change_amount: change,
        cashier_name: userSession ? userSession.username : 'Unknown',
        customer_name: customerName,
        notes: notes,
        payment_method: paymentMethod, // Added
        timestamp: new Date().toISOString()
    };

    try {
        processBtn.disabled = true;
        processBtn.classList.add('loading');
        processBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spin">
                <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
            </svg>
            Memproses...`;

        const response = await fetch(BACKEND_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            cart = [];
            paymentInput.value = '';
            if (customerNameEl) customerNameEl.value = '';
            if (notesEl) notesEl.value = '';
            if (paymentMethodSelect) paymentMethodSelect.value = 'tunai'; // Reset dropdown
            renderCart();
            updateCartBadge(false);
            renderMenu();
            showToast('Transaksi berhasil diproses!');
            closeMobileCart();
        } else {
            showToast('Gagal memproses transaksi.', true);
        }
    } catch (err) {
        console.error('Network error:', err);
        showToast('Kesalahan jaringan.', true);
    } finally {
        processBtn.classList.remove('loading');
        processBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
            Proses Pesanan`;
        calculateChange();
    }
}

processBtn.addEventListener('click', processOrder);

// ---- Toast ----
let toastTimer;
function showToast(msg, isError = false) {
    toast.textContent = msg;
    toast.style.background = isError ? '#dc2626' : '#16a34a';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ---- Mobile Cart Drawer ----
function openMobileCart() {
    cartPanel.classList.add('open');
    overlay.classList.add('visible');
    document.body.style.overflow = 'hidden';
}

function closeMobileCart() {
    cartPanel.classList.remove('open');
    overlay.classList.remove('visible');
    document.body.style.overflow = '';
}

cartToggleBtn.addEventListener('click', openMobileCart);
closeCartBtn.addEventListener('click', closeMobileCart);
overlay.addEventListener('click', closeMobileCart);

// ---- Search ----
searchInput.addEventListener('input', () => {
    searchQuery = searchInput.value;
    renderMenu();
});

// ---- Add spin CSS for loading ----
const spinStyle = document.createElement('style');
spinStyle.textContent = `
@keyframes spin { to { transform: rotate(360deg); } }
.spin { animation: spin 0.8s linear infinite; }
`;
document.head.appendChild(spinStyle);

// ---- DOM refs (Additional) ----
const btnTransactions = document.getElementById('btn-transactions');
const txModal = document.getElementById('tx-modal');
const txOverlay = document.getElementById('tx-overlay');
const closeTxBtn = document.getElementById('close-tx-btn');
const txDateInput = document.getElementById('tx-date');
const txList = document.getElementById('tx-list');
const txEmpty = document.getElementById('tx-empty');
const txDailyTotal = document.getElementById('tx-daily-total');
const btnLogout = document.getElementById('btn-logout');

// ---- Hamburger Menu Toggle ----
const hamburgerBtn = document.getElementById('hamburger-btn');
const navMenu = document.getElementById('nav-menu');

if (hamburgerBtn && navMenu) {
    // Toggle menu
    hamburgerBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('open');
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
        if (!hamburgerBtn.contains(e.target) && !navMenu.contains(e.target)) {
            navMenu.classList.remove('open');
        }
    });
}

// Handle logout action
if (btnLogout) {
    btnLogout.addEventListener('click', () => {
        localStorage.removeItem('kebab_user_session');
        window.location.href = 'login.html';
    });
}

// ---- Transaction History ----
function openTxModal() {
    txModal.classList.add('open');
    txOverlay.classList.add('visible');
    document.body.style.overflow = 'hidden';

    // Set default date to today based on local timezone
    if (!txDateInput.value) {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        txDateInput.value = `${year}-${month}-${day}`;
    }
    fetchTransactions(txDateInput.value);
}

function closeTxModal() {
    txModal.classList.remove('open');
    txOverlay.classList.remove('visible');
    document.body.style.overflow = '';
}

async function fetchTransactions(dateStr) {
    try {
        // Parse the local date string (YYYY-MM-DD)
        const [y, m, d] = dateStr.split('-');

        // Create exact local start and end times, then convert to ISO for backend
        const startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        const endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

        // Send date bounds directly to avoid Vercel server timezone shift
        const response = await fetch(`${API_TX_URL}?start=${startDate}&end=${endDate}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message);
        renderTransactions(result.data);
    } catch (err) {
        console.error('Error fetching transactions:', err);
        showToast('Gagal memuat riwayat transaksi', true);
    }
}

function renderTransactions(transactions) {
    txList.innerHTML = '';

    if (!transactions || transactions.length === 0) {
        txEmpty.style.display = 'flex';
        if (txDailyTotal) txDailyTotal.textContent = 'Rp 0';
        return;
    }

    txEmpty.style.display = 'none';
    let dailyTotal = 0;

    transactions.forEach(tx => {
        if (tx.status !== 'canceled') {
            dailyTotal += tx.total_price;
        }

        const li = document.createElement('li');
        li.className = 'tx-item';

        const dateObj = new Date(tx.created_datetime);
        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

        let items = tx.items;
        if (typeof items === 'string') {
            try { items = JSON.parse(items); } catch (e) { }
        }

        let itemsHtml = '';
        if (Array.isArray(items)) {
            itemsHtml = items.map(item => `${item.quantity}x ${item.name}`).join('<br>');
        }

        const notesHtml = tx.notes ? `<div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 6px; padding: 6px; background: var(--surface); border-radius: 4px;">Catatan: ${tx.notes}</div>` : '';
        const payMethodBadge = tx.payment_method ? `<span style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.7rem; color: #334155; margin-left: 6px;">${tx.payment_method.toUpperCase()}</span>` : ''; // Added

        let statusHtml = '';
        if (tx.status === 'canceled') {
            statusHtml = `<div style="font-size: 0.75rem; color: var(--red); margin-top: 6px; font-weight: 600;">Dibatalkan ${tx.cancel_reason ? `- Alasan: ${tx.cancel_reason}` : ''}</div>`;
        } else if (tx.status === 'completed') {
            statusHtml = `<div style="font-size: 0.75rem; color: #16a34a; margin-top: 6px; font-weight: 600;">Selesai</div>`;
        } else {
            statusHtml = `<div style="font-size: 0.75rem; color: #854d0e; margin-top: 6px; font-weight: 600;">Menunggu</div>`;
        }

        li.innerHTML = `
            <div class="tx-item-header">
                <span>ID: #${tx.id} ${payMethodBadge}</span>
                <span>${timeStr}</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin: 2px 0 4px 0;">
                Kasir: ${tx.cashier_name || '-'} ${tx.customer_name ? `| Pembeli: ${tx.customer_name}` : ''}
            </div>
            <div class="tx-item-details">
                ${itemsHtml}
                ${notesHtml}
                ${statusHtml}
            </div>
            <div class="tx-item-summary" ${tx.status === 'canceled' ? 'style="text-decoration: line-through; color: var(--text-light);"' : ''}>
                <span>Total</span>
                <span>Rp ${tx.total_price.toLocaleString('id-ID')}</span>
            </div>
        `;
        txList.appendChild(li);
    });

    if (txDailyTotal) {
        txDailyTotal.textContent = `Rp ${dailyTotal.toLocaleString('id-ID')}`;
    }
}

// Event Listeners for Transaction Modal
btnTransactions.addEventListener('click', openTxModal);
closeTxBtn.addEventListener('click', closeTxModal);
txOverlay.addEventListener('click', closeTxModal);
txDateInput.addEventListener('change', (e) => fetchTransactions(e.target.value));

// ---- Init ----
fetchMenu();