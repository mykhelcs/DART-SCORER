export type GameMode = 301 | 501 | 701;

export interface Dart {
  /** Multiplier: 0 = Miss, 1 = Single, 2 = Double, 3 = Treble */
  m: number;
  /** Number: 1-20 or 25 (Bullseye) */
  n: number;
}

export interface PlayerStats {
  name: string;
  score: number;
  legs: number;
  darts: number;
  points: number;
  high: number;
  ton: number;    // 100+
  t40: number;    // 140+
  one80: number;  // 180s
  bestOut: number;
  lastVisit: string | number;
}

export interface MatchState {
  mode: GameMode;
  doubleOut: boolean;
  legsToWin: number;
  cur: number;       // Current player index
  starter: number;   // Index of player who started the current leg
  visit: Dart[];     // Darts thrown in the active visit (0 to 3)
  over: boolean;
  winner: string | null;
  players: PlayerStats[];
  history: string[]; // Serialized state snapshots for multi-level undo
}

export interface CheckoutHint {
  target: number;
  darts: Dart[];
  text: string;
}

export interface PoolPlayerRecord {
  id: string;
  name: string;
  played: number;
  wins: number;
  losses: number;
  legsFor: number;
  legsAgainst: number;
  legDiff: number;
  pointsScored: number;
  dartsThrown: number;
  threeDartAvg: number;
  highFinish: number;
}

export interface PoolFixture {
  id: string;
  poolId: string;
  player1: string;
  player2: string;
  legsToWin: number;
  played: boolean;
  player1Score?: number;
  player2Score?: number;
  winner?: string;
}

export interface PoolGroup {
  id: string;
  name: string; // e.g., "Pool A", "Pool B"
  players: string[];
  fixtures: PoolFixture[];
  standings: PoolPlayerRecord[];
}

export interface KnockoutMatch {
  id: string;
  round: 'Quarter-Final' | 'Semi-Final' | 'Final';
  matchNumber: number;
  player1: string | null;
  player2: string | null;
  legsToWin: number;
  winner: string | null;
  player1Legs: number;
  player2Legs: number;
  completed: boolean;
}

export interface TournamentState {
  id: string;
  name: string;
  gameMode: GameMode;
  doubleOut: boolean;
  poolLegsToWin: number;
  koQuarterLegsToWin: number;
  koSemiLegsToWin: number;
  koFinalLegsToWin: number;
  pools: PoolGroup[];
  knockoutMatches: KnockoutMatch[];
  champion: string | null;
}
