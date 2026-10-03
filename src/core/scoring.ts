import { Dart, GameMode, MatchState, PlayerStats } from './types';
import { getDartValue } from './checkout';

export function getVisitSum(visit: Dart[]): number {
  return visit.reduce((acc, d) => acc + getDartValue(d), 0);
}

export function createInitialMatchState(options: {
  mode?: GameMode;
  doubleOut?: boolean;
  legsToWin?: number;
  playerNames: string[];
}): MatchState {
  const mode = options.mode ?? 501;
  const doubleOut = options.doubleOut ?? true;
  const legsToWin = options.legsToWin ?? 3;
  const cleanNames = options.playerNames.map((n) => n.trim()).filter(Boolean);
  const names = cleanNames.length > 0 ? cleanNames : ['Player 1', 'Player 2'];

  const players: PlayerStats[] = names.map((name) => ({
    name,
    score: mode,
    legs: 0,
    darts: 0,
    points: 0,
    high: 0,
    ton: 0,
    t40: 0,
    one80: 0,
    bestOut: 0,
    lastVisit: '-',
  }));

  return {
    mode,
    doubleOut,
    legsToWin,
    cur: 0,
    starter: 0,
    visit: [],
    over: false,
    winner: null,
    players,
    history: [],
  };
}

function cloneState(state: MatchState): MatchState {
  return JSON.parse(JSON.stringify(state));
}

export type DartThrowResult = {
  state: MatchState;
  event: 'none' | 'bust' | 'turn_end' | 'leg_won' | 'match_won';
  message?: string;
  scored?: number;
};

export function throwDart(currentState: MatchState, dart: Dart): DartThrowResult {
  if (currentState.over) {
    return { state: currentState, event: 'none' };
  }

  // Create a deep copy to ensure immutability and save snapshot to history
  const state = cloneState(currentState);
  const snapshot = JSON.stringify(currentState);
  state.history.push(snapshot);
  if (state.history.length > 300) {
    state.history.shift();
  }

  const p = state.players[state.cur];
  state.visit.push(dart);

  const sum = getVisitSum(state.visit);
  const rem = p.score - sum;

  // Bust condition:
  // 1. rem < 0
  // 2. with doubleOut: rem === 1
  // 3. with doubleOut: rem === 0 but the finishing dart is not a double (m !== 2)
  const isBust = rem < 0 || (state.doubleOut && (rem === 1 || (rem === 0 && dart.m !== 2)));

  if (isBust) {
    p.darts += state.visit.length;
    p.lastVisit = 'Bust';
    const message = `Bust! ${p.name} stays on ${p.score}`;
    state.visit = [];
    state.cur = (state.cur + 1) % state.players.length;
    return { state, event: 'bust', message };
  }

  // Leg Won / Checkout condition
  if (rem === 0) {
    p.darts += state.visit.length;
    p.points += sum;
    if (sum > p.high) p.high = sum;
    if (sum >= 100) p.ton++;
    if (sum >= 140) p.t40++;
    if (sum === 180) p.one80++;
    if (sum > p.bestOut) p.bestOut = sum;
    p.lastVisit = sum;
    p.score = 0;
    p.legs++;

    if (p.legs >= state.legsToWin) {
      state.over = true;
      state.winner = p.name;
      return {
        state,
        event: 'match_won',
        message: `${p.name} wins the match!`,
        scored: sum,
      };
    }

    return {
      state,
      event: 'leg_won',
      message: `${p.name} takes the leg!`,
      scored: sum,
    };
  }

  // 3 Darts completed normal visit
  if (state.visit.length === 3) {
    p.darts += 3;
    p.points += sum;
    if (sum > p.high) p.high = sum;
    if (sum >= 100) p.ton++;
    if (sum >= 140) p.t40++;
    if (sum === 180) p.one80++;
    p.score = rem;
    p.lastVisit = sum;

    let message: string | undefined;
    if (sum === 180) {
      message = 'One hundred and eighty!';
    } else if (sum >= 100) {
      message = `${sum} scored`;
    }

    state.visit = [];
    state.cur = (state.cur + 1) % state.players.length;
    return { state, event: 'turn_end', message, scored: sum };
  }

  return { state, event: 'none' };
}

export function startNextLeg(currentState: MatchState): MatchState {
  if (currentState.over) return currentState;
  const state = cloneState(currentState);

  // Reset current scores to base mode
  for (const player of state.players) {
    player.score = state.mode;
  }

  // Alternate starter
  state.starter = (state.starter + 1) % state.players.length;
  state.cur = state.starter;
  state.visit = [];

  return state;
}

export function undo(currentState: MatchState): MatchState {
  if (!currentState.history || currentState.history.length === 0) {
    return currentState;
  }
  const prevSnapshot = currentState.history[currentState.history.length - 1];
  const parsed = JSON.parse(prevSnapshot) as MatchState;
  return parsed;
}
