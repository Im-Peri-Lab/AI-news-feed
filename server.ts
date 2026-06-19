import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config();

import express from 'express';
import path from 'path';

// Reuse the exact same serverless handlers as production (api/*). The dev server
// must not reimplement collection/briefing logic — doing so drifts from prod
// (e.g. an out-of-date briefing prompt or a smaller query set served locally).
import briefingHandler from './api/briefing.js';
import newsHandler from './api/news.js';
import tagsHandler from './api/tags.js';
import tagIdHandler from './api/tags/[id].js';
import categoriesHandler from './api/categories.js';
import categoryIdHandler from './api/categories/[id].js';
import redirectHandler from './api/r.js';

type VercelHandler = (req: any, res: any) => unknown;

const app = express();

// Adapt a Vercel-style handler to an Express route, surfacing async errors.
function adapt(handler: VercelHandler): express.RequestHandler {
  return (req, res, next) => {
    Promise.resolve(handler(req, res)).catch(next);
  };
}

// Vercel exposes dynamic segments (api/tags/[id].ts) via req.query.id, but Express
// puts them on req.params. Bridge by layering params onto query without mutating
// Express's read-only query getter.
function adaptWithParams(handler: VercelHandler): express.RequestHandler {
  return (req, res, next) => {
    const proxied = Object.create(req, {
      query: { value: { ...req.query, ...req.params }, enumerable: true },
    });
    Promise.resolve(handler(proxied, res)).catch(next);
  };
}

async function startServer() {
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  app.post('/api/briefing', adapt(briefingHandler));
  app.get('/api/news', adapt(newsHandler));

  // GET (list) / POST (create) / PATCH (reorder)
  app.all('/api/tags', adapt(tagsHandler));
  app.all('/api/tags/:id', adaptWithParams(tagIdHandler));
  app.all('/api/categories', adapt(categoriesHandler));
  app.all('/api/categories/:id', adaptWithParams(categoryIdHandler));

  app.get('/r', adapt(redirectHandler));

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', environment: process.env.NODE_ENV, timestamp: new Date().toISOString() });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware loaded (Development)');
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      const indexPath = path.join(distPath, 'index.html');
      res.sendFile(indexPath, (err) => {
        if (err) {
          console.error(`Error sending index.html from ${indexPath}:`, err);
          res.status(404).send('404: Page not found.');
        }
      });
    });
    console.log('Static serving initialized (Production)');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV}`);
  });
}

startServer();
