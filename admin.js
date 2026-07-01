// ==========================================
// SESSION CHECK
// ==========================================
const userSession = JSON.parse(localStorage.getItem('kebab_user_session'));
if (!userSession) {
    window.location.href = 'login.html';
}

// ==========================================
// API URLS
// ==========================================
const API_BASE = "https://chasierkebabckl.vercel.app/api";
const API_MENU_URL = `${API_BASE}/menu`;
const API_UPLOAD_URL = `${API_BASE}/menu/upload`;
const API_USERS_URL = `${API_BASE}/users`;
const API_TX_URL = `${API_BASE}/transactions`;

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
// CUSTOM CONFIRM MODAL
// Menggantikan browser native confirm() / alert() / prompt()
// Usage: showConfirm({ ... }).then(result => { ... })
// ==========================================
const confirmOverlay = document.getElementById('confirm-overlay');
const confirmTitle = document.getElementById('confirm-title');
const confirmMessage = document.getElementById('confirm-message');
const confirmOrderInfo = document.getElementById('confirm-order-info');
const confirmReasonArea = document.getElementById('confirm-reason-area');
const confirmReasonInput = document.getElementById('confirm-reason-input');
const confirmIconCircle = document.getElementById('confirm-icon-circle');
const confirmIconEmoji = document.getElementById('confirm-icon-emoji');
const confirmBtnBatal = document.getElementById('confirm-btn-batal');
const confirmBtnOk = document.getElementById('confirm-btn-ok');

let _confirmResolve = null;

/**
 * Tampilkan modal konfirmasi custom.
 * @param {Object} opts
 * @param {string} opts.title         - Judul modal
 * @param {string} opts.message       - Pesan deskripsi
 * @param {string} [opts.orderInfo]   - Ringkasan info pesanan (opsional)
 * @param {boolean} [opts.needReason] - Apakah perlu input alasan?
 * @param {'green'|'danger'} [opts.variant] - Warna icon
 * @param {string} [opts.okLabel]     - Teks tombol OK
 * @param {string} [opts.icon]        - Emoji icon
 * @returns {Promise<{confirmed: boolean, reason?: string}>}
 */
function showConfirm(opts = {}) {
    return new Promise((resolve) => {
        _confirmResolve = resolve;

        // Isi konten modal
        confirmTitle.textContent = opts.title || 'Konfirmasi';
        confirmMessage.textContent = opts.message || 'Apakah Anda yakin?';

        // Order info (ringkasan pesanan)
        if (opts.orderInfo) {
            confirmOrderInfo.innerHTML = opts.orderInfo;
            confirmOrderInfo.style.display = 'block';
        } else {
            confirmOrderInfo.style.display = 'none';
        }

        // Reason area (untuk cancel)
        if (opts.needReason) {
            confirmReasonArea.classList.add('show');
            confirmReasonInput.value = '';
            // Focus setelah animasi
            setTimeout(() => confirmReasonInput.focus(), 280);
        } else {
            confirmReasonArea.classList.remove('show');
            confirmReasonInput.value = '';
        }

        // Icon & warna
        const variant = opts.variant || 'green';
        confirmIconCircle.className = `confirm-icon-circle ${variant}`;
        confirmIconEmoji.textContent = opts.icon || (variant === 'danger' ? '🚫' : '✅');

        // Tombol OK styling
        confirmBtnOk.textContent = opts.okLabel || 'Ya, Lanjutkan';
        confirmBtnOk.className = variant === 'danger'
            ? 'btn-confirm-ok-red'
            : 'btn-confirm-ok-green';

        // Tampilkan modal
        confirmOverlay.classList.add('show');
    });
}

function closeConfirm() {
    confirmOverlay.classList.remove('show');
    _confirmResolve = null;
}

// Event listener tombol modal
confirmBtnBatal.addEventListener('click', () => {
    if (_confirmResolve) _confirmResolve({ confirmed: false });
    closeConfirm();
});

confirmBtnOk.addEventListener('click', () => {
    // Jika perlu alasan, validasi dulu
    if (confirmReasonArea.classList.contains('show')) {
        const reason = confirmReasonInput.value.trim();
        if (!reason) {
            confirmReasonInput.style.borderColor = 'var(--red)';
            confirmReasonInput.focus();
            setTimeout(() => {
                confirmReasonInput.style.borderColor = '';
            }, 1500);
            return;
        }
        if (_confirmResolve) _confirmResolve({ confirmed: true, reason });
    } else {
        if (_confirmResolve) _confirmResolve({ confirmed: true });
    }
    closeConfirm();
});

