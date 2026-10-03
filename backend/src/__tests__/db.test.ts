import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDb,
  saveTournamentDb,
  getTournamentDb,
  listTournamentsDb,
  saveMatchDb,
  getMatchDb,
  listMatchesDb,
} from '../db/database';
import { createTournament } from '../../../src/core/tournament';
import { createInitialMatchState } from '../../../src/core/scoring';
import Database from 'better-sqlite3';

describe('SQLite Database Layer', () => {
  let db: Database.Database;

  beforeEach(() => {
    // In-memory SQLite database for clean test isolation
    db = initDb(':memory:');
  });

  afterEach(() => {
    db.close();
  });

  it('initializes tables properly in SQLite', () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as { name: string }[];
    const tableNames = tables.map((t) => t.name);

    expect(tableNames).toContain('tournaments');
    expect(tableNames).toContain('matches');
    expect(tableNames).toContain('players');
  });

  it('saves and retrieves tournament records accurately', () => {
    const tourney = createTournament({
      name: 'Intramural Open',
      players: ['Alice', 'Bob', 'Charlie', 'Dave'],
    });

    saveTournamentDb(db, tourney);
    const retrieved = getTournamentDb(db, tourney.id);

    expect(retrieved).not.toBeNull();
    expect(retrieved?.name).toBe('Intramural Open');
    expect(retrieved?.pools).toHaveLength(1);
    expect(retrieved?.pools[0].players).toContain('Alice');
  });

  it('lists all saved tournaments', () => {
    const t1 = createTournament({ name: 'Tournament 1', players: ['P1', 'P2', 'P3', 'P4'] });
    const t2 = createTournament({ name: 'Tournament 2', players: ['P5', 'P6', 'P7', 'P8'] });

    saveTournamentDb(db, t1);
    saveTournamentDb(db, t2);

    const list = listTournamentsDb(db);
    expect(list).toHaveLength(2);
    expect(list.map((t) => t.name)).toContain('Tournament 1');
    expect(list.map((t) => t.name)).toContain('Tournament 2');
  });

  it('saves and retrieves match states', () => {
    const match = createInitialMatchState({ playerNames: ['P1', 'P2'] });
    saveMatchDb(db, 'match-101', match);

    const retrieved = getMatchDb(db, 'match-101');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.players[0].name).toBe('P1');
    expect(retrieved?.mode).toBe(501);

    const allMatches = listMatchesDb(db);
    expect(allMatches.length).toBeGreaterThanOrEqual(1);
    expect(allMatches[0].id).toBe('match-101');
  });
});
