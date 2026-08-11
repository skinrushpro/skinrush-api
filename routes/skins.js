import express from 'express';

import { parseSkinQuery, SkinQueryError } from '../skins/query.js';

function fetchError(res, error) {
  console.error('Skins API error:', error);
  return res.status(500).json({ error: 'Failed to fetch skins' });
}

export function createSkinsRouter({ skinService, sequelize }) {
  const router = express.Router();

  router.get('/filters', async (req, res) => {
    try {
      return res.json(await skinService.filterOptions());
    } catch (error) {
      return fetchError(res, error);
    }
  });

  router.get('/', async (req, res) => {
    try {
      const query = parseSkinQuery(req.query);
      if (!query.enhanced) {
        return res.json(await skinService.legacyList());
      }

      const { items, total } = await skinService.search(query);
      res.set('X-Total-Count', String(total));
      return res.json(items);
    } catch (error) {
      if (error instanceof SkinQueryError) {
        return res.status(400).json({
          error: {
            code: error.code,
            field: error.field,
            message: error.message
          }
        });
      }

      return fetchError(res, error);
    }
  });

  router.post('/filter', async (req, res) => {
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

      return res.json(results);
    } catch (error) {
      console.error('Filter error:', error.message);
      return res.status(500).json({ error: 'Filter failed' });
    }
  });

  return router;
}