// Tutup jika klik overlay
confirmOverlay.addEventListener('click', (e) => {
    if (e.target === confirmOverlay) {
        if (_confirmResolve) _confirmResolve({ confirmed: false });
        closeConfirm();
    }
});

// Tutup dengan Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && confirmOverlay.classList.contains('show')) {
        if (_confirmResolve) _confirmResolve({ confirmed: false });
        closeConfirm();
    }
});

// ==========================================
// ROLE BASED ACCESS CONTROL (UI)
// ==========================================
if (userSession.role_type === 'kasir') {
    document.querySelector('[data-target="modul-menu"]').style.display = 'none';
    document.querySelector('[data-target="modul-users"]').style.display = 'none';
    document.querySelector('[data-target="modul-expenses"]').style.display = 'none';
    document.querySelector('[data-target="modul-reports"]').style.display = 'none';
}

// Default: semua role masuk ke Kelola Transaksi saat buka halaman admin
document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
document.querySelectorAll('.modul-section').forEach(s => s.classList.remove('active'));
document.querySelector('[data-target="modul-transactions"]').classList.add('active');
document.getElementById('modul-transactions').classList.add('active');

// ==========================================
// TRANSACTIONS MANAGEMENT
// ==========================================
const txDateInput = document.getElementById('admin-tx-date');
const txList = document.getElementById('admin-tx-list');       // tabel desktop
const txCardContainer = document.getElementById('admin-tx-cards');      // card mobile
const txEmptyState = document.getElementById('tx-empty-state');
const txLoadingSkeleton = document.getElementById('tx-loading-skeleton');

// Stat elements
const statTotalOmset = document.getElementById('stat-total-omset');
const statCompleted = document.getElementById('stat-completed');
const statPending = document.getElementById('stat-pending');

if (txDateInput) {
    const now = new Date();
    txDateInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    txDateInput.addEventListener('change', () => fetchAdminTransactions(txDateInput.value));
}

// ---- Payment Method Filter ----
let activePaymentFilter = 'all';
let allTxData = []; // cache raw data for client-side filtering

document.querySelectorAll('.pay-filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.pay-filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        activePaymentFilter = btn.dataset.method;
        applyPaymentFilter();
    });
});

function applyPaymentFilter() {
    const filtered = activePaymentFilter === 'all'
        ? allTxData
        : allTxData.filter(tx => (tx.payment_method || 'tunai') === activePaymentFilter);
    renderAdminTransactions(filtered);
}

async function fetchAdminTransactions(dateStr = txDateInput.value) {
    if (!txList && !txCardContainer) return;

    // Tampilkan skeleton, sembunyikan empty state
    if (txLoadingSkeleton) txLoadingSkeleton.style.display = 'flex';
    if (txEmptyState) txEmptyState.classList.remove('show');

    try {
        const [y, m, d] = dateStr.split('-');
        const startDate = new Date(y, m - 1, d, 0, 0, 0, 0).toISOString();
        const endDate = new Date(y, m - 1, d, 23, 59, 59, 999).toISOString();

        const response = await fetch(`${API_TX_URL}?start=${startDate}&end=${endDate}`);
        const result = await response.json();

        if (!result.success) throw new Error(result.message);
        allTxData = result.data;
        applyPaymentFilter();
    } catch (err) {
        console.error("Fetch Transactions Error:", err);
        showToast('Gagal memuat transaksi', true);
        if (txLoadingSkeleton) txLoadingSkeleton.style.display = 'none';
    }
}

