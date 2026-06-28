// ==========================================
// SESSION CHECK
// ==========================================
const userSession = JSON.parse(localStorage.getItem('kebab_user_session'));
if (!userSession) {
    window.location.href = 'login.html';
}

// ==========================================
// API URLS — semua request lewat backend Vercel
// Tidak ada Supabase credentials di file ini
// ==========================================
const API_BASE       = "https://chasierkebabckl.vercel.app/api";
const API_MENU_URL   = `${API_BASE}/menu`;
const API_UPLOAD_URL = `${API_BASE}/menu/upload`; // endpoint upload baru
const API_USERS_URL  = `${API_BASE}/users`;
const API_TX_URL     = `${API_BASE}/transactions`;

// ==========================================
// GLOBAL — TOAST NOTIFICATION
// ==========================================
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
    // Sembunyikan modul yang tidak boleh diakses kasir
    document.querySelector('[data-target="modul-menu"]').style.display = 'none';
    document.querySelector('[data-target="modul-users"]').style.display = 'none';
    document.querySelector('[data-target="modul-expenses"]').style.display = 'none';
    document.querySelector('[data-target="modul-reports"]').style.display = 'none';

    // Default aktifkan modul transaksi untuk kasir
    document.querySelector('[data-target="modul-menu"]').classList.remove('active');
    document.getElementById('modul-menu').classList.remove('active');
    document.querySelector('[data-target="modul-transactions"]').classList.add('active');
    document.getElementById('modul-transactions').classList.add('active');
}

// ==========================================
// TRANSACTIONS MANAGEMENT
// ==========================================
const txDateInput = document.getElementById('admin-tx-date');
const txList      = document.getElementById('admin-tx-list');

if (txDateInput) {
    const now = new Date();
    txDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    txDateInput.addEventListener('change', () => fetchAdminTransactions(txDateInput.value));
}

async function fetchAdminTransactions(dateStr = txDateInput.value) {
    if (!txList) return;
    try {
        const [y, m, d] = dateStr.split('-');
        const startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        const endDate   = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

        const response = await fetch(`${API_TX_URL}?start=${startDate}&end=${endDate}`);
        const result   = await response.json();

        if (!result.success) throw new Error(result.message);
        renderAdminTransactions(result.data);
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        showToast('Gagal memuat transaksi', true);
    }
}

