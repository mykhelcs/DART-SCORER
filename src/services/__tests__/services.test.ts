import { describe, it, expect, beforeEach } from 'vitest';
import { exportStandingsToCsv, exportPlayerStatsToCsv } from '../export';
import {
  saveCurrentMatch,
  loadCurrentMatch,
  clearCurrentMatch,
  saveTournament,
  loadTournament,
  clearTournament,
} from '../storage';
import { createInitialMatchState } from '../../core/scoring';
import { createTournament } from '../../core/tournament';

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
});
