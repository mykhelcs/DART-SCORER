import { initDb, listTournamentsDb, listMatchesDb } from './db/database';

const db = initDb();

console.log('\n--- 🎯 Darts SQLite Database Inspector ---');
const tables = db
  .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
  .all() as { name: string }[];
console.log('Tables:', tables.map((t) => t.name).join(', '));

const tournaments = listTournamentsDb(db);
console.log(`\n🏆 Tournaments (${tournaments.length}):`);
for (const t of tournaments) {
  console.log(`  - [${t.id}] "${t.name}" | Champion: ${t.champion || 'None'} | Pools: ${t.pools.length}`);
}

const matches = listMatchesDb(db);
console.log(`\n🎯 Matches (${matches.length}):`);
for (const m of matches) {
  const pList = m.match.players.map((p) => `${p.name} (${p.legs})`).join(' vs ');
  console.log(`  - [${m.id}] ${pList} | Over: ${m.match.over}`);
}
console.log('-------------------------------------------\n');

db.close();
