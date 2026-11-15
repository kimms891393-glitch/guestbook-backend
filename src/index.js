import path from 'node:path';
import { createServer } from './server.js';

const port = Number(process.env.PORT ?? 5050);
const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
const dbPath = process.env.DB_PATH ?? path.join(process.cwd(), 'data', 'guestbook.json');

const server = createServer({ dbPath, corsOrigin });

server.listen(port, () => {
  console.log(`guestbook API listening on http://localhost:${port}`);
});
