// Remove Supabase config and replace with backend URL
const API_MENU_URL = "https://chasierkebabckl.vercel.app/api/menu";

const menuForm = document.getElementById('admin-menu-form');
const inputId = document.getElementById('admin-id');
const inputCategory = document.getElementById('admin-category');
const inputName = document.getElementById('admin-name');
const inputPrice = document.getElementById('admin-price');
const menuList = document.getElementById('admin-menu-list');
const btnCancel = document.getElementById('admin-cancel-btn');
const toast = document.getElementById('toast');

// [Biarkan fungsi showToast dan renderAdminMenu tetap ada di sini tanpa perubahan]

async function fetchAdminMenu() {
    try {
        const response = await fetch(API_MENU_URL);
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        renderAdminMenu(result.data);
    } catch (err) {
        showToast('Failed to fetch menu', true);
    }
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
        showToast('Failed to save menu', true);
    }
});

// [Biarkan fungsi editMenu tetap ada di sini tanpa perubahan]

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
        showToast('Failed to delete menu', true);
    }
};

// [Biarkan fungsi resetForm dan Init tetap ada di sini tanpa perubahan]