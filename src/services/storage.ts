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
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.players) || parsed.players.length === 0) {
      return null;
    }
    // Normalize missing properties
    if (!Array.isArray(parsed.visit)) parsed.visit = [];
    if (!Array.isArray(parsed.logs)) parsed.logs = [];
    if (!Array.isArray(parsed.history)) parsed.history = [];
    if (typeof parsed.currentLeg !== 'number') parsed.currentLeg = 1;
    if (typeof parsed.cur !== 'number') parsed.cur = 0;
    if (typeof parsed.starter !== 'number') parsed.starter = 0;
    if (typeof parsed.over !== 'boolean') parsed.over = false;

    for (const p of parsed.players) {
      if (typeof p.score !== 'number') p.score = parsed.mode || 501;
      if (typeof p.legs !== 'number') p.legs = 0;
      if (typeof p.darts !== 'number') p.darts = 0;
      if (typeof p.points !== 'number') p.points = 0;
      if (typeof p.high !== 'number') p.high = 0;
      if (typeof p.ton !== 'number') p.ton = 0;
      if (typeof p.t40 !== 'number') p.t40 = 0;
      if (typeof p.one80 !== 'number') p.one80 = 0;
      if (typeof p.bestOut !== 'number') p.bestOut = 0;
      if (!p.lastVisit) p.lastVisit = '-';
    }

    return parsed as MatchState;
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
