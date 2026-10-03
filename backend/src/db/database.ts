import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { MatchState, TournamentState } from '../../../src/core/types';

export function initDb(dbPathOrMemory?: string): Database.Database {
  let dbPath = dbPathOrMemory;
  if (!dbPath) {
    const dataDir = path.resolve(process.cwd(), 'backend', 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    dbPath = path.join(dataDir, 'darts.db');
  }

  const db = new Database(dbPath);

  // Use WAL mode for concurrent reads/writes
  if (dbPath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS tournaments (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      data_json TEXT NOT NULL,
      champion TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      tournament_id TEXT,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      total_points INTEGER DEFAULT 0,
      total_darts INTEGER DEFAULT 0,
      high_score INTEGER DEFAULT 0,
      best_checkout INTEGER DEFAULT 0,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

export function saveTournamentDb(db: Database.Database, tourney: TournamentState): void {
  const stmt = db.prepare(`
    INSERT INTO tournaments (id, name, data_json, champion, created_at, updated_at)
    VALUES (@id, @name, @data_json, @champion, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      data_json = excluded.data_json,
      champion = excluded.champion,
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  stmt.run({
    id: tourney.id,
    name: tourney.name,
    data_json: JSON.stringify(tourney),
    champion: tourney.champion,
    created_at: now,
    updated_at: now,
  });
}

export function getTournamentDb(db: Database.Database, id: string): TournamentState | null {
  const row = db
    .prepare('SELECT data_json FROM tournaments WHERE id = ?')
    .get(id) as { data_json: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.data_json) as TournamentState;
}

export function listTournamentsDb(db: Database.Database): TournamentState[] {
  const rows = db
    .prepare('SELECT data_json FROM tournaments ORDER BY updated_at DESC')
    .all() as { data_json: string }[];

  return rows.map((r) => JSON.parse(r.data_json) as TournamentState);
}

export function saveMatchDb(
  db: Database.Database,
  id: string,
  match: MatchState,
  tournamentId?: string,
): void {
  const stmt = db.prepare(`
    INSERT INTO matches (id, tournament_id, data_json, created_at, updated_at)
    VALUES (@id, @tournament_id, @data_json, @created_at, @updated_at)
    ON CONFLICT(id) DO UPDATE SET
      data_json = excluded.data_json,
      tournament_id = COALESCE(excluded.tournament_id, matches.tournament_id),
      updated_at = excluded.updated_at
  `);

  const now = new Date().toISOString();
  stmt.run({
    id,
    tournament_id: tournamentId ?? null,
    data_json: JSON.stringify(match),
    created_at: now,
    updated_at: now,
  });
}

export function getMatchDb(db: Database.Database, id: string): MatchState | null {
  const row = db
    .prepare('SELECT data_json FROM matches WHERE id = ?')
    .get(id) as { data_json: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.data_json) as MatchState;
}

export function listMatchesDb(db: Database.Database): { id: string; match: MatchState }[] {
  const rows = db
    .prepare('SELECT id, data_json FROM matches ORDER BY updated_at DESC')
    .all() as { id: string; data_json: string }[];

  return rows.map((r) => ({
    id: r.id,
    match: JSON.parse(r.data_json) as MatchState,
  }));
}
