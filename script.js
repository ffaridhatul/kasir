/* ============================================
   Kebab Chicken Lava — POS Script
   ============================================ */

const supabaseUrl = 'https://elcadzmmchsntsvxiszb.supabase.co';
const supabaseKey = 'sb_publishable_L4Pvc1F_U2AuaMszD2cceQ_ll_dkDLs';
const client = supabase.createClient(supabaseUrl, supabaseKey);

const BACKEND_URL = "https://chasierkebabckl.vercel.app/api/checkout";

// ---- State ----
let menuItems   = [];
let cart        = [];
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
const cartList      = document.getElementById('cart-list');
const cartEmpty     = document.getElementById('cart-empty');
const totalPriceEl  = document.getElementById('total-price');
const itemCountEl   = document.getElementById('item-count');
const paymentInput  = document.getElementById('payment-amount');
const changeAmountEl = document.getElementById('change-amount');
const processBtn    = document.getElementById('process-btn');
const cartBadge     = document.getElementById('cart-badge');
const categoryTabs  = document.getElementById('category-tabs');
const searchInput   = document.getElementById('search-input');
const cartPanel     = document.getElementById('cart-panel');
const overlay       = document.getElementById('overlay');
const cartToggleBtn = document.getElementById('cart-toggle-btn');
const closeCartBtn  = document.getElementById('close-cart-btn');
const toast         = document.getElementById('toast');

// ---- Fetch Menu ----
async function fetchMenu() {
    try {
        const { data, error } = await client
            .from('menu')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;
        menuItems = data;
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
        const matchCat  = activeCategory === 'all' || item.category === activeCategory;
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
            el.className = 'menu-item';

            // Check if item already in cart
            const inCart = cart.find(c => c.id === item.id);

            el.innerHTML = `
                <div class="menu-item-emoji">${getEmoji(item)}</div>
                <h4>${item.name}</h4>
                <p class="price">Rp ${item.price.toLocaleString('id-ID')}</p>
                <span class="add-hint">${inCart ? `+${inCart.quantity} di keranjang` : 'Ketuk untuk tambah'}</span>
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

window.changeQuantity = function(id, delta) {
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

    totalPriceEl.textContent  = `Rp ${total.toLocaleString('id-ID')}`;
    itemCountEl.textContent   = `${totalItems} item`;
    calculateChange();
}

// ---- Change Calculation ----
function calculateChange() {
    const total   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change  = payment - total;

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

// ---- Process Order ----
async function processOrder() {
    const total   = cart.reduce((s, i) => s + i.price * i.quantity, 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change  = payment - total;

    const orderData = {
        items: cart,
        total_price: total,
        payment_amount: payment,
        change_amount: change,
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
            renderCart();
            updateCartBadge(false);
            renderMenu();
            showToast('Transaksi berhasil diproses!');
            // close mobile drawer if open
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
        calculateChange(); // re-enable if needed
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

// ---- Init ----
fetchMenu();