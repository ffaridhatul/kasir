// Check user session
const userSession = JSON.parse(localStorage.getItem('kebab_user_session'));
if (!userSession) {
    window.location.href = 'login.html';
}

const API_MENU_URL = "https://chasierkebabckl.vercel.app/api/menu";
const API_USERS_URL = "https://chasierkebabckl.vercel.app/api/users";
const API_TX_URL = "https://chasierkebabckl.vercel.app/api/transactions";

// --- Global DOM ---
const toast = document.getElementById('toast');
let toastTimer;
function showToast(msg, isError = false) {
    if (!toast) return;
    toast.textContent = msg;
    toast.style.background = isError ? '#dc2626' : '#16a34a';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

// ==========================================
// ROLE BASED ACCESS CONTROL (UI)
// ==========================================
if (userSession.role_type === 'kasir') {
    // Hide unauthorized modules from sidebar
    document.querySelector('[data-target="modul-menu"]').style.display = 'none';
    document.querySelector('[data-target="modul-users"]').style.display = 'none';
    document.querySelector('[data-target="modul-expenses"]').style.display = 'none';
    document.querySelector('[data-target="modul-reports"]').style.display = 'none';

    // Force default active to transactions
    document.querySelector('[data-target="modul-menu"]').classList.remove('active');
    document.getElementById('modul-menu').classList.remove('active');
    
    document.querySelector('[data-target="modul-transactions"]').classList.add('active');
    document.getElementById('modul-transactions').classList.add('active');
}

// ==========================================
// TRANSACTIONS MANAGEMENT LOGIC
// ==========================================
const txDateInput = document.getElementById('admin-tx-date');
const txList = document.getElementById('admin-tx-list');

// Default to today
if (txDateInput) {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    txDateInput.value = `${y}-${m}-${d}`;

    txDateInput.addEventListener('change', () => fetchAdminTransactions(txDateInput.value));
}

async function fetchAdminTransactions(dateStr = txDateInput.value) {
    if(!txList) return;
    try {
        const [y, m, d] = dateStr.split('-');
        const startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        const endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

        const response = await fetch(`${API_TX_URL}?start=${startDate}&end=${endDate}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message);
        renderAdminTransactions(result.data);
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        showToast('Gagal memuat transaksi', true);
    }
}

function renderAdminTransactions(data) {
    txList.innerHTML = '';
    
    if(data.length === 0) {
        txList.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 20px; color: var(--text-muted);">Tidak ada transaksi pada tanggal ini.</td></tr>`;
        return;
    }

    data.forEach(tx => {
        const dateObj = new Date(tx.created_datetime);
        const timeStr = dateObj.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        
        let items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
        let itemsHtml = items.map(i => `${i.quantity}x ${i.name}`).join('<br>');
        
        // Status Badge Logic
        let statusBadge = '';
        let actionButtons = '';
        
        if (tx.status === 'pending') {
            statusBadge = `<span style="background: #fef08a; color: #854d0e; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">Menunggu</span>`;
            actionButtons = `
                <div style="display: flex; gap: 4px; justify-content: center;">
                    <button onclick="updateTxStatus(${tx.id}, 'completed')" style="padding: 4px 8px; background: #16a34a; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Selesai</button>
                    <button onclick="updateTxStatus(${tx.id}, 'canceled')" style="padding: 4px 8px; background: var(--red); color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.8rem;">Batal</button>
                </div>
            `;
        } else if (tx.status === 'completed') {
            statusBadge = `<span style="background: #bbf7d0; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">Selesai</span>`;
            actionButtons = `<span style="font-size: 0.8rem; color: var(--text-muted);">-</span>`;
        } else if (tx.status === 'canceled') {
            statusBadge = `<span style="background: #fecaca; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: 700;">Dibatalkan</span>`;
            actionButtons = `<span style="font-size: 0.8rem; color: var(--text-muted);">-</span>`;
        }

        const customerInfo = tx.customer_name ? `<b>${tx.customer_name}</b>` : '<i style="color: var(--text-muted);">Tanpa nama</i>';
        const notesInfo = tx.notes ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 4px;">Catatan: ${tx.notes}</div>` : '';
        const cancelReasonHtml = (tx.status === 'canceled' && tx.cancel_reason) ? `<div style="font-size: 0.75rem; color: var(--red); margin-top: 4px;">Alasan: ${tx.cancel_reason}</div>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top;">
                <b>#${tx.id}</b><br><span style="font-size: 0.8rem; color: var(--text-muted);">${timeStr}</span><br>
                <span style="font-size: 0.75rem; color: var(--text-muted);">Oleh: ${tx.cashier_name}</span>
            </td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top;">
                ${customerInfo}
                ${notesInfo}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top; font-size: 0.8rem;">${itemsHtml}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top; font-weight: 600;">Rp ${tx.total_price.toLocaleString('id-ID')}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); vertical-align: top;">
                ${statusBadge}
                ${cancelReasonHtml}
            </td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center; vertical-align: top;">
                ${actionButtons}
            </td>
        `;
        txList.appendChild(tr);
    });
}

window.updateTxStatus = async function(id, status) {
    let cancelReason = null;
    
    // Wajib isi catatan jika batal
    if (status === 'canceled') {
        cancelReason = prompt('Masukkan alasan pembatalan pesanan ini:');
        if (!cancelReason || cancelReason.trim() === '') {
            alert('Alasan pembatalan wajib diisi! Proses dibatalkan.');
            return;
        }
    } else if (status === 'completed') {
        if (!confirm('Tandai pesanan ini sebagai selesai?')) return;
    }

    try {
        const response = await fetch(`${API_TX_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, cancel_reason: cancelReason })
        });
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        showToast(`Pesanan ${status === 'completed' ? 'diselesaikan' : 'dibatalkan'}!`);
        fetchAdminTransactions(); // Refresh table
    } catch (err) {
        console.error("Update Status Error:", err);
        showToast('Gagal mengubah status pesanan', true);
    }
}

// ==========================================
// MENU MANAGEMENT LOGIC
// ==========================================
const menuForm = document.getElementById('admin-menu-form');
const inputId = document.getElementById('admin-id');
const inputCategory = document.getElementById('admin-category');
const inputName = document.getElementById('admin-name');
const inputPrice = document.getElementById('admin-price');
const menuList = document.getElementById('admin-menu-list');
const btnCancel = document.getElementById('admin-cancel-btn');

async function fetchAdminMenu() {
    if(!menuList) return;
    try {
        const response = await fetch(API_MENU_URL);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        renderAdminMenu(result.data);
    } catch (err) {
        console.error("Fetch Menu Error:", err);
    }
}

function renderAdminMenu(data) {
    menuList.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid var(--border);">${item.category}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border);">${item.name}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border);">Rp ${item.price.toLocaleString('id-ID')}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center;">
                <button type="button" onclick="editMenu(${item.id}, '${item.category}', '${item.name}', ${item.price})" style="padding: 4px 8px; margin-right: 4px; cursor: pointer; border: 1px solid var(--border); background: var(--white); border-radius: 4px;">Edit</button>
                <button type="button" onclick="deleteMenu(${item.id})" style="padding: 4px 8px; color: var(--red); cursor: pointer; border: 1px solid var(--red); background: var(--white); border-radius: 4px;">Delete</button>
            </td>
        `;
        menuList.appendChild(tr);
    });
}

if(menuForm) {
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = inputId.value;
        const payload = { category: inputCategory.value, name: inputName.value, price: parseInt(inputPrice.value) };

        try {
            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_MENU_URL}/${id}` : API_MENU_URL;
            const response = await fetch(url, {
                method: method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showToast(id ? 'Menu diperbarui' : 'Menu ditambahkan');
            resetForm();
            fetchAdminMenu();
        } catch (err) {
            console.error("Save Menu Error:", err);
            showToast('Gagal menyimpan menu', true);
        }
    });
}

window.editMenu = function (id, category, name, price) {
    inputId.value = id; inputCategory.value = category; inputName.value = name; inputPrice.value = price;
    btnCancel.style.display = 'block';
};

window.deleteMenu = async function (id) {
    if (!confirm('Hapus menu ini?')) return;
    try {
        await fetch(`${API_MENU_URL}/${id}`, { method: 'DELETE' });
        showToast('Menu dihapus');
        fetchAdminMenu();
    } catch (err) {
        showToast('Gagal hapus menu', true);
    }
};

function resetForm() {
    if(inputId) inputId.value = '';
    if(inputCategory) inputCategory.value = '';
    if(inputName) inputName.value = '';
    if(inputPrice) inputPrice.value = '';
    if(btnCancel) btnCancel.style.display = 'none';
}
if(btnCancel) btnCancel.addEventListener('click', resetForm);

// ==========================================
// USERS MANAGEMENT LOGIC
// ==========================================
const userForm = document.getElementById('admin-user-form');
const inputUserName = document.getElementById('admin-user-name');
const inputUserPassword = document.getElementById('admin-user-password');
const inputUserRole = document.getElementById('admin-user-role');
const userList = document.getElementById('admin-user-list');
const optionAdminRole = document.getElementById('option-admin-role');

if (userSession.role_type === 'admin' && optionAdminRole) {
    optionAdminRole.style.display = 'none';
}

async function fetchAdminUsers() {
    if(!userList) return;
    try {
        const response = await fetch(API_USERS_URL);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        renderAdminUsers(result.data);
    } catch (err) {
        console.error("Fetch Users Error:", err);
    }
}

function renderAdminUsers(data) {
    if(!userList) return;
    userList.innerHTML = '';
    data.forEach(user => {
        let deleteBtnHtml = '';
        const isAdminTryingToDeleteOwner = userSession.role_type === 'admin' && user.role_type === 'owner';
        const isSelf = userSession.id === user.id;

        if (!isAdminTryingToDeleteOwner && !isSelf) {
            deleteBtnHtml = `<button type="button" onclick="deleteUser(${user.id})" style="padding: 4px 8px; color: var(--red); cursor: pointer; border: 1px solid var(--red); background: var(--white); border-radius: 4px;">Delete</button>`;
        }

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding: 10px; border-bottom: 1px solid var(--border);">${user.id}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border);">${user.username}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); text-transform: capitalize;">${user.role_type}</td>
            <td style="padding: 10px; border-bottom: 1px solid var(--border); text-align: center;">${deleteBtnHtml}</td>
        `;
        userList.appendChild(tr);
    });
}

