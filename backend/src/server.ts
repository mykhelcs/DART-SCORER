import { initDb } from './db/database';
import { createServerApp } from './app';

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;

const db = initDb();
const app = createServerApp(db);

const server = app.listen(PORT, () => {
  console.log(`🎯 Darts Scorer Backend & SQLite API running on http://localhost:${PORT}`);
  console.log(`📁 SQLite Database initialized in backend/data/darts.db`);
});

process.on('SIGINT', () => {
  console.log('\nClosing SQLite connection and shutting down...');
  db.close();
  server.close(() => {
    process.exit(0);
  });
});
