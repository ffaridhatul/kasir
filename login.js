// Localhost testing API format. Make sure to match your actual backend URL.
const API_LOGIN_URL = "https://chasierkebabckl.vercel.app/api/login";

const loginForm = document.getElementById('login-form');
const usernameInput = document.getElementById('username');
const passwordInput = document.getElementById('password');
const loginBtn = document.getElementById('login-btn');
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

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    // Disable button to prevent multiple clicks
    loginBtn.disabled = true;
    loginBtn.textContent = 'Memproses...';

    const payload = {
        username: usernameInput.value,
        password: passwordInput.value
    };

    try {
        const response = await fetch(API_LOGIN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (!result.success) throw new Error(result.message);
        
        // Save user session to localStorage
        localStorage.setItem('kebab_user_session', JSON.stringify(result.data));
        
        showToast('Login berhasil!');
        
        // Redirect based on role type
        setTimeout(() => {
            if (result.data.role_type === 'admin') {
                window.location.href = 'admin.html';
            } else {
                window.location.href = 'index.html';
            }
        }, 1000);

    } catch (err) {
        console.error("Login Error:", err);
        showToast(err.message || 'Username atau password salah', true);
        
        // Reset button
        loginBtn.disabled = false;
        loginBtn.textContent = 'Masuk';
    }
});