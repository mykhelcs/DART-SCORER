import { SavedMatchRecord } from './types';

/**
 * Compares two player lists regardless of ordering, case, and surrounding whitespace.
 */
export function arePlayerListsIdentical(playersA: string[], playersB: string[]): boolean {
  if (!playersA || !playersB) return false;
  const cleanA = playersA.map((p) => p.trim().toLowerCase()).filter(Boolean);
  const cleanB = playersB.map((p) => p.trim().toLowerCase()).filter(Boolean);

  if (cleanA.length !== cleanB.length) return false;

  const sortedA = [...cleanA].sort();
  const sortedB = [...cleanB].sort();

  return sortedA.every((name, i) => name === sortedB[i]);
}

/**
 * Searches existing stored matches for a match with an identical player roster.
 * Prioritizes active (in-progress) matches over completed ones.
 */
export function findDuplicateMatch(
  candidate: { playerNames: string[]; mode?: number; legsToWin?: number },
  existingMatches: SavedMatchRecord[],
): SavedMatchRecord | null {
  if (!candidate.playerNames || candidate.playerNames.length === 0 || !existingMatches) {
    return null;
  }

  const duplicates = existingMatches.filter((item) => {
    const existingPlayerNames = item.match.players.map((p) => p.name);
    return arePlayerListsIdentical(candidate.playerNames, existingPlayerNames);
  });

  if (duplicates.length === 0) return null;

  // Prioritize active (not over) matches
  const activeDup = duplicates.find((d) => !d.match.over);
  if (activeDup) return activeDup;

  // Otherwise return the most recently updated match
  return duplicates.sort((a, b) => {
    const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
    const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
    return tB - tA;
  })[0];
}

/**
 * Strict rule check: Never auto-generate matches unless it is an active tournament entity.
 */
export function canAutoGenerateMatches(entity?: {
  isTournament?: boolean;
  tournamentId?: string | null;
  format?: string | null;
}): boolean {
  if (!entity) return false;
  if (!entity.isTournament && !entity.tournamentId) return false;
  if (!entity.tournamentId || typeof entity.tournamentId !== 'string' || entity.tournamentId.trim() === '') {
    return false;
  }
  const validFormats = ['pools_knockout', 'challonge_single_elim'];
  if (entity.format && !validFormats.includes(entity.format)) {
    return false;
  }
  return true;
}
