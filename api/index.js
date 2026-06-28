const express = require("express");
const cors = require("cors");
// Initialize Supabase client
const { createClient } = require('@supabase/supabase-js');

const app = express();

// Enable CORS for frontend access
app.use(cors());
app.use(express.json());

// Set Supabase credentials from environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================
// CHECKOUT & TRANSACTIONS ENDPOINT
// ==========================================
app.post("/api/checkout", async (req, res) => {
    try {
        const { items, total_price, payment_amount, change_amount, cashier_name, customer_name, notes } = req.body;

        if (!items || items.length === 0) {
            return res.status(400).json({ success: false, message: "Cart is empty" });
        }

        const { data, error } = await supabase
            .from('transactions')
            .insert([{
                items: items,
                total_price: total_price,
                amount_paid: payment_amount,
                change_amount: change_amount,
                cashier_name: cashier_name,
                customer_name: customer_name,
                notes: notes,
                status: 'pending' // Added default status for new transactions
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

// Update Status endpoint (Selesai / Dibatalkan)
app.put("/api/transactions/:id/status", async (req, res) => {
    try {
        const { id } = req.params;
        const { status, cancel_reason } = req.body;

        const updateData = { status: status };
        
        // Include cancel reason if the status is being set to canceled
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
        const { error } = await supabase.from('menu').delete().eq('id', id);

        if (error) throw error;
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

        const { data: userToDelete, error: fetchErr } = await supabase.from('users').select('role_type').eq('id', id).single();
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