function renderAdminTransactions(data) {
    // Sembunyikan skeleton
    if (txLoadingSkeleton) txLoadingSkeleton.style.display = 'none';

    // Hitung stats
    let totalOmset = 0;
    let cntCompleted = 0;
    let cntPending = 0;

    let totalTunai = 0;
    let totalQris = 0;

    data.forEach(tx => {
        if (tx.status === 'completed') {
            totalOmset += tx.total_price;
            cntCompleted++;
            if ((tx.payment_method || 'tunai') === 'tunai') totalTunai += tx.total_price;
            else if (tx.payment_method === 'qris') totalQris += tx.total_price;
        }
        if (tx.status === 'pending') { cntPending++; }
    });

    if (statTotalOmset) statTotalOmset.textContent = `Rp ${totalOmset.toLocaleString('id-ID')}`;
    const statTunai = document.getElementById('stat-tunai');
    const statQris = document.getElementById('stat-qris');
    if (statTunai) statTunai.textContent = `Rp ${totalTunai.toLocaleString('id-ID')}`;
    if (statQris) statQris.textContent = `Rp ${totalQris.toLocaleString('id-ID')}`;
    if (statCompleted) statCompleted.textContent = `${cntCompleted} pesanan`;
    if (statPending) statPending.textContent = `${cntPending} pesanan`;

    // Empty state
    if (data.length === 0) {
        if (txEmptyState) txEmptyState.classList.add('show');
        if (txList) txList.innerHTML = '';
        // Bersihkan card container kecuali skeleton
        if (txCardContainer) {
            Array.from(txCardContainer.children).forEach(el => {
                if (el.id !== 'tx-loading-skeleton') el.remove();
            });
        }
        return;
    }

    if (txEmptyState) txEmptyState.classList.remove('show');

    // --- Render CARD LIST (mobile/tablet) ---
    renderTxCards(data);

    // --- Render TABLE (desktop) ---
    renderTxTable(data);
}

