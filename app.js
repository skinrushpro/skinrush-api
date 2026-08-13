import axios from 'axios';
import cors from 'cors';
import express from 'express';

import authRoutes from './routes/auth.js';
import { createCollectionsRouter } from './routes/collections.js';
import membersRoute from './routes/members.js';
import { createSkinsRouter } from './routes/skins.js';
import steamRoutes from './routes/steam.js';

const allowedOrigins = new Set([
  'https://skinrush.pro',
  'https://www.skinrush.pro',
  'https://editor.wix.com',
  'https://preview.wixsite.com',
  'https://99b1b14d-b61d-4c75-b149-c3899470677a.dev.wix-code.com',
  'http://localhost:5173',
  'http://localhost:5174'
]);

function isAllowedOrigin(origin) {
  if (!origin || origin === 'null' || allowedOrigins.has(origin)) return true;
  try {
    const url = new URL(origin);
    return url.protocol === 'https:'
      && url.hostname.endsWith('.editor.wix.com');
  } catch {
    return false;
  }
}

const corsOptions = {
  origin(origin, callback) {
    callback(null, isAllowedOrigin(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  exposedHeaders: ['X-Total-Count'],
  credentials: true
};

export function createApp({
  sequelize,
  skinService,
  collectionService,
  httpClient = axios,
  csfloatApiKey = process.env.CSFLOAT_API_KEY
} = {}) {
  const app = express();
  const marketCache = new Map();
  const cacheDurationMs = 10 * 60 * 1000;

  app.use(cors(corsOptions));

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/members', membersRoute);
  app.use('/api/steam', steamRoutes);

  if (collectionService) {
    app.use('/api/collections', createCollectionsRouter(collectionService));
  }

  if (skinService) {
    app.use('/api/skins', createSkinsRouter({ skinService, sequelize }));
  }

  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Backend is working!' });
  });

  app.get('/api/test-db', async (req, res) => {
    try {
      await sequelize.authenticate();
      res.json({ success: true, message: 'Database connected successfully' });
    } catch (error) {
      console.error('DB connection error:', error.message);
      res.status(503).json({ success: false, error: 'Database unavailable' });
    }
  });

  app.get('/api/item', async (req, res) => {
    try {
      const { search = 'ak-47 redline', limit = 10 } = req.query;
      const key = `${search}_${limit}`;
      const cached = marketCache.get(key);

      if (cached && Date.now() - cached.timestamp < cacheDurationMs) {
        return res.json(cached.data);
      }

      const response = await httpClient.get('https://api.csfloat.com/v1/listings', {
        headers: { Authorization: `Bearer ${csfloatApiKey}` },
        params: { search, limit }
      });

      marketCache.set(key, { timestamp: Date.now(), data: response.data });
      res.json(response.data);
    } catch (error) {
      console.error('CSFloat error:', error.response?.data || error.message);
      res.status(500).json({ error: 'Failed to fetch data from CSFloat' });
    }
  });

  return app;
}
