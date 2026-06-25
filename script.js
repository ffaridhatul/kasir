// Mock menu data for Kebab Chicken Larva
const menuItems = [
    { id: 1, name: "Kebab Chicken Larva S", price: 11000 },
    { id: 2, name: "Kebab Chicken Larva M", price: 14000 },
    { id: 3, name: "Kebab Chicken Larva L", price: 17000 },
    { id: 4, name: "Kebab Banner Cheese", price: 16000 },
    { id: 5, name: "Burger Chicken Larva", price: 13000 },
    { id: 6, name: "Sosis Bakar Larva", price: 10000 }
];

// Configuration for Vercel backend URL
const BACKEND_URL = "https://chasierkebabckl.vercel.app/api/checkout";

let cart = [];

const menuContainer = document.getElementById("menu-container");
const cartList = document.getElementById("cart-list");
const totalPriceEl = document.getElementById("total-price");
const paymentInput = document.getElementById("payment-amount");
const changeAmountEl = document.getElementById("change-amount");
const processBtn = document.getElementById("process-btn");

// Display menu items to the grid
function renderMenu() {
    menuContainer.innerHTML = "";
    menuItems.forEach(item => {
        const itemEl = document.createElement("div");
        itemEl.className = "menu-item";
        itemEl.innerHTML = `
            <h3>${item.name}</h3>
            <p class="price">Rp ${item.price.toLocaleString('id-ID')}</p>
        `;
        itemEl.addEventListener("click", () => addToCart(item));
        menuContainer.appendChild(itemEl);
    });
}

// Add item to shopping cart
function addToCart(item) {
    const existingItem = cart.find(cartItem => cartItem.id === item.id);
    if (existingItem) {
        existingItem.quantity += 1;
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
window.changeQuantity = function(id, delta) {
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