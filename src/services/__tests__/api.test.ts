import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkBackendHealth,
  apiSaveTournament,
  apiLoadTournaments,
  apiSaveMatch,
  apiLoadMatch,
  apiListMatches,
  apiDeleteMatch,
  apiSaveAuditLog,
  apiGetAuditLogs,
} from '../api';
import { createTournament } from '../../core/tournament';
import { createInitialMatchState } from '../../core/scoring';

describe('Frontend API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('checks backend health returning true when online', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok' }),
    });

    const isHealthy = await checkBackendHealth();
    expect(isHealthy).toBe(true);
  });

  it('gracefully returns false when backend health check fails or throws', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const isHealthy = await checkBackendHealth();
    expect(isHealthy).toBe(false);
  });

  it('saves and loads tournaments through api', async () => {
    const tourney = createTournament({ name: 'Cup', players: ['P1', 'P2'] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ tournaments: [tourney] }),
    });

    const saved = await apiSaveTournament(tourney);
    expect(saved).toBe(true);

    const list = await apiLoadTournaments();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Cup');
  });

  it('saves and loads match state through api', async () => {
    const match = createInitialMatchState({ playerNames: ['P1', 'P2'] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ match }),
    });

    const saved = await apiSaveMatch('m1', match);
    expect(saved).toBe(true);

    const loaded = await apiLoadMatch('m1');
    expect(loaded).not.toBeNull();
    expect(loaded?.players[0].name).toBe('P1');
  });

  it('lists and deletes matches through api', async () => {
    const match = createInitialMatchState({ playerNames: ['Alice', 'Bob'] });

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        matches: [{ id: 'match-1', match, createdAt: '2026-10-04T00:00:00Z', updatedAt: '2026-10-04T00:00:00Z' }],
      }),
    });

    const matches = await apiListMatches();
    expect(matches).toHaveLength(1);
    expect(matches[0].id).toBe('match-1');

    // Test delete
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const deleted = await apiDeleteMatch('match-1');
    expect(deleted).toBe(true);

    // Test delete failure
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const failDelete = await apiDeleteMatch('match-999');
    expect(failDelete).toBe(false);
  });

  it('saves and fetches audit logs through api', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        auditLogs: [
          {
            id: 'a1',
            action: 'CREATE_TOURNAMENT',
            entityType: 'tournament',
            timestamp: '2026-10-03T10:00:00Z',
          },
        ],
      }),
    });

    const saved = await apiSaveAuditLog({
      action: 'CREATE_TOURNAMENT',
      entityType: 'tournament',
      entityId: 't1',
      details: 'Created',
    });
    expect(saved).toBe(true);

    const logs = await apiGetAuditLogs({ limit: 10 });
    expect(logs).toHaveLength(1);
    expect(logs[0].action).toBe('CREATE_TOURNAMENT');
  });
});