function renderAdminTransactions(data) {
    txList.innerHTML = '';

    if (data.length === 0) {
        txList.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:20px; color:var(--text-muted);">Tidak ada transaksi pada tanggal ini.</td></tr>`;
        return;
    }

    data.forEach(tx => {
        const timeStr    = new Date(tx.created_datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const items      = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
        const itemsHtml  = items.map(i => `${i.quantity}x ${i.name}`).join('<br>');

        let statusBadge  = '';
        let actionButtons = '';

        if (tx.status === 'pending') {
            statusBadge   = `<span style="background:#fef08a; color:#854d0e; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">Menunggu</span>`;
            actionButtons = `
                <div style="display:flex; gap:4px; justify-content:center;">
                    <button onclick="updateTxStatus(${tx.id}, 'completed')" style="padding:4px 8px; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">Selesai</button>
                    <button onclick="updateTxStatus(${tx.id}, 'canceled')"  style="padding:4px 8px; background:var(--red); color:white; border:none; border-radius:4px; cursor:pointer; font-size:0.8rem;">Batal</button>
                </div>`;
        } else if (tx.status === 'completed') {
            statusBadge   = `<span style="background:#bbf7d0; color:#166534; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">Selesai</span>`;
            actionButtons = `<span style="font-size:0.8rem; color:var(--text-muted);">-</span>`;
        } else if (tx.status === 'canceled') {
            statusBadge   = `<span style="background:#fecaca; color:#991b1b; padding:4px 8px; border-radius:4px; font-size:0.75rem; font-weight:700;">Dibatalkan</span>`;
            actionButtons = `<span style="font-size:0.8rem; color:var(--text-muted);">-</span>`;
        }

        const customerInfo     = tx.customer_name ? `<b>${tx.customer_name}</b>` : '<i style="color:var(--text-muted);">Tanpa nama</i>';
        const notesHtml        = tx.notes ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">Catatan: ${tx.notes}</div>` : '';
        const cancelReasonHtml = (tx.status === 'canceled' && tx.cancel_reason) ? `<div style="font-size:0.75rem; color:var(--red); margin-top:4px;">Alasan: ${tx.cancel_reason}</div>` : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid var(--border); vertical-align:top;">
                <b>#${tx.id}</b><br>
                <span style="font-size:0.8rem; color:var(--text-muted);">${timeStr}</span><br>
                <span style="font-size:0.75rem; color:var(--text-muted);">Oleh: ${tx.cashier_name}</span>
            </td>
            <td style="padding:10px; border-bottom:1px solid var(--border); vertical-align:top;">${customerInfo}${notesHtml}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); vertical-align:top; font-size:0.8rem;">${itemsHtml}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); vertical-align:top; font-weight:600;">Rp ${tx.total_price.toLocaleString('id-ID')}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); vertical-align:top;">${statusBadge}${cancelReasonHtml}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); text-align:center; vertical-align:top;">${actionButtons}</td>
        `;
        txList.appendChild(tr);
    });
}

window.updateTxStatus = async function (id, status) {
    let cancelReason = null;

    if (status === 'canceled') {
        cancelReason = prompt('Masukkan alasan pembatalan pesanan ini:');
        if (!cancelReason || cancelReason.trim() === '') {
            alert('Alasan pembatalan wajib diisi!');
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
        fetchAdminTransactions();
    } catch (err) {
        console.error("Update Status Error:", err);
        showToast('Gagal mengubah status pesanan', true);
    }
};

// ==========================================
// MENU MANAGEMENT
// ==========================================
const menuForm     = document.getElementById('admin-menu-form');
const inputId      = document.getElementById('admin-id');
const inputCategory = document.getElementById('admin-category');
const inputName    = document.getElementById('admin-name');
const inputPrice   = document.getElementById('admin-price');
const menuList     = document.getElementById('admin-menu-list');
const btnCancel    = document.getElementById('admin-cancel-btn');

// --- Fetch & Render ---
async function fetchAdminMenu() {
    if (!menuList) return;
    try {
        const response = await fetch(API_MENU_URL);
        const result   = await response.json();
        if (!result.success) throw new Error(result.message);
        renderAdminMenu(result.data);
    } catch (err) {
        console.error("Fetch Menu Error:", err);
        showToast('Gagal memuat menu', true);
    }
}

function renderAdminMenu(data) {
    menuList.innerHTML = '';
    data.forEach(item => {
        // Escape single quote pada string agar tidak merusak inline onclick
        const safeCat  = (item.category || '').replace(/'/g, "\\'");
        const safeName = (item.name || '').replace(/'/g, "\\'");
        const safeUrl  = (item.image_url || '').replace(/'/g, "\\'");

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid var(--border);">${item.category}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${item.name}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">Rp ${item.price.toLocaleString('id-ID')}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); text-align:center;">
                <button type="button"
                    onclick="editMenu(${item.id}, '${safeCat}', '${safeName}', ${item.price}, '${safeUrl}')"
                    style="padding:4px 8px; margin-right:4px; cursor:pointer; border:1px solid var(--border); background:var(--white); border-radius:4px;">
                    Edit
                </button>
                <button type="button"
                    onclick="deleteMenu(${item.id})"
                    style="padding:4px 8px; color:var(--red); cursor:pointer; border:1px solid var(--red); background:var(--white); border-radius:4px;">
                    Delete
                </button>
            </td>
        `;
        menuList.appendChild(tr);
    });
}

// --- Upload Foto ke Backend (bukan Base64, bukan Supabase langsung) ---
// File dikirim sebagai FormData → /api/menu/upload → Vercel → Supabase Storage
// Credentials Supabase tidak pernah keluar dari server
async function uploadMenuImage(file) {
    const formData = new FormData();
    formData.append('image', file); // key 'image' sesuai multer di backend

    // PENTING: Jangan set Content-Type header secara manual
    // Browser akan otomatis set 'multipart/form-data' beserta boundary yang benar
    const response = await fetch(API_UPLOAD_URL, {
        method: 'POST',
        body: formData
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message);

    // result.imageUrl = public URL dari Supabase Storage CDN
    // Contoh: "https://xxxx.supabase.co/storage/v1/object/public/menu-images/menu_1234.jpeg"
    return result.imageUrl;
}

// --- Hapus file lama dari Storage (saat edit dengan foto baru) ---
async function deleteOldImage(imageUrl) {
    if (!imageUrl) return;

    // Ekstrak nama file dari URL
    // "https://xxxx.supabase.co/storage/v1/object/public/menu-images/menu_1234.jpeg"
    // → filePath = "menu_1234.jpeg"
    const parts = imageUrl.split('/menu-images/');
    if (parts.length !== 2) return;

    const filePath = parts[1];

    // Fire-and-forget: tidak perlu blok jika gagal
    try {
        await fetch(API_UPLOAD_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath })
        });
    } catch (err) {
        console.warn("Gagal hapus foto lama dari storage (non-critical):", err.message);
    }
}

