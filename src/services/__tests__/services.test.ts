import { describe, it, expect, beforeEach } from 'vitest';
import {
  exportStandingsToCsv,
  exportPlayerStatsToCsv,
  exportGameLogsToCsv,
  exportAuditLogsToCsv,
  generateMatchReportHtml,
  generateTournamentBracketHtml,
  exportChallongeBracketToCsv,
} from '../export';
import {
  saveCurrentMatch,
  loadCurrentMatch,
  clearCurrentMatch,
  saveStoredMatch,
  listStoredMatches,
  getStoredMatch,
  deleteStoredMatch,
  saveTournament,
  loadTournament,
  clearTournament,
} from '../storage';
import { createInitialMatchState } from '../../core/scoring';
import { createTournament, createChallongeTournament } from '../../core/tournament';

describe('Storage and Export Services', () => {
  beforeEach(() => {
    // In-memory localStorage mock for node environment
    const store: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (key: string) => store[key] ?? null,
      setItem: (key: string, value: string) => {
        store[key] = value;
      },
      removeItem: (key: string) => {
        delete store[key];
      },
      clear: () => {
        for (const k of Object.keys(store)) delete store[k];
      },
      key: (_i: number) => null,
      length: Object.keys(store).length,
    };
  });

  it('saves, loads and clears active match state from localStorage', () => {
    const match = createInitialMatchState({ playerNames: ['P1', 'P2'] });
    saveCurrentMatch(match);
    let loaded = loadCurrentMatch();
    expect(loaded).toBeDefined();
    expect(loaded?.players[0].name).toBe('P1');

    clearCurrentMatch();
    loaded = loadCurrentMatch();
    expect(loaded).toBeNull();
  });

  it('saves, loads and clears tournament state from localStorage', () => {
    const tournament = createTournament({ name: 'Darts Open', players: ['P1', 'P2', 'P3', 'P4'] });
    saveTournament(tournament);
    let loaded = loadTournament();
    expect(loaded).toBeDefined();
    expect(loaded?.name).toBe('Darts Open');

    clearTournament();
    loaded = loadTournament();
    expect(loaded).toBeNull();
  });

  it('manages multiple stored matches with CRUD operations', () => {
    const m1 = createInitialMatchState({ playerNames: ['P1', 'P2'] });
    const m2 = createInitialMatchState({ playerNames: ['P3', 'P4'] });

    saveStoredMatch('match-1', m1);
    saveStoredMatch('match-2', m2);

    const list = listStoredMatches();
    expect(list).toHaveLength(2);
    expect(list.map((m) => m.id)).toContain('match-1');
    expect(list.map((m) => m.id)).toContain('match-2');

    const retrieved = getStoredMatch('match-1');
    expect(retrieved?.players[0].name).toBe('P1');

    const deleted = deleteStoredMatch('match-1');
    expect(deleted).toBe(true);

    const afterDelete = listStoredMatches();
    expect(afterDelete).toHaveLength(1);
    expect(afterDelete[0].id).toBe('match-2');
    expect(getStoredMatch('match-1')).toBeNull();

    // Deleting non-existent returns false
    expect(deleteStoredMatch('match-non-existent')).toBe(false);
  });

  it('exports standings to properly formatted CSV', () => {
    const tournament = createTournament({ name: 'Darts Open', players: ['Alice', 'Bob', 'Charlie', 'Dave'] });
    const csv = exportStandingsToCsv(tournament.pools[0]);
    expect(csv).toContain('Rank,Player,Played,Won,Lost,Legs For,Legs Against,Leg Diff,3-Dart Avg,High Finish');
    expect(csv).toContain('Alice');
    expect(csv).toContain('Bob');
  });

  it('exports player statistics to CSV', () => {
    const match = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    match.players[0].high = 180;
    match.players[0].ton = 3;
    const csv = exportPlayerStatsToCsv(match.players);
    expect(csv).toContain('Player,Legs Won,Darts Thrown,Points Scored,3-Dart Avg,Highest Score,100+,140+,180s,Best Checkout');
    expect(csv).toContain('Alice');
    expect(csv).toContain('180');
  });

  it('exports game round logs to properly formatted CSV', () => {
    const logs = [
      {
        id: 'log-1',
        leg: 1,
        playerIndex: 0,
        playerName: 'Alice',
        scoreBefore: 501,
        darts: [{ m: 3, n: 20 }, { m: 3, n: 20 }, { m: 3, n: 20 }],
        visitTotal: 180,
        isBust: false,
        isCheckout: false,
        scoreAfter: 321,
        timestamp: '2026-10-03T10:00:00Z',
      },
    ];

    const csv = exportGameLogsToCsv(logs);
    expect(csv).toContain('Leg,Player,Darts,Round Score,Score Before,Score After,Status');
    expect(csv).toContain('Alice');
    expect(csv).toContain('T20 T20 T20');
    expect(csv).toContain('180');
  });

  it('exports audit logs to properly formatted CSV', () => {
    const logs = [
      {
        id: 'audit-1',
        action: 'CREATE_TOURNAMENT',
        entityType: 'tournament' as const,
        entityId: 'tourney-1',
        details: 'Tournament created with 8 players',
        timestamp: '2026-10-03T10:00:00Z',
      },
    ];

    const csv = exportAuditLogsToCsv(logs);
    expect(csv).toContain('ID,Timestamp,Action,Entity Type,Entity ID,Details');
    expect(csv).toContain('audit-1');
    expect(csv).toContain('CREATE_TOURNAMENT');
    expect(csv).toContain('tournament');
  });

  it('generates complete printable HTML report for a match with stats and round logs', () => {
    const match = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });
    match.winner = 'Alice';
    match.over = true;
    match.players[0].legs = 3;
    match.players[0].points = 1503;
    match.players[0].darts = 45;
    match.players[0].high = 180;
    match.logs = [
      {
        id: 'log-1',
        leg: 1,
        playerIndex: 0,
        playerName: 'Alice',
        scoreBefore: 501,
        darts: [{ m: 3, n: 20 }, { m: 3, n: 20 }, { m: 3, n: 20 }],
        visitTotal: 180,
        isBust: false,
        isCheckout: false,
        scoreAfter: 321,
        timestamp: '2026-10-03T10:00:00Z',
      },
    ];

    const html = generateMatchReportHtml(match);
    expect(html).toContain('Alice');
    expect(html).toContain('Bob');
    expect(html).toContain('180');
    expect(html).toContain('T20 T20 T20');
    expect(html).toContain('@media print');
  });

  it('generates printable HTML report for a Challonge tournament bracket', () => {
    const tourney = createTournament({ name: 'Winter Open', players: ['P1', 'P2', 'P3', 'P4'] });
    const html = generateTournamentBracketHtml(tourney);
    expect(html).toContain('Winter Open');
    expect(html).toContain('@media print');
  });

  it('exports Challonge tournament matches to CSV', () => {
    const tourney = createChallongeTournament({ name: 'Challonge Cup', players: ['Alice', 'Bob', 'Charlie', 'Dave'] });
    const csv = exportChallongeBracketToCsv(tourney);
    expect(csv).toContain('Round,Match,Player 1,Seed 1,Score 1,Score 2,Player 2,Seed 2,Winner,Status');
    expect(csv).toContain('Semi-Final');
    expect(csv).toContain('Alice');
  });
});