function renderTxCards(data) {
    if (!txCardContainer) return;

    Array.from(txCardContainer.children).forEach(el => {
        if (el.id !== 'tx-loading-skeleton') el.remove();
    });

    data.forEach(tx => {
        const timeStr = new Date(tx.created_datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
        const itemsStr = items.map(i => `${i.quantity}× ${i.name}`).join(' • ');

        const statusClass = tx.status === 'completed' ? 'status-completed'
            : tx.status === 'canceled' ? 'status-canceled'
                : 'status-pending';

        const statusLabel = tx.status === 'completed' ? 'Selesai'
            : tx.status === 'canceled' ? 'Dibatalkan'
                : 'Menunggu';

        const statusBadge = `<span class="status-badge ${tx.status}">${statusLabel}</span>`;
        const payMethodBadge = tx.payment_method ? `<span style="font-size:0.65rem; background:var(--surface); padding:2px 6px; border-radius:4px; margin-left:6px; border:1px solid var(--border); color:var(--text-muted);">${tx.payment_method.toUpperCase()}</span>` : ''; // Added

        const customerHtml = tx.customer_name
            ? `<div class="tx-card-customer">${tx.customer_name} <span>— ${tx.cashier_name || '-'}</span></div>`
            : `<div class="tx-card-customer"><span style="font-style:italic; font-weight:400;">Tanpa nama</span> <span>— ${tx.cashier_name || '-'}</span></div>`;

        const notesHtml = tx.notes
            ? `<div class="tx-card-notes">📝 ${tx.notes}</div>` : '';

        const cancelHtml = (tx.status === 'canceled' && tx.cancel_reason)
            ? `<div class="tx-card-cancel-reason">Alasan batal: ${tx.cancel_reason}</div>` : '';

        let actionsHtml = '';
        if (tx.status === 'pending') {
            actionsHtml = `
                <button class="tx-btn"
                    onclick="editTransaction(${tx.id})"
                    style="background:var(--surface); border:1.5px solid var(--border); color:var(--text);">
                    ✏️ Edit
                </button>
                <button class="tx-btn tx-btn-complete"
                    onclick="updateTxStatus(${tx.id}, 'completed', event)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                    Selesai
                </button>
                <button class="tx-btn tx-btn-cancel"
                    onclick="updateTxStatus(${tx.id}, 'canceled', event)">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="none"
                        viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                    Batalkan
                </button>`;
        }

        const card = document.createElement('div');
        card.className = `tx-card ${statusClass}`;
        card.dataset.id = tx.id;
        card.innerHTML = `
            <div class="tx-card-top">
                <div class="tx-card-id-block">
                    <span class="tx-card-id">#${tx.id} ${payMethodBadge}</span>
                    <span class="tx-card-meta">
                        🕐 ${timeStr}
                    </span>
                </div>
                ${statusBadge}
            </div>
            <div class="tx-card-body">
                ${customerHtml}
                <div class="tx-card-items">${itemsStr}</div>
                ${notesHtml}
                ${cancelHtml}
            </div>
            <div class="tx-card-footer">
                <span class="tx-card-total"
                    ${tx.status === 'canceled' ? 'style="text-decoration: line-through; color: var(--text-muted);"' : ''}>
                    Rp ${tx.total_price.toLocaleString('id-ID')}
                </span>
                <div class="tx-card-actions">${actionsHtml}</div>
            </div>
        `;
        txCardContainer.appendChild(card);
    });
}

function renderTxTable(data) {
    if (!txList) return;
    txList.innerHTML = '';

    if (data.length === 0) {
        txList.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-muted); font-size:0.88rem;">Tidak ada transaksi pada tanggal ini.</td></tr>`;
        return;
    }

    data.forEach(tx => {
        const timeStr = new Date(tx.created_datetime).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        const items = typeof tx.items === 'string' ? JSON.parse(tx.items) : tx.items;
        const itemsHtml = items.map(i => `${i.quantity}× ${i.name}`).join('<br>');

        const statusLabel = tx.status === 'completed' ? 'Selesai'
            : tx.status === 'canceled' ? 'Dibatalkan'
                : 'Menunggu';

        const statusBadge = `<span class="status-badge ${tx.status}">${statusLabel}</span>`;

        let actionButtons = '';
        if (tx.status === 'pending') {
            actionButtons = `
                <div style="display:flex; gap:6px; justify-content:center;">
                    <button onclick="editTransaction(${tx.id})"
                        class="tx-btn" style="padding:6px 12px; font-size:0.78rem; min-height:32px; background:var(--surface); border:1.5px solid var(--border); color:var(--text);">
                        ✏️ Edit
                    </button>
                    <button onclick="updateTxStatus(${tx.id}, 'completed', event)"
                        class="tx-btn tx-btn-complete" style="padding:6px 12px; font-size:0.78rem; min-height:32px;">
                        ✓ Selesai
                    </button>
                    <button onclick="updateTxStatus(${tx.id}, 'canceled', event)"
                        class="tx-btn tx-btn-cancel" style="padding:6px 12px; font-size:0.78rem; min-height:32px;">
                        ✕ Batal
                    </button>
                </div>`;
        } else {
            actionButtons = `<span style="font-size:0.8rem; color:var(--text-muted);">—</span>`;
        }

        const customerInfo = tx.customer_name
            ? `<b>${tx.customer_name}</b>`
            : `<i style="color:var(--text-muted);">Tanpa nama</i>`;
        const notesHtml = tx.notes
            ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:4px;">📝 ${tx.notes}</div>` : '';
        const cancelReasonHtml = (tx.status === 'canceled' && tx.cancel_reason)
            ? `<div style="font-size:0.73rem; color:var(--red); margin-top:4px;">Alasan: ${tx.cancel_reason}</div>` : '';

        const method = tx.payment_method || 'tunai';
        const methodBadge = `<span class="method-badge method-${method}">${method === 'qris' ? '📱 QRIS' : '💵 Tunai'}</span>`;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>
                <b style="font-size:0.9rem;">#${tx.id}</b><br>
                <span style="font-size:0.78rem; color:var(--text-muted);">${timeStr}</span><br>
                <span style="font-size:0.73rem; color:var(--text-light);">Oleh: ${tx.cashier_name || '-'}</span>
            </td>
            <td>${customerInfo}${notesHtml}</td>
            <td class="tx-items-cell">${itemsHtml}</td>
            <td>${methodBadge}</td>
            <td>
                <span style="font-weight:700; font-size:0.95rem; ${tx.status === 'canceled' ? 'text-decoration:line-through; color:var(--text-muted);' : 'color:var(--red);'}">
                    Rp ${tx.total_price.toLocaleString('id-ID')}
                </span>
            </td>
            <td>${statusBadge}${cancelReasonHtml}</td>
            <td style="text-align:center;">${actionButtons}</td>
        `;
        txList.appendChild(tr);
    });
}

// Redirect and pass data to index.html
window.editTransaction = function (id) {
    const tx = allTxData.find(t => t.id === id);
    if (tx) {
        localStorage.setItem('edit_transaction_data', JSON.stringify(tx));
        window.location.href = 'index.html';
    }
};

// ---- Update Status Pesanan ----
window.updateTxStatus = async function (id, status, event) {
    // Cari data pesanan dari card untuk ditampilkan di modal
    let orderInfoHtml = '';
    const card = document.querySelector(`.tx-card[data-id="${id}"]`);
    if (card) {
        const cardId = card.querySelector('.tx-card-id')?.textContent || '';
        const cardItems = card.querySelector('.tx-card-items')?.textContent || '';
        const cardTotal = card.querySelector('.tx-card-total')?.textContent || '';
        orderInfoHtml = `<b>${cardId}</b><br>${cardItems}<br><b>${cardTotal}</b>`;
    }

    if (status === 'completed') {
        const result = await showConfirm({
            title: 'Tandai Pesanan Selesai?',
            message: 'Pesanan ini akan ditandai sebagai selesai dan tidak bisa dikembalikan.',
            orderInfo: orderInfoHtml,
            variant: 'green',
            icon: '✅',
            okLabel: 'Ya, Selesaikan'
        });
        if (!result.confirmed) return;

    } else if (status === 'canceled') {
        const result = await showConfirm({
            title: 'Batalkan Pesanan?',
            message: 'Masukkan alasan pembatalan pesanan ini.',
            orderInfo: orderInfoHtml,
            needReason: true,
            variant: 'danger',
            icon: '🚫',
            okLabel: 'Ya, Batalkan'
        });
        if (!result.confirmed) return;

        // Gunakan alasan dari modal, bukan dari prompt()
        try {
            const response = await fetch(`${API_TX_URL}/${id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: 'canceled', cancel_reason: result.reason })
            });
            const res = await response.json();
            if (!res.success) throw new Error(res.message);
            showToast('Pesanan berhasil dibatalkan');
            fetchAdminTransactions();
        } catch (err) {
            console.error("Update Status Error:", err);
            showToast('Gagal membatalkan pesanan', true);
        }
        return; // early return, sudah handle sendiri
    }

    // Handle 'completed'
    try {
        const response = await fetch(`${API_TX_URL}/${id}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status, cancel_reason: null })
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        showToast('Pesanan berhasil diselesaikan! 🎉');
        fetchAdminTransactions();
    } catch (err) {
        console.error("Update Status Error:", err);
        showToast('Gagal mengubah status pesanan', true);
    }
};

// ==========================================
// MENU MANAGEMENT
// ==========================================
const menuForm = document.getElementById('admin-menu-form');
const inputId = document.getElementById('admin-id');
const inputCategory = document.getElementById('admin-category');
const inputName = document.getElementById('admin-name');
const inputPrice = document.getElementById('admin-price');
const menuList = document.getElementById('admin-menu-list');
const btnCancel = document.getElementById('admin-cancel-btn');

async function fetchAdminMenu() {
    if (!menuList) return;
    try {
        const response = await fetch(API_MENU_URL);
        const result = await response.json();
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
        const safeCat = (item.category || '').replace(/'/g, "\\'");
        const safeName = (item.name || '').replace(/'/g, "\\'");
        const safeUrl = (item.image_url || '').replace(/'/g, "\\'");

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

async function uploadMenuImage(file) {
    const formData = new FormData();
    formData.append('image', file);
    const response = await fetch(API_UPLOAD_URL, { method: 'POST', body: formData });
    const result = await response.json();
    if (!result.success) throw new Error(result.message);
    return result.imageUrl;
}

async function deleteOldImage(imageUrl) {
    if (!imageUrl) return;
    const parts = imageUrl.split('/menu-images/');
    if (parts.length !== 2) return;
    try {
        await fetch(API_UPLOAD_URL, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath: parts[1] })
        });
    } catch (err) {
        console.warn("Gagal hapus foto lama (non-critical):", err.message);
    }
}

if (menuForm) {
    menuForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = inputId.value;
        const fileInput = document.getElementById('menu-image');
        const saveBtn = document.getElementById('admin-save-btn');
        let imageUrl = inputId.dataset.currentImage || null;

        if (fileInput.files.length > 0) {
            const file = fileInput.files[0];
            if (file.size > 2 * 1024 * 1024) {
                showToast('Ukuran gambar maksimal 2MB!', true);
                return;
            }
            try {
                saveBtn.textContent = 'Mengupload foto...';
                saveBtn.disabled = true;
                if (id && imageUrl) await deleteOldImage(imageUrl);
                imageUrl = await uploadMenuImage(file);
            } catch (err) {
                showToast('Gagal upload foto: ' + err.message, true);
                saveBtn.textContent = 'Simpan';
                saveBtn.disabled = false;
                return;
            }
        }

        const payload = {
            category: inputCategory.value.trim(),
            name: inputName.value.trim(),
            price: parseInt(inputPrice.value)
        };
        if (imageUrl) payload.image_url = imageUrl;

        try {
            saveBtn.textContent = 'Menyimpan...';
            saveBtn.disabled = true;

            const method = id ? 'PUT' : 'POST';
            const url = id ? `${API_MENU_URL}/${id}` : API_MENU_URL;
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
            showToast('Gagal menyimpan menu: ' + err.message, true);
        } finally {
            saveBtn.textContent = 'Simpan';
            saveBtn.disabled = false;
        }
    });
}

window.editMenu = function (id, category, name, price, imageUrl) {
    inputId.value = id;
    inputId.dataset.currentImage = imageUrl || '';
    inputCategory.value = category;
    inputName.value = name;
    inputPrice.value = price;
    if (btnCancel) btnCancel.style.display = 'block';

    const previewEl = document.getElementById('current-image-preview');
    if (previewEl) {
        if (imageUrl) {
            previewEl.innerHTML = `
                <div style="display:flex; align-items:center; gap:10px; margin-top:8px; padding:8px; background:var(--surface); border-radius:var(--radius-sm);">
                    <img src="${imageUrl}" alt="Foto saat ini"
                         style="height:50px; width:50px; border-radius:6px; object-fit:cover; border:1px solid var(--border);">
                    <small style="color:var(--text-muted); line-height:1.4;">
                        Foto saat ini.<br>Pilih file baru untuk mengganti.
                    </small>
                </div>`;
        } else {
            previewEl.innerHTML = '';
        }
    }
    menuForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.deleteMenu = async function (id) {
    const result = await showConfirm({
        title: 'Hapus Menu?',
        message: 'Menu dan foto produknya akan dihapus permanen dari sistem.',
        variant: 'danger',
        icon: '🗑️',
        okLabel: 'Ya, Hapus'
    });
    if (!result.confirmed) return;

    try {
        const response = await fetch(`${API_MENU_URL}/${id}`, { method: 'DELETE' });
        const res = await response.json();
        if (!res.success) throw new Error(res.message);
        showToast('Menu berhasil dihapus');
        fetchAdminMenu();
    } catch (err) {
        showToast('Gagal menghapus menu', true);
    }
};

function resetMenuForm() {
    if (inputId) inputId.value = '';
    if (inputId) inputId.dataset.currentImage = '';
    if (inputCategory) inputCategory.value = '';
    if (inputName) inputName.value = '';
    if (inputPrice) inputPrice.value = '';
    if (btnCancel) btnCancel.style.display = 'none';
    const previewEl = document.getElementById('current-image-preview');
    if (previewEl) previewEl.innerHTML = '';
}

if (btnCancel) btnCancel.addEventListener('click', resetMenuForm);

// ==========================================
// USERS MANAGEMENT
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
    if (!userList) return;
    try {
        const response = await fetch(API_USERS_URL);
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        renderAdminUsers(result.data);
    } catch (err) {
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
            username: inputUserName.value,
            password: inputUserPassword.value,
            role_type: inputUserRole.value,
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
            inputUserName.value = '';
            inputUserPassword.value = '';
            fetchAdminUsers();
        } catch (err) {
            showToast(err.message || 'Gagal menyimpan user', true);
        }
    });
}

window.deleteUser = async function (id) {
    const result = await showConfirm({
        title: 'Hapus User?',
        message: 'User ini akan dihapus permanen dari sistem.',
        variant: 'danger',
        icon: '👤',
        okLabel: 'Ya, Hapus User'
    });
    if (!result.confirmed) return;

    try {
        const response = await fetch(`${API_USERS_URL}/${id}?requestor_role=${userSession.role_type}`, { method: 'DELETE' });
        const res = await response.json();
        if (!res.success) throw new Error(res.message);
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
// INIT
// ==========================================
if (userSession.role_type !== 'kasir') {
    fetchAdminMenu();
    fetchAdminUsers();
}
fetchAdminTransactions();