// --- Form Submit (Tambah / Edit Menu) ---
if (menuForm) {
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id        = inputId.value;
        const fileInput = document.getElementById('menu-image');
        const saveBtn   = document.getElementById('admin-save-btn');

        // Ambil URL foto yang sudah ada (dari dataset saat mode edit)
        // Jika mode tambah baru → null
        let imageUrl = inputId.dataset.currentImage || null;

        // Jika user memilih foto baru → upload dulu ke storage
        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];

            if (file.size > 2 * 1024 * 1024) {
                showToast('Ukuran gambar maksimal 2MB!', true);
                return;
            }

            try {
                // Step 1: Feedback upload foto
                saveBtn.textContent = 'Mengupload foto...';
                saveBtn.disabled    = true;

                // Step 2: Hapus foto lama dari storage jika ada (mode edit)
                if (id && imageUrl) {
                    await deleteOldImage(imageUrl);
                }

                // Step 3: Upload foto baru → dapat URL baru
                imageUrl = await uploadMenuImage(file);

            } catch (err) {
                console.error("Upload Error:", err);
                showToast('Gagal upload foto: ' + err.message, true);
                saveBtn.textContent = 'Simpan';
                saveBtn.disabled    = false;
                return; // Hentikan jika upload gagal
            }
        }

        // Susun payload untuk disimpan ke database
        // image_url yang disimpan hanya URL pendek (bukan Base64)
        const payload = {
            category: inputCategory.value.trim(),
            name:     inputName.value.trim(),
            price:    parseInt(inputPrice.value)
        };

        // Hanya tambahkan image_url ke payload jika ada (tidak overwrite dengan null)
        if (imageUrl) {
            payload.image_url = imageUrl;
        }

        try {
            saveBtn.textContent = 'Menyimpan...';
            saveBtn.disabled    = true;

            const method   = id ? 'PUT' : 'POST';
            const url      = id ? `${API_MENU_URL}/${id}` : API_MENU_URL;
            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();

            if (!result.success) throw new Error(result.message);

            showToast(id ? 'Menu berhasil diperbarui' : 'Menu berhasil ditambahkan');
            resetMenuForm();
            fileInput.value = '';
            fetchAdminMenu();

        } catch (err) {
            console.error("Save Menu Error:", err);
            showToast('Gagal menyimpan menu: ' + err.message, true);
        } finally {
            saveBtn.textContent = 'Simpan';
            saveBtn.disabled    = false;
        }
    });
}

