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

export interface VisitLog {
  id: string;
  leg: number;
  playerIndex: number;
  playerName: string;
  scoreBefore: number;
  darts: Dart[];
  visitTotal: number;
  isBust: boolean;
  isCheckout: boolean;
  scoreAfter: number;
  timestamp: string;
}

export interface MatchState {
  mode: GameMode;
  doubleOut: boolean;
  legsToWin: number;
  currentLeg: number;
  cur: number;       // Current player index
  starter: number;   // Index of player who started the current leg
  visit: Dart[];     // Darts thrown in the active visit (0 to 3)
  over: boolean;
  winner: string | null;
  players: PlayerStats[];
  logs: VisitLog[];  // Audit log of all completed visits in the game
  history: string[]; // Serialized state snapshots for multi-level undo
}

export interface AuditLog {
  id: string;
  action: string;
  entityType: 'tournament' | 'match' | 'system' | 'scorer';
  entityId?: string;
  details?: string;
  timestamp: string;
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

export type TournamentFormat = 'pools_knockout' | 'challonge_single_elim';

export interface ChallongeMatch {
  id: string;
  roundIndex: number;
  roundName: string; // e.g., 'Round 1', 'Quarter-Final', 'Semi-Final', 'Championship Final'
  matchNumber: number;
  player1: string | null;
  player2: string | null;
  player1Seed?: number;
  player2Seed?: number;
  legsToWin: number;
  player1Legs: number;
  player2Legs: number;
  winner: string | null;
  completed: boolean;
  isBye?: boolean;
  nextMatchId?: string;
  nextMatchSlot?: 1 | 2;
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
  format?: TournamentFormat;
  gameMode: GameMode;
  doubleOut: boolean;
  poolLegsToWin: number;
  koQuarterLegsToWin: number;
  koSemiLegsToWin: number;
  koFinalLegsToWin: number;
  pools: PoolGroup[];
  knockoutMatches: KnockoutMatch[];
  challongeMatches?: ChallongeMatch[];
  champion: string | null;
}

