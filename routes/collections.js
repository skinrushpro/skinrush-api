import express from 'express';

import { CollectionQueryError, parseCollectionQuery } from '../collections/query.js';

function internalError(res, error) {
  console.error('Collections API error:', error);
  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Failed to fetch collections'
    }
  });
}

export function createCollectionsRouter(collectionService) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const query = parseCollectionQuery(req.query);
      res.json(await collectionService.list(query));
    } catch (error) {
      if (error instanceof CollectionQueryError) {
        return res.status(400).json({
          error: {
            code: error.code,
            field: error.field,
            message: error.message
          }
        });
      }

      return internalError(res, error);
    }
  });

  router.get('/:slug', async (req, res) => {
    try {
      res.json(await collectionService.getBySlug(req.params.slug));
    } catch (error) {
      if (error.code === 'COLLECTION_NOT_FOUND') {
        return res.status(404).json({
          error: {
            code: 'COLLECTION_NOT_FOUND',
            message: 'Collection not found'
          }
        });
      }

      return internalError(res, error);
    }
  });

  return router;
}

