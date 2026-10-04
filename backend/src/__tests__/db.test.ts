import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  initDb,
  saveTournamentDb,
  getTournamentDb,
  listTournamentsDb,
  saveMatchDb,
  getMatchDb,
  listMatchesDb,
  deleteMatchDb,
  saveMatchLogsDb,
  getMatchLogsDb,
  saveAuditLogDb,
  listAuditLogsDb,
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

  it('saves and retrieves match visit round logs in SQLite', () => {
    const logs = [
      {
        id: 'log-101-1',
        leg: 1,
        playerIndex: 0,
        playerName: 'Alice',
        scoreBefore: 501,
        darts: [{ m: 3, n: 20 }, { m: 3, n: 20 }, { m: 3, n: 20 }],
        visitTotal: 180,
        isBust: false,
        isCheckout: false,
        scoreAfter: 321,
        timestamp: new Date().toISOString(),
      },
    ];

    saveMatchLogsDb(db, 'match-101', logs);
    const retrievedLogs = getMatchLogsDb(db, 'match-101');
    expect(retrievedLogs).toHaveLength(1);
    expect(retrievedLogs[0].playerName).toBe('Alice');
    expect(retrievedLogs[0].visitTotal).toBe(180);
    expect(retrievedLogs[0].scoreAfter).toBe(321);
  });

  it('saves and retrieves audit logs with filtering by entityType and limit', () => {
    saveAuditLogDb(db, {
      id: 'audit-1',
      action: 'CREATE_TOURNAMENT',
      entityType: 'tournament',
      entityId: 't-1',
      details: 'Created tournament Spring Cup',
      timestamp: '2026-10-03T10:00:00.000Z',
    });

    saveAuditLogDb(db, {
      id: 'audit-2',
      action: 'SAVE_MATCH',
      entityType: 'match',
      entityId: 'm-1',
      details: 'Match saved with score 501',
      timestamp: '2026-10-03T10:05:00.000Z',
    });

    const allLogs = listAuditLogsDb(db);
    expect(allLogs).toHaveLength(2);
    // Ordered DESC by timestamp
    expect(allLogs[0].id).toBe('audit-2');

    const matchLogsOnly = listAuditLogsDb(db, { entityType: 'match' });
    expect(matchLogsOnly).toHaveLength(1);
    expect(matchLogsOnly[0].action).toBe('SAVE_MATCH');

    const limited = listAuditLogsDb(db, { limit: 1 });
    expect(limited).toHaveLength(1);
  });

  it('deletes a match and cleans up associated match logs', () => {
    const match = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    saveMatchDb(db, 'match-to-delete', match);

    saveMatchLogsDb(db, 'match-to-delete', [
      {
        id: 'log-del-1',
        leg: 1,
        playerIndex: 0,
        playerName: 'Alice',
        scoreBefore: 501,
        darts: [{ m: 3, n: 20 }],
        visitTotal: 60,
        isBust: false,
        isCheckout: false,
        scoreAfter: 441,
        timestamp: new Date().toISOString(),
      },
    ]);

    expect(getMatchDb(db, 'match-to-delete')).not.toBeNull();
    expect(getMatchLogsDb(db, 'match-to-delete')).toHaveLength(1);

    const deleted = deleteMatchDb(db, 'match-to-delete');
    expect(deleted).toBe(true);

    expect(getMatchDb(db, 'match-to-delete')).toBeNull();
    expect(getMatchLogsDb(db, 'match-to-delete')).toHaveLength(0);

    // Deleting non-existent returns false
    expect(deleteMatchDb(db, 'match-to-delete')).toBe(false);
  });
});

