import { MatchState, TournamentState } from '../core/types';

const MATCH_KEY = 'darts_scorer_active_match';
const TOURNAMENT_KEY = 'darts_scorer_active_tournament';

export function saveCurrentMatch(match: MatchState): void {
  try {
    localStorage.setItem(MATCH_KEY, JSON.stringify(match));
  } catch (e) {
    console.error('Failed to save match to localStorage', e);
  }
}

export function loadCurrentMatch(): MatchState | null {
  try {
    const raw = localStorage.getItem(MATCH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as MatchState;
  } catch (e) {
    console.error('Failed to load match from localStorage', e);
    return null;
  }
}

export function clearCurrentMatch(): void {
  try {
    localStorage.removeItem(MATCH_KEY);
  } catch (e) {
    console.error('Failed to clear match', e);
  }
}

export function saveTournament(tournament: TournamentState): void {
  try {
    localStorage.setItem(TOURNAMENT_KEY, JSON.stringify(tournament));
  } catch (e) {
    console.error('Failed to save tournament to localStorage', e);
  }
}

export function loadTournament(): TournamentState | null {
  try {
    const raw = localStorage.getItem(TOURNAMENT_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as TournamentState;
  } catch (e) {
    console.error('Failed to load tournament from localStorage', e);
    return null;
  }
}

export function clearTournament(): void {
  try {
    localStorage.removeItem(TOURNAMENT_KEY);
  } catch (e) {
    console.error('Failed to clear tournament', e);
  }
}
