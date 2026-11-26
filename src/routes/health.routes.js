import { Router } from 'express';

export function createHealthRouter(pool) {
  const router = Router();

  router.get('/', (req, res) => {
    res.json({ status: 'ok' });
  });

  router.get('/db', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ error: 'Database unavailable' });
    }
  });

  return router;
}
