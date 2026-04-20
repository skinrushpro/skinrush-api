import 'dotenv/config';
import express from 'express';
import axios from 'axios';
import cors from 'cors';

import sequelize from './db.js';
import { Skin } from './models/Skin.js';
import authRoutes from './routes/auth.js';
import membersRoute from './routes/members.js';
import steamRoutes from './routes/steam.js';

const app = express();
const PORT = process.env.PORT || 3000;
const CSFLOAT_API_KEY = process.env.CSFLOAT_API_KEY;

// ✅ Full CORS options
const corsOptions = {
  origin: 'https://www.skinrush.pro',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

// ✅ Apply CORS middleware
app.options('*', cors(corsOptions));   // Preflight support
app.use(cors(corsOptions));            // Standard support

app.use((req, res, next) => {
  const allowedOrigins = [
    'https://www.skinrush.pro',
    'https://editor.wix.com',
    'https://preview.wixsite.com'
  ];

  const origin = req.headers.origin;

  if (allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  res.header('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }

  next();
});


// ✅ Body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ✅ Route setup
app.use('/api/auth', authRoutes);
app.use('/api/members', membersRoute);
app.use('/api/steam', steamRoutes);

// ✅ Health check
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Backend is working!' });
});

app.get('/api/test-db', async (req, res) => {
  try {
    await sequelize.authenticate();

    res.json({
      success: true,
      message: 'Database connected successfully'
    });
  } catch (error) {
    console.error('❌ DB connection error:', error.message);

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ✅ Skin data from DB
app.get('/api/skins', async (req, res) => {
  try {
    console.log('Fetching skins...');

    const skins = await Skin.findAll();

    console.log('Returned:', skins.length);

    res.json(skins);

  } catch (err) {
    console.error('❌ FULL ERROR:', err);

    res.status(500).json({
      error: 'Failed to fetch skins',
      details: err.message
    });
  }
});

// ✅ CSFloat lookup with basic cache
const marketCache = {};
const CACHE_DURATION_MS = 10 * 60 * 1000;

app.get('/api/item', async (req, res) => {
  try {
    const { search = 'ak-47 redline', limit = 10 } = req.query;
    const key = `${search}_${limit}`;

    const cached = marketCache[key];
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION_MS) {
      return res.json(cached.data);
    }

    const response = await axios.get('https://api.csfloat.com/v1/listings', {
      headers: { Authorization: `Bearer ${CSFLOAT_API_KEY}` },
      params: { search, limit }
    });

    marketCache[key] = {
      timestamp: Date.now(),
      data: response.data
    };

    res.json(response.data);
  } catch (error) {
    console.error('❌ CSFloat error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch data from CSFloat' });
  }
});

app.post('/api/skins/filter', async (req, res) => {
  try {
    const { weapon } = req.body;

    const [results] = await sequelize.query(`
      SELECT *
      FROM skins
      WHERE weapon_name = :weapon
      LIMIT 20
    `, {
      replacements: { weapon }
    });

    res.json(results);

  } catch (error) {
    console.error('❌ Filter error:', error.message);
    res.status(500).json({ error: 'Filter failed' });
  }
});

// ✅ Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