// --- Edit: isi form + simpan data foto lama ke dataset ---
window.editMenu = function (id, category, name, price, imageUrl) {
    inputId.value = id;
    inputId.dataset.currentImage = imageUrl || ''; // simpan URL foto lama

    inputCategory.value = category;
    inputName.value     = name;
    inputPrice.value    = price;

    if (btnCancel) btnCancel.style.display = 'block';

    // Tampilkan preview foto yang sudah ada
    const previewEl = document.getElementById('current-image-preview');
    if (previewEl) {
        if (imageUrl) {
            previewEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; margin-top:8px; padding:8px; background:var(--surface); border-radius:var(--radius-sm);">
                    <img src="${imageUrl}" alt="Foto saat ini"
                         style="height:50px; width:50px; border-radius:6px; object-fit:cover; border:1px solid var(--border);">
                    <small style="color:var(--text-muted); line-height:1.4;">
                        Foto saat ini.<br>Pilih file baru untuk mengganti, atau kosongkan untuk mempertahankan.
                    </small>
                </div>`;
        } else {
            previewEl.innerHTML = '';
        }
    }

    // Scroll ke form agar terlihat
    menuForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

// --- Delete Menu (termasuk cleanup foto di Storage via backend) ---
window.deleteMenu = async function (id) {
    if (!confirm('Hapus menu ini? Foto produk juga akan dihapus dari storage.')) return;
    try {
        // Backend DELETE /api/menu/:id sudah otomatis hapus foto dari storage
        const response = await fetch(`${API_MENU_URL}/${id}`, { method: 'DELETE' });
        const result   = await response.json();

        if (!result.success) throw new Error(result.message);

        showToast('Menu berhasil dihapus');
        fetchAdminMenu();
    } catch (err) {
        console.error("Delete Menu Error:", err);
        showToast('Gagal menghapus menu', true);
    }
};

// --- Reset Form ---
function resetMenuForm() {
    if (inputId) {
        inputId.value = '';
        inputId.dataset.currentImage = ''; // bersihkan URL lama
    }
    if (inputCategory) inputCategory.value = '';
    if (inputName)     inputName.value     = '';
    if (inputPrice)    inputPrice.value    = '';
    if (btnCancel)     btnCancel.style.display = 'none';

    const previewEl = document.getElementById('current-image-preview');
    if (previewEl) previewEl.innerHTML = '';
}

if (btnCancel) btnCancel.addEventListener('click', resetMenuForm);

// ==========================================
// USERS MANAGEMENT
// ==========================================
const userForm         = document.getElementById('admin-user-form');
const inputUserName    = document.getElementById('admin-user-name');
const inputUserPassword = document.getElementById('admin-user-password');
const inputUserRole    = document.getElementById('admin-user-role');
const userList         = document.getElementById('admin-user-list');
const optionAdminRole  = document.getElementById('option-admin-role');

// Sembunyikan opsi role 'admin' jika yang login adalah admin (bukan owner)
if (userSession.role_type === 'admin' && optionAdminRole) {
    optionAdminRole.style.display = 'none';
}

async function fetchAdminUsers() {
    if (!userList) return;
    try {
        const response = await fetch(API_USERS_URL);
        const result   = await response.json();
        if (!result.success) throw new Error(result.message);
        renderAdminUsers(result.data);
    } catch (err) {
        console.error("Fetch Users Error:", err);
        showToast('Gagal memuat daftar user', true);
    }
}

function renderAdminUsers(data) {
    if (!userList) return;
    userList.innerHTML = '';
    data.forEach(user => {
        const isAdminTryingToDeleteOwner = userSession.role_type === 'admin' && user.role_type === 'owner';
        const isSelf = userSession.id === user.id;

        const deleteBtnHtml = (!isAdminTryingToDeleteOwner && !isSelf)
            ? `<button type="button" onclick="deleteUser(${user.id})"
                   style="padding:4px 8px; color:var(--red); cursor:pointer; border:1px solid var(--red); background:var(--white); border-radius:4px;">
                   Delete
               </button>`
            : '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:10px; border-bottom:1px solid var(--border);">${user.id}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border);">${user.username}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); text-transform:capitalize;">${user.role_type}</td>
            <td style="padding:10px; border-bottom:1px solid var(--border); text-align:center;">${deleteBtnHtml}</td>
        `;
        userList.appendChild(tr);
    });
}

if (userForm) {
    userForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const payload = {
            username:       inputUserName.value,
            password:       inputUserPassword.value,
            role_type:      inputUserRole.value,
            requestor_role: userSession.role_type
        };

        try {
            const response = await fetch(API_USERS_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);

            showToast('User berhasil ditambahkan');
            inputUserName.value     = '';
            inputUserPassword.value = '';
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
        const result   = await response.json();
        if (!result.success) throw new Error(result.message);
        showToast('User berhasil dihapus');
        fetchAdminUsers();
    } catch (err) {
        showToast(err.message || 'Gagal menghapus user', true);
    }
};

// ==========================================
// NAVIGATION
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
            section.classList.toggle('active', section.id === target);
        });
    });
});

// ==========================================
// INIT — Load data saat halaman pertama dibuka
// ==========================================
if (userSession.role_type !== 'kasir') {
    fetchAdminMenu();
    fetchAdminUsers();
}
fetchAdminTransactions();