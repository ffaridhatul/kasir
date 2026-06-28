const express = require("express");
const cors = require("cors");
const multer = require("multer");
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Enable CORS for frontend access
app.use(cors());

// JSON limit diturunkan ke 1mb — payload menu sekarang hanya teks + URL pendek
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ limit: '1mb', extended: true }));

// Supabase client — credentials dari environment variables Vercel (aman, tidak terekspos ke browser)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Multer — simpan file di memory (buffer), tidak ke disk
// File hanya singgah sementara di Vercel sebelum diteruskan ke Supabase Storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 2 * 1024 * 1024 }, // maksimal 2MB per file
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Tipe file tidak didukung. Gunakan JPG, PNG, atau WEBP.'));
        }
    }
});

// ==========================================
// IMAGE UPLOAD ENDPOINT
// ==========================================

// POST /api/menu/upload
// Menerima file dari FormData, upload ke Supabase Storage, return public URL
// Endpoint ini HARUS didefinisikan sebelum POST /api/menu agar tidak bentrok routing
app.post("/api/menu/upload", upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: "Tidak ada file yang diunggah" });
        }

        // Generate nama file unik untuk menghindari overwrite
        const ext = req.file.mimetype.split('/')[1]; // 'jpeg' | 'png' | 'webp'
        const fileName = `menu_${Date.now()}.${ext}`;

        // Upload buffer ke Supabase Storage bucket "menu-images"
        const { error: uploadError } = await supabase.storage
            .from('menu-images')
            .upload(fileName, req.file.buffer, {
                contentType: req.file.mimetype,
                cacheControl: '3600', // cache 1 jam di CDN
                upsert: false         // false = error jika nama sama (lebih aman)
            });

        if (uploadError) throw uploadError;

        // Ambil public URL hasil upload
        const { data: urlData } = supabase.storage
            .from('menu-images')
            .getPublicUrl(fileName);

        return res.status(200).json({
            success: true,
            imageUrl: urlData.publicUrl
            // Contoh: "https://xxxx.supabase.co/storage/v1/object/public/menu-images/menu_1234567890.jpeg"
        });

    } catch (error) {
        console.error("[UPLOAD ERROR] " + new Date().toISOString() + " : " + error.message);

        // Error khusus dari multer (ukuran file melebihi batas)
        if (error.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({ success: false, message: "Ukuran file maksimal 2MB" });
        }

        return res.status(500).json({ success: false, message: error.message || "Gagal mengupload gambar" });
    }
});

// DELETE /api/menu/upload
// Menghapus file lama dari Supabase Storage (dipanggil saat edit menu dengan foto baru)
app.delete("/api/menu/upload", async (req, res) => {
    try {
        const { filePath } = req.body; // Contoh: "menu_1234567890.jpeg"

        if (!filePath) {
            return res.status(400).json({ success: false, message: "filePath wajib diisi" });
        }

        const { error } = await supabase.storage
            .from('menu-images')
            .remove([filePath]);

        if (error) throw error;

        return res.status(200).json({ success: true, message: "File berhasil dihapus dari storage" });

    } catch (error) {
        console.error("[DELETE STORAGE ERROR] " + new Date().toISOString() + " : " + error.message);
        return res.status(500).json({ success: false, message: error.message || "Gagal menghapus file dari storage" });
    }
});

// ==========================================
// CHECKOUT & TRANSACTIONS ENDPOINT
// ==========================================

app.post("/api/checkout", async (req, res) => {
    try {
        const { items, total_price, payment_amount, change_amount, cashier_name, customer_name, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const { error } = await supabase
            .from('transactions')
            .insert([{
                items: items,
                total_price: total_price,
                amount_paid: payment_amount,
                change_amount: change_amount,
                cashier_name: cashier_name,
                customer_name: customer_name,
                notes: notes,
                status: 'pending'
            }]);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "Transaction processed and saved successfully" });
    } catch (error) {
        console.error("[ERROR LOG] " + new Date().toISOString() + " : " + error.message);
        return res.status(500).json({ success: false, message: error.message || "Unknown Database Error" });
    }
});

