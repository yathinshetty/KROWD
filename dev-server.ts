import http from 'node:http';
import {createServer as createViteServer} from 'vite';
import app from './server/app.js';

async function startDevServer() {
  try {
    console.log('Starting KROWD server...');

    const httpServer = http.createServer(app);

    console.log('Express app loaded.');

    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        allowedHosts: true,
        ws: {server: httpServer},
        hmr:
          process.env.DISABLE_HMR === 'true'
            ? false
            : {server: httpServer},
      },
      appType: 'spa',
    });

    console.log('Vite initialized.');

    app.use(vite.middlewares);

    const port = Number(process.env.PORT) || 3000;

    httpServer.listen(port, '0.0.0.0', () => {
      console.log(`KROWD server running at http://localhost:${port}`);
    });
  } catch (error) {
    console.error('KROWD STARTUP ERROR:', error);
    process.exitCode = 1;
  }
}

startDevServer();