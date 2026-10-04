import { MatchState, TournamentState } from '../core/types';
import { createInitialMatchState } from '../core/scoring';
import {
  getPlayableTournamentMatches,
  advanceTournamentProgression,
  recordPoolMatchResult,
  recordKnockoutMatchResult,
  recordChallongeMatchResult,
} from '../core/tournament';
import { saveStoredMatch, getStoredMatch, saveTournament } from './storage';
import { apiSaveMatch, apiSaveTournament, apiSaveAuditLog } from './api';
import { canAutoGenerateMatches } from '../core/duplicateGuard';

export async function syncTournamentToMatchesCatalog(
  tournament: TournamentState,
): Promise<{ createdCount: number; updatedCount: number }> {
  // Strict Directive: Never auto-generate if not tournament
  if (
    !canAutoGenerateMatches({
      isTournament: true,
      tournamentId: tournament?.id,
      format: tournament?.format,
    })
  ) {
    return { createdCount: 0, updatedCount: 0 };
  }

  const playableMatches = getPlayableTournamentMatches(tournament);
  let createdCount = 0;
  let updatedCount = 0;

  for (const pm of playableMatches) {
    const existing = getStoredMatch(pm.id);

    if (!existing) {
      const initialMatch = createInitialMatchState({
        mode: tournament.gameMode || 501,
        doubleOut: tournament.doubleOut ?? true,
        legsToWin: pm.legsToWin,
        playerNames: [pm.player1, pm.player2],
      });

      if (pm.completed && pm.winner) {
        initialMatch.over = true;
        initialMatch.winner = pm.winner;
        if (typeof pm.player1Legs === 'number') initialMatch.players[0].legs = pm.player1Legs;
        if (typeof pm.player2Legs === 'number') initialMatch.players[1].legs = pm.player2Legs;
      }

      saveStoredMatch(pm.id, initialMatch, tournament.id);
      await apiSaveMatch(pm.id, initialMatch);
      createdCount++;
    } else {
      let changed = false;
      if (pm.completed && !existing.over) {
        existing.over = true;
        existing.winner = pm.winner;
        changed = true;
      }
      if (typeof pm.player1Legs === 'number' && existing.players[0].legs !== pm.player1Legs) {
        existing.players[0].legs = pm.player1Legs;
        changed = true;
      }
      if (typeof pm.player2Legs === 'number' && existing.players[1].legs !== pm.player2Legs) {
        existing.players[1].legs = pm.player2Legs;
        changed = true;
      }
      if (changed) {
        saveStoredMatch(pm.id, existing, tournament.id);
        await apiSaveMatch(pm.id, existing);
        updatedCount++;
      }
    }
  }

  return { createdCount, updatedCount };
}

export async function handleTournamentMatchCompleted(
  tournament: TournamentState,
  matchId: string,
  finalMatchState: MatchState,
): Promise<{
  updatedTournament: TournamentState;
  stageEvent?: 'pools_completed' | 'finalists_set' | 'champion_crowned';
}> {
  let updated: TournamentState = { ...tournament };
  const p1Legs = finalMatchState.players[0]?.legs ?? 0;
  const p2Legs = finalMatchState.players[1]?.legs ?? 0;

  const prefix = `${tournament.id}-`;
  const innerId = matchId.startsWith(prefix) ? matchId.slice(prefix.length) : matchId;

  // 1. Is this a pool fixture?
  let isPoolMatch = false;
  if (updated.pools) {
    for (const pool of updated.pools) {
      const fix = pool.fixtures.find((f) => f.id === innerId);
      if (fix) {
        isPoolMatch = true;
        const p1 = finalMatchState.players[0];
        const p2 = finalMatchState.players[1];
        updated = recordPoolMatchResult(updated, pool.id, fix.id, {
          player1Legs: p1Legs,
          player2Legs: p2Legs,
          player1Stats: p1 ? { points: p1.points, darts: p1.darts, highFinish: p1.bestOut } : undefined,
          player2Stats: p2 ? { points: p2.points, darts: p2.darts, highFinish: p2.bestOut } : undefined,
        });
        break;
      }
    }
  }

  // 2. Is this a knockout match?
  if (!isPoolMatch && updated.knockoutMatches) {
    const km = updated.knockoutMatches.find((m) => m.id === innerId);
    if (km) {
      updated = recordKnockoutMatchResult(updated, km.id, {
        player1Legs: p1Legs,
        player2Legs: p2Legs,
      });
    }
  }

  // 3. Is this a Challonge match?
  if (!isPoolMatch && updated.challongeMatches) {
    const cm = updated.challongeMatches.find((m) => m.id === innerId);
    if (cm) {
      updated = recordChallongeMatchResult(updated, cm.id, p1Legs, p2Legs);
    }
  }

  // 4. Advance progression automatically!
  const adv = advanceTournamentProgression(updated, tournament);
  updated = adv.updatedTournament;

  // 5. Save updated match in catalog
  saveStoredMatch(matchId, finalMatchState, tournament.id);
  await apiSaveMatch(matchId, finalMatchState);

  // 6. Automatically sync any newly unlocked next-stage matches into the catalog!
  await syncTournamentToMatchesCatalog(updated);

  // 7. Persist updated tournament state
  saveTournament(updated);
  await apiSaveTournament(updated);

  if (adv.stageEvent === 'champion_crowned') {
    await apiSaveAuditLog({
      action: 'TOURNAMENT_CHAMPION_CROWNED',
      entityType: 'tournament',
      entityId: updated.id,
      details: `Tournament "${updated.name}" won by ${updated.champion}!`,
    });
  } else if (adv.stageEvent === 'pools_completed') {
    await apiSaveAuditLog({
      action: 'POOLS_COMPLETED',
      entityType: 'tournament',
      entityId: updated.id,
      details: `Group stage complete for "${updated.name}". Knockout stage generated.`,
    });
  }

  return { updatedTournament: updated, stageEvent: adv.stageEvent };
}
