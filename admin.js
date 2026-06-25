const API_MENU_URL = "https://chasierkebabckl.vercel.app/api/menu";

const menuForm = document.getElementById('admin-menu-form');
const inputId = document.getElementById('admin-id');
const inputCategory = document.getElementById('admin-category');
const inputName = document.getElementById('admin-name');
const inputPrice = document.getElementById('admin-price');
const menuList = document.getElementById('admin-menu-list');
const btnCancel = document.getElementById('admin-cancel-btn');
const toast = document.getElementById('toast');

let toastTimer;
function showToast(msg, isError = false) {
    if (!toast) return; // Error handler if toast element is not found
    toast.textContent = msg;
    toast.style.background = isError ? '#dc2626' : '#16a34a';
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3200);
}

async function fetchAdminMenu() {
    try {
        const response = await fetch(API_MENU_URL);
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        renderAdminMenu(result.data);
    } catch (err) {
        console.error("Fetch Admin Menu Error:", err);
        showToast('Failed to fetch menu', true);
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

menuForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = inputId.value;
    const payload = {
        category: inputCategory.value,
        name: inputName.value,
        price: parseInt(inputPrice.value)
    };

    try {
        if (id) {
            // Update existing menu
            const response = await fetch(`${API_MENU_URL}/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            showToast('Menu updated successfully');
        } else {
            // Add new menu
            const response = await fetch(API_MENU_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const result = await response.json();
            if (!result.success) throw new Error(result.message);
            
            showToast('Menu added successfully');
        }
        resetForm();
        fetchAdminMenu();
    } catch (err) {
        console.error("Save Menu Error:", err);
        showToast('Failed to save menu', true);
    }
});

window.editMenu = function(id, category, name, price) {
    inputId.value = id;
    inputCategory.value = category;
    inputName.value = name;
    inputPrice.value = price;
    btnCancel.style.display = 'block';
};

window.deleteMenu = async function(id) {
    if (!confirm('Are you sure you want to delete this menu?')) return;
    try {
        const response = await fetch(`${API_MENU_URL}/${id}`, {
            method: 'DELETE'
        });
        const result = await response.json();
        if (!result.success) throw new Error(result.message);
        
        showToast('Menu deleted successfully');
        fetchAdminMenu();
    } catch (err) {
        console.error("Delete Menu Error:", err);
        showToast('Failed to delete menu', true);
    }
};

function resetForm() {
    inputId.value = '';
    inputCategory.value = '';
    inputName.value = '';
    inputPrice.value = '';
    btnCancel.style.display = 'none';
}

btnCancel.addEventListener('click', resetForm);

// Init
fetchAdminMenu();