app.get("/api/transactions", async (req, res) => {
    try {
        const { start, end } = req.query;

        if (!start || !end) {
            return res.status(400).json({ success: false, message: "Start and end dates are required" });
        }

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .gte('created_datetime', start)
            .lte('created_datetime', end)
            .order('created_datetime', { ascending: false });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.put("/api/transactions/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, cancel_reason } = req.body;

        const updateData = { status: status };

        if (status === 'canceled') {
            updateData.cancel_reason = cancel_reason;
        }

        const { error } = await supabase.from('transactions').update(updateData).eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "Transaction status updated successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// MENU ENDPOINT
// ==========================================

app.get("/api/menu", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('menu')
            .select('*')
            .order('category', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post("/api/menu", async (req, res) => {
    try {
        const payload = req.body;
        const { error } = await supabase.from('menu').insert([payload]);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "Menu added successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.put("/api/menu/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const payload = req.body;
        const { error } = await supabase.from('menu').update(payload).eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "Menu updated successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.delete("/api/menu/:id", async (req, res) => {
    try {
        const id = req.params.id;

        // Ambil image_url menu yang akan dihapus untuk cleanup storage
        const { data: menuData, error: fetchErr } = await supabase
            .from('menu')
            .select('image_url')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        // Hapus record dari database
        const { error } = await supabase.from('menu').delete().eq('id', id);
        if (error) throw error;

        // Jika ada foto di Storage, hapus juga (cleanup otomatis)
        if (menuData?.image_url) {
            const urlParts = menuData.image_url.split('/menu-images/');
            if (urlParts.length === 2) {
                const filePath = urlParts[1];
                // Best-effort: tidak throw error jika hapus storage gagal
                await supabase.storage.from('menu-images').remove([filePath]);
            }
        }

        return res.status(200).json({ success: true, message: "Menu deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

// ==========================================
// AUTH & USERS ENDPOINT
// ==========================================

app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ success: false, message: "Username and password required" });
        }

        const { data, error } = await supabase
            .from('users')
            .select('id, username, role_type, password')
            .eq('username', username)
            .single();

        if (error || !data || data.password !== password) {
            return res.status(401).json({ success: false, message: "Invalid credentials" });
        }

        delete data.password;
        return res.status(200).json({ success: true, message: "Login successful", data: data });

    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('id, username, role_type')
            .order('id', { ascending: true });

        if (error) throw error;
        return res.status(200).json({ success: true, data });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.post("/api/users", async (req, res) => {
    try {
        const { username, password, role_type, requestor_role } = req.body;

        if (requestor_role === 'kasir') {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        if (requestor_role === 'admin' && role_type === 'admin') {
            return res.status(403).json({ success: false, message: "Admin cannot create another admin" });
        }

        const { error } = await supabase.from('users').insert([{ username, password, role_type }]);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "User added successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

app.delete("/api/users/:id", async (req, res) => {
    try {
        const id = req.params.id;
        const requestor_role = req.query.requestor_role;

        if (requestor_role === 'kasir') {
            return res.status(403).json({ success: false, message: "Forbidden" });
        }

        const { data: userToDelete, error: fetchErr } = await supabase
            .from('users')
            .select('role_type')
            .eq('id', id)
            .single();

        if (fetchErr) throw fetchErr;

        if (requestor_role === 'admin' && userToDelete.role_type === 'owner') {
            return res.status(403).json({ success: false, message: "Admin cannot delete an owner" });
        }

        const { error } = await supabase.from('users').delete().eq('id', id);

        if (error) throw error;
        return res.status(200).json({ success: true, message: "User deleted successfully" });
    } catch (error) {
        return res.status(500).json({ success: false, message: error.message });
    }
});

module.exports = app;