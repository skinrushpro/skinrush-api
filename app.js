import axios from 'axios';
import cors from 'cors';
import express from 'express';

import authRoutes from './routes/auth.js';
import { createCollectionsRouter } from './routes/collections.js';
import membersRoute from './routes/members.js';
import steamRoutes from './routes/steam.js';

const allowedOrigins = new Set([
  'https://www.skinrush.pro',
  'https://editor.wix.com',
  'https://preview.wixsite.com'
]);

const corsOptions = {
  origin(origin, callback) {
    callback(null, !origin || allowedOrigins.has(origin));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true
};

export function createApp({
  sequelize,
  Skin,
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

  app.get('/api/hello', (req, res) => {
    res.json({ message: 'Backend is working!' });
  });

  app.get('/api/test-db', async (req, res) => {
    try {
      await sequelize.authenticate();
      res.json({ success: true, message: 'Database connected successfully' });
    } catch (error) {
      console.error('DB connection error:', error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/skins', async (req, res) => {
    try {
      const skins = await Skin.findAll();
      res.json(skins);
    } catch (error) {
      console.error('Failed to fetch skins:', error);
      res.status(500).json({ error: 'Failed to fetch skins', details: error.message });
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
      console.error('Filter error:', error.message);
      res.status(500).json({ error: 'Filter failed' });
    }
  });

  return app;
}
