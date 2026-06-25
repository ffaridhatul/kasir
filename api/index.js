const express = require("express");
const cors = require("cors");

const app = express();

// Enable CORS for frontend access
app.use(cors());
app.use(express.json());

// Checkout endpoint
app.post("/api/checkout", (req, res) => {
    try {
        const { items, total_price, payment_amount, change_amount } = req.body;

        // Simple validation
        if (!items || items.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: "Cart is empty" 
            });
        }

        // Process data log (visible in Vercel dashboard)
        console.log("New Order Received:", {
            total_price,
            payment_amount,
            change_amount,
            item_count: items.length
        });

        // Send back success response
        return res.status(200).json({
            success: true,
            message: "Transaction processed successfully"
        });
    } catch (error) {
        return res.status(500).json({ 
            success: false, 
            message: error.message 
        });
    }
});

// Export app for Vercel
module.exports = app;