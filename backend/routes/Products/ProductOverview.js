const express = require('express');

const router = express.Router();

// Mock database query functions (replace with real DB logic)
async function getProductStats() {
    // Example data, replace with actual DB queries
    return {
        totalProducts: 120,
        lowStock: 10,
        topSellingProduct: 'Product A',
        outOfStock: 5,
        returnedProducts: 2
    };
}

// GET /products/stats
router.get('/stats', async (req, res) => {
    try {
        const stats = await getProductStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch product stats' });
    }
});

module.exports = router;