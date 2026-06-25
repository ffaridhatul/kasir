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

// Checkout endpoint
app.post("/api/checkout", async (req, res) => {
    try {
        const { items, total_price, payment_amount, change_amount } = req.body;

        // Simple validation
        if (!items || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Insert transaction data to Supabase
        const { data, error } = await supabase
            .from('transactions')
            .insert([
                { 
                    items: items, 
                    total_price: total_price, 
                    amount_paid: payment_amount, // Mapped to DB column amount_paid
                    change_amount: change_amount 
                }
            ]);

        if (error) throw error;

        // Process data log (visible in Vercel dashboard)
        console.log("New Order Received and Saved:", {
            total_price,
            payment_amount,
            change_amount,
            item_count: items.length
        });

        // Send back success response
        return res.status(200).json({
            success: true,
            message: "Transaction processed and saved successfully"
        });
    } catch (error) {
        // Log error to Vercel console
        console.error("[ERROR LOG] " + new Date().toISOString() + " : " + error.message);
        console.error("DEBUG ERROR DETAIL:", JSON.stringify(error, null, 2));
        
        return res.status(500).json({ 
            success: false, 
            message: error.message || "Unknown Database Error"
        });
    }
});


// Fetch all menus
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

// Add new menu
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

// Update menu
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

// Delete menu
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

// Export app for Vercel
module.exports = app;