import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { MatchState, TournamentState, VisitLog, AuditLog } from '../../../src/core/types';

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

    CREATE TABLE IF NOT EXISTS match_logs (
      id TEXT PRIMARY KEY,
      match_id TEXT NOT NULL,
      leg INTEGER NOT NULL,
      player_name TEXT NOT NULL,
      score_before INTEGER NOT NULL,
      darts_json TEXT NOT NULL,
      visit_total INTEGER NOT NULL,
      is_bust INTEGER NOT NULL,
      is_checkout INTEGER NOT NULL,
      score_after INTEGER NOT NULL,
      timestamp TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      action TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id TEXT,
      details TEXT,
      timestamp TEXT NOT NULL
    );

    DELETE FROM matches WHERE id = 'active';
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
  // Never persist 'active' as a stored match ID
  if (!id || id === 'active') return;

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
  if (!id || id === 'active') return null;

  const row = db
    .prepare('SELECT data_json FROM matches WHERE id = ?')
    .get(id) as { data_json: string } | undefined;

  if (!row) return null;
  return JSON.parse(row.data_json) as MatchState;
}

export function listMatchesDb(db: Database.Database): {
  id: string;
  tournamentId?: string;
  match: MatchState;
  createdAt?: string;
  updatedAt?: string;
}[] {
  const rows = db
    .prepare("SELECT id, tournament_id, data_json, created_at, updated_at FROM matches WHERE id != 'active' ORDER BY updated_at DESC")
    .all() as {
      id: string;
      tournament_id: string | null;
      data_json: string;
      created_at: string;
      updated_at: string;
    }[];

  return rows.map((r) => ({
    id: r.id,
    tournamentId: r.tournament_id ?? undefined,
    match: JSON.parse(r.data_json) as MatchState,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export function deleteMatchDb(db: Database.Database, id: string): boolean {
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM match_logs WHERE match_id = ?').run(id);
    const result = db.prepare('DELETE FROM matches WHERE id = ?').run(id);
    return result.changes > 0;
  });

  return tx();
}

export function saveMatchLogsDb(
  db: Database.Database,
  matchId: string,
  logs: VisitLog[],
): void {
  const insertStmt = db.prepare(`
    INSERT INTO match_logs (
      id, match_id, leg, player_name, score_before, darts_json,
      visit_total, is_bust, is_checkout, score_after, timestamp
    )
    VALUES (
      @id, @match_id, @leg, @player_name, @score_before, @darts_json,
      @visit_total, @is_bust, @is_checkout, @score_after, @timestamp
    )
    ON CONFLICT(id) DO UPDATE SET
      visit_total = excluded.visit_total,
      score_after = excluded.score_after
  `);

  const tx = db.transaction((items: VisitLog[]) => {
    for (const log of items) {
      insertStmt.run({
        id: log.id,
        match_id: matchId,
        leg: log.leg ?? 1,
        player_name: log.playerName,
        score_before: log.scoreBefore,
        darts_json: JSON.stringify(log.darts || []),
        visit_total: log.visitTotal ?? 0,
        is_bust: log.isBust ? 1 : 0,
        is_checkout: log.isCheckout ? 1 : 0,
        score_after: log.scoreAfter ?? 0,
        timestamp: String(log.timestamp || new Date().toISOString()),
      });
    }
  });

  tx(logs);
}

export function getMatchLogsDb(db: Database.Database, matchId: string): VisitLog[] {
  const rows = db
    .prepare('SELECT * FROM match_logs WHERE match_id = ? ORDER BY timestamp ASC')
    .all(matchId) as {
      id: string;
      leg: number;
      player_name: string;
      score_before: number;
      darts_json: string;
      visit_total: number;
      is_bust: number;
      is_checkout: number;
      score_after: number;
      timestamp: string;
    }[];

  return rows.map((r) => ({
    id: r.id,
    leg: r.leg,
    playerIndex: 0,
    playerName: r.player_name,
    scoreBefore: r.score_before,
    darts: JSON.parse(r.darts_json),
    visitTotal: r.visit_total,
    isBust: Boolean(r.is_bust),
    isCheckout: Boolean(r.is_checkout),
    scoreAfter: r.score_after,
    timestamp: r.timestamp,
  }));
}

export function saveAuditLogDb(db: Database.Database, log: AuditLog): void {
  const stmt = db.prepare(`
    INSERT INTO audit_logs (id, action, entity_type, entity_id, details, timestamp)
    VALUES (@id, @action, @entity_type, @entity_id, @details, @timestamp)
    ON CONFLICT(id) DO UPDATE SET
      action = excluded.action,
      entity_type = excluded.entity_type,
      entity_id = excluded.entity_id,
      details = excluded.details,
      timestamp = excluded.timestamp
  `);

  stmt.run({
    id: log.id,
    action: log.action,
    entity_type: log.entityType,
    entity_id: log.entityId ?? null,
    details: log.details ?? null,
    timestamp: log.timestamp || new Date().toISOString(),
  });
}

export function listAuditLogsDb(
  db: Database.Database,
  options?: { limit?: number; entityType?: string; entityId?: string },
): AuditLog[] {
  let query = 'SELECT * FROM audit_logs';
  const params: (string | number)[] = [];
  const whereClauses: string[] = [];

  if (options?.entityType) {
    whereClauses.push('entity_type = ?');
    params.push(options.entityType);
  }
  if (options?.entityId) {
    whereClauses.push('entity_id = ?');
    params.push(options.entityId);
  }

  if (whereClauses.length > 0) {
    query += ` WHERE ${whereClauses.join(' AND ')}`;
  }

  query += ' ORDER BY timestamp DESC';

  if (typeof options?.limit === 'number' && options.limit > 0) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }

  const rows = db.prepare(query).all(...params) as {
    id: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    details: string | null;
    timestamp: string;
  }[];

  return rows.map((r) => ({
    id: r.id,
    action: r.action,
    entityType: r.entity_type as AuditLog['entityType'],
    entityId: r.entity_id ?? undefined,
    details: r.details ?? undefined,
    timestamp: r.timestamp,
  }));
}

