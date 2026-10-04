import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createTournament, createChallongeTournament } from '../../core/tournament';
import {
  syncTournamentToMatchesCatalog,
  handleTournamentMatchCompleted,
} from '../tournamentSync';
import { listStoredMatches } from '../storage';
import { createInitialMatchState } from '../../core/scoring';

describe('Tournament Match Synchronization Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
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

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: 'ok' }),
    });
  });

  it('automatically syncs all initial pool fixtures into the matches catalog upon tournament start', async () => {
    const tourney = createTournament({
      name: 'Intramural Open',
      players: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
      poolLegsToWin: 1,
    });

    const result = await syncTournamentToMatchesCatalog(tourney);
    expect(result.createdCount).toBe(12); // 6 matches in Pool A + 6 matches in Pool B

    const storedMatches = listStoredMatches();
    expect(storedMatches).toHaveLength(12);

    const firstMatch = storedMatches[0];
    expect(firstMatch.tournamentId).toBe(tourney.id);
    expect(firstMatch.match.legsToWin).toBe(1);
    expect(firstMatch.match.players).toHaveLength(2);
  });

  it('updates tournament state and progresses to knockout when last pool match finishes', async () => {
    let tourney = createTournament({
      name: 'Auto Progression',
      players: ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4'],
      poolLegsToWin: 1,
      koSemiLegsToWin: 2,
      koFinalLegsToWin: 3,
    });

    await syncTournamentToMatchesCatalog(tourney);

    // Complete all Pool A matches except the last
    const poolAFixtures = tourney.pools[0].fixtures;
    for (let i = 0; i < poolAFixtures.length - 1; i++) {
      const fix = poolAFixtures[i];
      const matchState = createInitialMatchState({ playerNames: [fix.player1, fix.player2] });
      matchState.over = true;
      matchState.winner = fix.player1;
      matchState.players[0].legs = 1;
      const res = await handleTournamentMatchCompleted(tourney, `${tourney.id}-${fix.id}`, matchState);
      tourney = res.updatedTournament;
    }

    // Complete all Pool B matches
    for (const fix of tourney.pools[1].fixtures) {
      const matchState = createInitialMatchState({ playerNames: [fix.player1, fix.player2] });
      matchState.over = true;
      matchState.winner = fix.player1;
      matchState.players[0].legs = 1;
      const res = await handleTournamentMatchCompleted(tourney, `${tourney.id}-${fix.id}`, matchState);
      tourney = res.updatedTournament;
    }

    // Now play the very last pool match
    const lastFix = poolAFixtures[poolAFixtures.length - 1];
    const lastMatchState = createInitialMatchState({ playerNames: [lastFix.player1, lastFix.player2] });
    lastMatchState.over = true;
    lastMatchState.winner = lastFix.player1;
    lastMatchState.players[0].legs = 1;

    const finalPoolRes = await handleTournamentMatchCompleted(
      tourney,
      `${tourney.id}-${lastFix.id}`,
      lastMatchState,
    );

    expect(finalPoolRes.stageEvent).toBe('pools_completed');
    expect(finalPoolRes.updatedTournament.knockoutMatches.length).toBeGreaterThanOrEqual(3);

    // Semifinals should now be automatically added to the matches catalog
    const allMatches = listStoredMatches();
    const semi1Record = allMatches.find((m) => m.id === `${tourney.id}-ko-semi-1`);
    const semi2Record = allMatches.find((m) => m.id === `${tourney.id}-ko-semi-2`);
    expect(semi1Record).toBeDefined();
    expect(semi2Record).toBeDefined();
    expect(semi1Record?.match.legsToWin).toBe(2);

    // Now play the two Semifinal matches
    const semi1 = finalPoolRes.updatedTournament.knockoutMatches.find((m) => m.id === 'ko-semi-1')!;
    const semi1State = createInitialMatchState({
      playerNames: [semi1.player1!, semi1.player2!],
      legsToWin: 2,
    });
    semi1State.over = true;
    semi1State.winner = semi1.player1!;
    semi1State.players[0].legs = 2;
    semi1State.players[1].legs = 0;

    const semi1Res = await handleTournamentMatchCompleted(
      finalPoolRes.updatedTournament,
      `${tourney.id}-${semi1.id}`,
      semi1State,
    );

    const semi2 = semi1Res.updatedTournament.knockoutMatches.find((m) => m.id === 'ko-semi-2')!;
    const semi2State = createInitialMatchState({
      playerNames: [semi2.player1!, semi2.player2!],
      legsToWin: 2,
    });
    semi2State.over = true;
    semi2State.winner = semi2.player1!;
    semi2State.players[0].legs = 2;
    semi2State.players[1].legs = 1;

    const semi2Res = await handleTournamentMatchCompleted(
      semi1Res.updatedTournament,
      `${tourney.id}-${semi2.id}`,
      semi2State,
    );

    expect(semi2Res.stageEvent).toBe('finalists_set');
    const finalMatch = semi2Res.updatedTournament.knockoutMatches.find((m) => m.round === 'Final')!;
    expect(finalMatch.player1).toBe(semi1.player1);
    expect(finalMatch.player2).toBe(semi2.player1);

    // Final match should now be in the catalog
    const finalStored = listStoredMatches().find((m) => m.id === `${tourney.id}-${finalMatch.id}`);
    expect(finalStored).toBeDefined();

    // Play and finish the championship final match
    const finalState = createInitialMatchState({
      playerNames: [finalMatch.player1!, finalMatch.player2!],
      legsToWin: 3,
    });
    finalState.over = true;
    finalState.winner = finalMatch.player1!;
    finalState.players[0].legs = 3;
    finalState.players[1].legs = 1;

    const champRes = await handleTournamentMatchCompleted(
      semi2Res.updatedTournament,
      `${tourney.id}-${finalMatch.id}`,
      finalState,
    );

    expect(champRes.stageEvent).toBe('champion_crowned');
    expect(champRes.updatedTournament.champion).toBe(finalMatch.player1);
  });

  it('updates existing match in catalog when scores change', async () => {
    const tourney = createTournament({
      name: 'Resync Tourney',
      players: ['P1', 'P2', 'P3', 'P4'],
      poolLegsToWin: 2,
      koQuarterLegsToWin: 2,
      koSemiLegsToWin: 2,
      koFinalLegsToWin: 3,
    });

    const res1 = await syncTournamentToMatchesCatalog(tourney);
    expect(res1.createdCount).toBeGreaterThan(0);

    // Modify a pool fixture
    tourney.pools[0].fixtures[0].player1Score = 2;
    tourney.pools[0].fixtures[0].player2Score = 1;
    tourney.pools[0].fixtures[0].winner = tourney.pools[0].fixtures[0].player1;
    tourney.pools[0].fixtures[0].played = true;

    const res2 = await syncTournamentToMatchesCatalog(tourney);
    expect(res2.updatedCount).toBeGreaterThanOrEqual(1);
  });

  it('syncs and handles Challonge single elimination tournament matches', async () => {
    const challongeTourney = createChallongeTournament({
      name: 'Challonge Cup',
      players: ['Alpha', 'Bravo', 'Charlie', 'Delta'],
      legsToWin: 2,
      semiLegsToWin: 3,
      finalLegsToWin: 5,
    });

    const syncRes = await syncTournamentToMatchesCatalog(challongeTourney);
    expect(syncRes.createdCount).toBeGreaterThan(0);

    const firstMatch = challongeTourney.challongeMatches!.find(
      (m) => m.player1 && m.player2 && !m.player1.startsWith('BYE') && !m.player2.startsWith('BYE'),
    )!;

    const matchState = createInitialMatchState({
      playerNames: [firstMatch.player1!, firstMatch.player2!],
      legsToWin: firstMatch.legsToWin,
    });
    matchState.over = true;
    matchState.winner = firstMatch.player1!;
    matchState.players[0].legs = firstMatch.legsToWin;
    matchState.players[1].legs = 0;

    const compRes = await handleTournamentMatchCompleted(
      challongeTourney,
      `${challongeTourney.id}-${firstMatch.id}`,
      matchState,
    );

    expect(compRes.updatedTournament.challongeMatches).toBeDefined();
    const updatedM = compRes.updatedTournament.challongeMatches!.find((m) => m.id === firstMatch.id);
    expect(updatedM?.completed).toBe(true);
  });
});
