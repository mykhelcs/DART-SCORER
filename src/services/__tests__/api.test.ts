import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkBackendHealth,
  apiSaveTournament,
  apiLoadTournaments,
  apiSaveMatch,
  apiLoadMatch,
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
});
