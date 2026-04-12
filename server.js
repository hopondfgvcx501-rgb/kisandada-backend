require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 5000;

// Increase payload limit for large base64 images
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize Real Supabase Database Connection
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("CRITICAL ERROR: Supabase keys are missing in .env file!");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// ==========================================================
// 1. REAL DATABASE ROUTE: Fetch Schemes from Supabase
// ==========================================================
app.get('/api/schemes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('schemes').select('*');
    
    if (error) {
      throw error;
    }
    
    console.log("✅ Successfully fetched data from live database!");
    res.json(data);
  } catch (error) {
    console.error("Database Error:", error.message);
    res.status(500).json({ error: "Failed to fetch data from Supabase database" });
  }
});

// ==========================================================
// 2. AI VISION ROUTE: Proxies image data to Python Engine
// ==========================================================
app.post('/api/ai/vision', async (req, res) => {
  try {
    console.log("📸 Mobile image received. Forwarding to Python AI Engine...");
    const aiResponse = await axios.post('http://localhost:8000/api/ai/vision', req.body);
    res.json(aiResponse.data);
  } catch (error) {
    console.error("AI Engine Error:", error.message);
    res.status(500).json({ 
      status: "error", 
      disease: "AI Engine Offline", 
      treatment: "Python server is currently offline or unreachable." 
    });
  }
});

// ==========================================================
// 3. PENDING ROUTES: Will be connected to Real APIs next
// ==========================================================
app.post('/api/ai/chat', (req, res) => {
  res.status(503).json({ error: "Chat AI connection pending" });
});

app.get('/api/mandi', (req, res) => {
  res.status(503).json({ error: "Live Mandi API connection pending" });
});

app.get('/api/weather', (req, res) => {
  res.status(503).json({ error: "Live Weather API connection pending" });
});

// Start the Master Backend Server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Master Node.js Backend is LIVE on port ${PORT}`);
  console.log(`🗄️  Connected to Supabase Database.`);
});