import { describe, it, expect } from 'vitest';
import {
  arePlayerListsIdentical,
  findDuplicateMatch,
  canAutoGenerateMatches,
} from '../duplicateGuard';
import { SavedMatchRecord, MatchState } from '../types';

function createMockSavedMatch(
  id: string,
  players: string[],
  over: boolean = false,
  tournamentId?: string,
): SavedMatchRecord {
  const matchState: MatchState = {
    mode: 501,
    doubleOut: true,
    legsToWin: 3,
    currentLeg: 1,
    cur: 0,
    starter: 0,
    visit: [],
    over,
    winner: over ? players[0] : null,
    players: players.map((name) => ({
      name,
      score: 501,
      legs: 0,
      darts: 0,
      points: 0,
      high: 0,
      ton: 0,
      t40: 0,
      one80: 0,
      bestOut: 0,
      lastVisit: '-',
    })),
    history: [],
    logs: [],
  };

  return {
    id,
    match: matchState,
    tournamentId,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

describe('Duplicate Guard & Auto-Generation Safeguards', () => {
  describe('arePlayerListsIdentical', () => {
    it('detects identical player lists in same order', () => {
      expect(arePlayerListsIdentical(['Alice', 'Bob'], ['Alice', 'Bob'])).toBe(true);
    });

    it('detects identical player lists in different order', () => {
      expect(arePlayerListsIdentical(['Alice', 'Bob'], ['Bob', 'Alice'])).toBe(true);
    });

    it('ignores case and surrounding whitespace', () => {
      expect(arePlayerListsIdentical([' alice ', 'BOB'], ['bob', 'Alice'])).toBe(true);
    });

    it('returns false when players differ', () => {
      expect(arePlayerListsIdentical(['Alice', 'Bob'], ['Alice', 'Charlie'])).toBe(false);
      expect(arePlayerListsIdentical(['Alice', 'Bob'], ['Alice', 'Bob', 'Charlie'])).toBe(false);
    });
  });

  describe('findDuplicateMatch', () => {
    it('returns null when no matches exist', () => {
      const dup = findDuplicateMatch({ playerNames: ['Alice', 'Bob'] }, []);
      expect(dup).toBeNull();
    });

    it('detects duplicate among existing matches', () => {
      const existing = [
        createMockSavedMatch('match-1', ['Charlie', 'Dave']),
        createMockSavedMatch('match-2', ['Alice', 'Bob']),
      ];
      const dup = findDuplicateMatch({ playerNames: ['Bob', 'Alice'] }, existing);
      expect(dup).not.toBeNull();
      expect(dup?.id).toBe('match-2');
    });

    it('prioritizes in-progress matches over completed matches when duplicate exists', () => {
      const existing = [
        createMockSavedMatch('match-old-completed', ['Alice', 'Bob'], true),
        createMockSavedMatch('match-active', ['Bob', 'Alice'], false),
      ];
      const dup = findDuplicateMatch({ playerNames: ['Alice', 'Bob'] }, existing);
      expect(dup?.id).toBe('match-active');
    });

    it('returns null if different players', () => {
      const existing = [createMockSavedMatch('match-1', ['Alice', 'Charlie'])];
      const dup = findDuplicateMatch({ playerNames: ['Alice', 'Bob'] }, existing);
      expect(dup).toBeNull();
    });

    it('returns null if candidate playerNames is empty or existingMatches is empty/missing', () => {
      expect(findDuplicateMatch({ playerNames: [] }, [])).toBeNull();
      expect(findDuplicateMatch({ playerNames: ['A', 'B'] }, null as unknown as SavedMatchRecord[])).toBeNull();
    });

    it('sorts multiple completed duplicates by most recently updated', () => {
      const older = createMockSavedMatch('match-old', ['Alice', 'Bob'], true);
      older.updatedAt = '2026-01-01T00:00:00.000Z';
      const newer = createMockSavedMatch('match-new', ['Alice', 'Bob'], true);
      newer.updatedAt = '2026-02-01T00:00:00.000Z';

      const dup = findDuplicateMatch({ playerNames: ['Alice', 'Bob'] }, [older, newer]);
      expect(dup?.id).toBe('match-new');
    });
  });

  describe('canAutoGenerateMatches', () => {
    it('returns true ONLY for valid tournament entities', () => {
      expect(
        canAutoGenerateMatches({
          isTournament: true,
          tournamentId: 't-123',
          format: 'pools_knockout',
        }),
      ).toBe(true);

      expect(
        canAutoGenerateMatches({
          isTournament: true,
          tournamentId: 't-456',
          format: 'challonge_single_elim',
        }),
      ).toBe(true);
    });

    it('returns false for non-tournament, standalone matches or null entities', () => {
      expect(canAutoGenerateMatches(undefined)).toBe(false);
      expect(canAutoGenerateMatches({})).toBe(false);
      expect(canAutoGenerateMatches({ isTournament: false })).toBe(false);
      expect(canAutoGenerateMatches({ tournamentId: null })).toBe(false);
      expect(canAutoGenerateMatches({ tournamentId: '' })).toBe(false);
      expect(canAutoGenerateMatches({ tournamentId: '   ' })).toBe(false);
      expect(canAutoGenerateMatches({ tournamentId: 123 as unknown as string })).toBe(false);
      expect(canAutoGenerateMatches({ tournamentId: 't-1', format: 'unknown_format' })).toBe(false);
      expect(canAutoGenerateMatches({ format: 'regular' })).toBe(false);
    });
  });
});
