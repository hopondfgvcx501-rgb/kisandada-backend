require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// Database & AI Configuration
// ==========================================
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// 1. Govt Schemes Endpoint (Supabase)
// ==========================================
app.get('/api/schemes', async (req, res) => {
  try {
    const { data, error } = await supabase.from('schemes').select('*');
    if (error) throw error;
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch schemes data" });
  }
});

// ==========================================
// 2. AI Chat Endpoint (Multi-Language)
// ==========================================
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { message, language } = req.body; 
    
    // Determine the requested language for AI response
    const langName = language === 'mr' ? 'Marathi' : language === 'en' ? 'English' : 'Hindi';

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // System prompt defining the AI's persona and language constraint
    const prompt = `You are KisanDada, a helpful and expert agricultural AI assistant for Indian farmers. Reply strictly in simple, polite ${langName} language. The farmer says: "${message}"`;
    
    const result = await model.generateContent(prompt);
    const response = await result.response;
    res.json({ reply: response.text() });
  } catch (error) {
    console.error("Chat Error:", error);
    res.json({ reply: "Connection failed. Please check your internet and try again." });
  }
});

// ==========================================
// 3. AI Crop Disease Scanner Endpoint
// ==========================================
app.post('/api/disease/scan', async (req, res) => {
  try {
    const { image_data } = req.body;
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    const prompt = "You are a crop disease expert. Analyze this crop leaf image. Respond strictly in JSON format with these exact keys: 'status' (must be 'success'), 'disease' (disease name), 'confidence' (e.g., '95%'), and 'treatment' (cure/medicine instructions). Respond in Hindi or the required local language. Do not use markdown blocks, just raw JSON.";
    
    const image = { inlineData: { data: image_data, mimeType: "image/jpeg" } };
    
    const result = await model.generateContent([prompt, image]);
    let text = result.response.text();
    text = text.replace(/```json/g, '').replace(/```/g, '').trim(); 
    
    res.json(JSON.parse(text));
  } catch (error) {
    console.error("Scan Error:", error);
    res.json({ status: "error", disease: "Detection Failed", confidence: "0%", treatment: "Please capture a clear, close-up photo of the leaf." });
  }
});

// ==========================================
// 4. Weather Data Endpoint (WeatherAPI)
// ==========================================
app.get('/api/weather', async (req, res) => {
  try {
    const apiKey = process.env.WEATHER_API_KEY;
    const city = "Ranchi"; // Default location
    
    if(!apiKey) throw new Error("Missing Weather API Key");

    const response = await axios.get(`http://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${city}&days=3`);
    const data = response.data;

    res.json({
      location: `${data.location.name}, ${data.location.region}`,
      current: {
        temp: `${data.current.temp_c}°C`,
        condition: data.current.condition.text,
        humidity: `${data.current.humidity}%`,
        wind: `${data.current.wind_kph} km/h`,
        icon: "partly-sunny"
      },
      advice: data.current.condition.text.toLowerCase().includes('rain') ? "Rain expected. Postpone pesticide spraying." : "Clear weather. Ideal for field operations.",
      forecast: data.forecast.forecastday.map(day => ({
        day: new Date(day.date).toLocaleDateString('en-IN', { weekday: 'short' }),
        temp: `${day.day.avgtemp_c}°C`,
        icon: "cloudy"
      }))
    });
  } catch (error) {
    // Fallback response if API fails or rate limit is reached
    res.json({
      location: "Local Area", current: { temp: "30°C", condition: "Clear", humidity: "65%", wind: "10 km/h", icon: "sunny" },
      advice: "Weather API unavailable. Please check local conditions.",
      forecast: [{ day: "Tomorrow", temp: "31°C", icon: "sunny" }, { day: "Next Day", temp: "32°C", icon: "partly-sunny" }]
    });
  }
});

// ==========================================
// 5. Mandi Prices Endpoint
// ==========================================
app.get('/api/mandi/prices', async (req, res) => {
  try {
    const apiKey = process.env.MANDI_API_KEY;
    
    // Fallback mock data structure for uninterrupted UI testing
    res.json({
      ai_advice: "Rice prices are stable. Holding inventory for a week might be profitable.",
      msp: "₹2,183 / Quintal",
      prices: [
        { mandi: "Ranchi Mandi", distance: "12 km", price: "₹2,250", change: "+ ₹20", highlight: true },
        { mandi: "Bokaro Mandi", distance: "45 km", price: "₹2,210", change: "- ₹10", highlight: false },
        { mandi: "Hazaribagh Mandi", distance: "60 km", price: "₹2,190", change: "Stable", highlight: false }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch Mandi data" });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 MASTER BACKEND IS LIVE ON PORT ${PORT}`);
});