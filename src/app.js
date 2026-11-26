import express from 'express';
import { createHealthRouter } from './routes/health.routes.js';
import { createItemRouter } from './routes/item.routes.js';

export function createApp(pool) {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json());
  app.use('/health', createHealthRouter(pool));
  app.use('/items', createItemRouter(pool));

  app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });

  app.use((error, req, res, next) => {
    if (res.headersSent) {
      return next(error);
    }

    if (error.type === 'entity.too.large') {
      return res.status(413).json({ error: 'Request body too large' });
    }

    if (error.status === 400) {
      return res.status(400).json({ error: 'Invalid request' });
    }

    if (error.status === 415) {
      return res.status(415).json({ error: 'Unsupported request encoding' });
    }

    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