if(userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            username: inputUserName.value, password: inputUserPassword.value, 
            role_type: inputUserRole.value, requestor_role: userSession.role_type
        };

        try {
            const response = await fetch(API_USERS_URL, {
                method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showToast('User berhasil ditambahkan');
            inputUserName.value = ''; inputUserPassword.value = '';
            fetchAdminUsers();
        } catch (err) {
            showToast(err.message || 'Gagal menyimpan user', true);
        }
    });
}

window.deleteUser = async function (id) {
    if (!confirm('Yakin ingin menghapus user ini?')) return;
    try {
        const response = await fetch(`${API_USERS_URL}/${id}?requestor_role=${userSession.role_type}`, { method: 'DELETE' });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        showToast('User dihapus');
        fetchAdminUsers();
    } catch (err) {
        showToast(err.message || 'Gagal menghapus user', true);
    }
};

// ==========================================
// NAVIGATION & INIT
// ==========================================
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
        const target = item.getAttribute('data-target');
        
        if (target === 'modul-kasir') {
            window.location.href = 'index.html';
            return;
        }

        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        document.querySelectorAll('.modul-section').forEach(section => {
            if (section.id === target) section.classList.add('active');
            else section.classList.remove('active');
        });
    });
});

// Init available modules based on role
if (userSession.role_type !== 'kasir') {
    fetchAdminMenu();
    fetchAdminUsers();
}
fetchAdminTransactions();