
const supabaseUrl = 'https://elcadzmmchsntsvxiszb.supabase.co';
const supabaseKey = 'sb_publishable_L4Pvc1F_U2AuaMszD2cceQ_ll_dkDLs';
const client = supabase.createClient(supabaseUrl, supabaseKey);

// Hapus const menuItems yang lama
let menuItems = [];

// Fungsi baru untuk ambil menu dari database
async function fetchMenu() {
    const { data, error } = await client
        .from('menu')
        .select('*')
        .order('category', { ascending: true }); // Mengurutkan berdasarkan kategori

    if (error) {
        console.error("Gagal mengambil menu:", error);
        alert("Gagal memuat menu dari database.");
        return;
    }

    menuItems = data;
    renderMenu(); // Jalankan render setelah data didapat
}

// Panggil fetchMenu saat aplikasi pertama kali dimuat
fetchMenu();
// Configuration for Vercel backend URL
const BACKEND_URL = "https://chasierkebabckl.vercel.app/api/checkout";

let cart = [];

const menuContainer = document.getElementById("menu-container");
const cartList = document.getElementById("cart-list");
const totalPriceEl = document.getElementById("total-price");
const paymentInput = document.getElementById("payment-amount");
const changeAmountEl = document.getElementById("change-amount");
const processBtn = document.getElementById("process-btn");


function renderMenu() {
    menuContainer.innerHTML = "";

    // Kelompokkan berdasarkan kategori (opsional tapi disarankan)
    const categories = [...new Set(menuItems.map(item => item.category))];

    categories.forEach(cat => {
        const catTitle = document.createElement("h3");
        catTitle.textContent = cat;
        catTitle.style.width = "100%";
        menuContainer.appendChild(catTitle);

        menuItems.filter(i => i.category === cat).forEach(item => {
            const itemEl = document.createElement("div");
            itemEl.className = "menu-item";
            itemEl.innerHTML = `
                <h4>${item.name}</h4>
                <p class="price">Rp ${item.price.toLocaleString('id-ID')}</p>
            `;
            itemEl.addEventListener("click", () => addToCart(item));
            menuContainer.appendChild(itemEl);
        });
    });
}

// Tambahkan fungsi addToCart agar tidak error saat menu diklik
function addToCart(item) {
    const existing = cart.find(i => i.id === item.id);
    if (existing) {
        existing.quantity += 1;
    } else {
        cart.push({ ...item, quantity: 1 });
    }
    renderCart();
}

// Update cart display and calculations
function renderCart() {
    cartList.innerHTML = "";
    let total = 0;

    cart.forEach(item => {
        total += item.price * item.quantity;
        const li = document.createElement("li");
        li.className = "cart-item";
        li.innerHTML = `
            <div class="cart-item-details">
                <div>${item.name}</div>
                <small>Rp ${item.price.toLocaleString('id-ID')} x ${item.quantity}</small>
            </div>
            <div class="cart-item-actions">
                <button onclick="changeQuantity(${item.id}, -1)">-</button>
                <button onclick="changeQuantity(${item.id}, 1)">+</button>
            </div>
        `;
        cartList.appendChild(li);
    });

    totalPriceEl.textContent = `Rp ${total.toLocaleString('id-ID')}`;
    calculateChange();
}

// Adjust item quantity in cart
window.changeQuantity = function (id, delta) {
    const item = cart.find(cartItem => cartItem.id === id);
    if (item) {
        item.quantity += delta;
        if (item.quantity <= 0) {
            cart = cart.filter(cartItem => cartItem.id !== id);
        }
    }
    renderCart();
};

// Calculate change amount based on payment input
function calculateChange() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change = payment - total;

    if (total > 0 && payment >= total) {
        changeAmountEl.textContent = `Rp ${change.toLocaleString('id-ID')}`;
        processBtn.disabled = false;
    } else {
        changeAmountEl.textContent = "Rp 0";
        processBtn.disabled = true;
    }
}

paymentInput.addEventListener("input", calculateChange);

// Send transaction data to Express.js backend
async function processOrder() {
    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const payment = parseFloat(paymentInput.value) || 0;
    const change = payment - total;

    const orderData = {
        items: cart,
        total_price: total,
        payment_amount: payment,
        change_amount: change,
        timestamp: new Date().toISOString()
    };

    try {
        processBtn.disabled = true;
        processBtn.textContent = "Memproses...";

        const response = await fetch(BACKEND_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(orderData)
        });

        if (response.ok) {
            alert("Transaksi Berhasil Diproses!");
            cart = [];
            paymentInput.value = "";
            renderCart();
        } else {
            alert("Gagal memproses transaksi ke server.");
        }
    } catch (error) {
        console.error("Error connecting to backend:", error);
        alert("Terjadi kesalahan jaringan saat menghubungi server.");
    } finally {
        processBtn.textContent = "Proses Pesanan";
        processBtn.disabled = false;
    }
}

processBtn.addEventListener("click", processOrder);

// Initialize application
renderMenu();