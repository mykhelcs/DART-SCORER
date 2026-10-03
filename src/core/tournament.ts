import {
  GameMode,
  KnockoutMatch,
  PoolFixture,
  PoolGroup,
  PoolPlayerRecord,
  TournamentState,
} from './types';

export function calculateStandings(pool: PoolGroup): PoolPlayerRecord[] {
  return [...pool.standings].sort((a, b) => {
    // 1. Matches won
    if (b.wins !== a.wins) return b.wins - a.wins;
    // 2. Leg difference
    if (b.legDiff !== a.legDiff) return b.legDiff - a.legDiff;
    // 3. 3-dart average
    if (b.threeDartAvg !== a.threeDartAvg) return b.threeDartAvg - a.threeDartAvg;
    // 4. Alphabetical tie-breaker
    return a.name.localeCompare(b.name);
  });
}

export function createTournament(options: {
  name: string;
  players: string[];
  gameMode?: GameMode;
  doubleOut?: boolean;
  poolLegsToWin?: number;
  koQuarterLegsToWin?: number;
  koSemiLegsToWin?: number;
  koFinalLegsToWin?: number;
}): TournamentState {
  const cleanPlayers = options.players.map((p) => p.trim()).filter(Boolean);
  const poolLegsToWin = options.poolLegsToWin ?? 2;
  const koQuarterLegsToWin = options.koQuarterLegsToWin ?? 3;
  const koSemiLegsToWin = options.koSemiLegsToWin ?? 3;
  const koFinalLegsToWin = options.koFinalLegsToWin ?? 5;

  const poolSize = 4;
  const numPools = Math.max(1, Math.ceil(cleanPlayers.length / poolSize));
  const poolLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

  const pools: PoolGroup[] = [];
  for (let i = 0; i < numPools; i++) {
    const poolLetter = poolLetters[i % poolLetters.length];
    const poolPlayers = cleanPlayers.slice(i * poolSize, (i + 1) * poolSize);
    const poolId = `pool-${poolLetter.toLowerCase()}`;

    // Round-robin pairings
    const fixtures: PoolFixture[] = [];
    for (let p1 = 0; p1 < poolPlayers.length; p1++) {
      for (let p2 = p1 + 1; p2 < poolPlayers.length; p2++) {
        fixtures.push({
          id: `${poolId}-fix-${p1}-${p2}`,
          poolId,
          player1: poolPlayers[p1],
          player2: poolPlayers[p2],
          legsToWin: poolLegsToWin,
          played: false,
        });
      }
    }

    const standings: PoolPlayerRecord[] = poolPlayers.map((name) => ({
      id: `p-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      played: 0,
      wins: 0,
      losses: 0,
      legsFor: 0,
      legsAgainst: 0,
      legDiff: 0,
      pointsScored: 0,
      dartsThrown: 0,
      threeDartAvg: 0,
      highFinish: 0,
    }));

    pools.push({
      id: poolId,
      name: `Pool ${poolLetter}`,
      players: poolPlayers,
      fixtures,
      standings,
    });
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    id: `tourney-${Date.now()}-${randomSuffix}`,
    name: options.name,
    gameMode: options.gameMode ?? 501,
    doubleOut: options.doubleOut ?? true,
    poolLegsToWin,
    koQuarterLegsToWin,
    koSemiLegsToWin,
    koFinalLegsToWin,
    pools,
    knockoutMatches: [],
    champion: null,
  };
}

export function recordPoolMatchResult(
  tournament: TournamentState,
  poolId: string,
  fixtureId: string,
  result: {
    player1Legs: number;
    player2Legs: number;
    player1Stats?: { points: number; darts: number; highFinish: number };
    player2Stats?: { points: number; darts: number; highFinish: number };
  },
): TournamentState {
  const updated = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  const pool = updated.pools.find((p) => p.id === poolId);
  if (!pool) return tournament;

  const fix = pool.fixtures.find((f) => f.id === fixtureId);
  if (!fix) return tournament;

  fix.played = true;
  fix.player1Score = result.player1Legs;
  fix.player2Score = result.player2Legs;
  fix.winner = result.player1Legs > result.player2Legs ? fix.player1 : fix.player2;

  // Update standings
  const p1Record = pool.standings.find((s) => s.name === fix.player1);
  const p2Record = pool.standings.find((s) => s.name === fix.player2);

  if (p1Record && p2Record) {
    p1Record.played += 1;
    p2Record.played += 1;
    p1Record.legsFor += result.player1Legs;
    p1Record.legsAgainst += result.player2Legs;
    p1Record.legDiff = p1Record.legsFor - p1Record.legsAgainst;

    p2Record.legsFor += result.player2Legs;
    p2Record.legsAgainst += result.player1Legs;
    p2Record.legDiff = p2Record.legsFor - p2Record.legsAgainst;

    if (result.player1Legs > result.player2Legs) {
      p1Record.wins += 1;
      p2Record.losses += 1;
    } else {
      p2Record.wins += 1;
      p1Record.losses += 1;
    }

    if (result.player1Stats) {
      p1Record.pointsScored += result.player1Stats.points;
      p1Record.dartsThrown += result.player1Stats.darts;
      p1Record.threeDartAvg = p1Record.dartsThrown
        ? Number(((p1Record.pointsScored / p1Record.dartsThrown) * 3).toFixed(1))
        : 0;
      if (result.player1Stats.highFinish > p1Record.highFinish) {
        p1Record.highFinish = result.player1Stats.highFinish;
      }
    }

    if (result.player2Stats) {
      p2Record.pointsScored += result.player2Stats.points;
      p2Record.dartsThrown += result.player2Stats.darts;
      p2Record.threeDartAvg = p2Record.dartsThrown
        ? Number(((p2Record.pointsScored / p2Record.dartsThrown) * 3).toFixed(1))
        : 0;
      if (result.player2Stats.highFinish > p2Record.highFinish) {
        p2Record.highFinish = result.player2Stats.highFinish;
      }
    }
  }

  pool.standings = calculateStandings(pool);
  return updated;
}

export function generateKnockoutFromPools(tournament: TournamentState): TournamentState {
  const updated = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  const advancingPlayers: { poolName: string; rank: number; name: string }[] = [];

  for (const pool of updated.pools) {
    const sorted = calculateStandings(pool);
    if (sorted[0]) advancingPlayers.push({ poolName: pool.name, rank: 1, name: sorted[0].name });
    if (sorted[1]) advancingPlayers.push({ poolName: pool.name, rank: 2, name: sorted[1].name });
  }

  const matches: KnockoutMatch[] = [];

  if (advancingPlayers.length <= 4) {
    // 2 Semi-Finals + 1 Final
    // Match 1: Pool A #1 vs Pool B #2 (or runner up)
    const p1A = advancingPlayers.find((p) => p.rank === 1)?.name ?? advancingPlayers[0]?.name ?? null;
    const p2B = advancingPlayers.filter((p) => p.rank === 2)[0]?.name ?? advancingPlayers[1]?.name ?? null;
    const p1B = advancingPlayers.filter((p) => p.rank === 1)[1]?.name ?? advancingPlayers[2]?.name ?? null;
    const p2A = advancingPlayers.filter((p) => p.rank === 2)[1]?.name ?? advancingPlayers[3]?.name ?? null;

    matches.push({
      id: 'ko-semi-1',
      round: 'Semi-Final',
      matchNumber: 1,
      player1: p1A,
      player2: p2B,
      legsToWin: updated.koSemiLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });

    matches.push({
      id: 'ko-semi-2',
      round: 'Semi-Final',
      matchNumber: 2,
      player1: p1B,
      player2: p2A,
      legsToWin: updated.koSemiLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });

    matches.push({
      id: 'ko-final',
      round: 'Final',
      matchNumber: 1,
      player1: null,
      player2: null,
      legsToWin: updated.koFinalLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });
  } else {
    // 8-player Quarter-Finals
    for (let i = 0; i < 4; i++) {
      matches.push({
        id: `ko-qf-${i + 1}`,
        round: 'Quarter-Final',
        matchNumber: i + 1,
        player1: advancingPlayers[i * 2]?.name ?? null,
        player2: advancingPlayers[i * 2 + 1]?.name ?? null,
        legsToWin: updated.koQuarterLegsToWin,
        winner: null,
        player1Legs: 0,
        player2Legs: 0,
        completed: false,
      });
    }

    matches.push({
      id: 'ko-semi-1',
      round: 'Semi-Final',
      matchNumber: 1,
      player1: null,
      player2: null,
      legsToWin: updated.koSemiLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });

    matches.push({
      id: 'ko-semi-2',
      round: 'Semi-Final',
      matchNumber: 2,
      player1: null,
      player2: null,
      legsToWin: updated.koSemiLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });

    matches.push({
      id: 'ko-final',
      round: 'Final',
      matchNumber: 1,
      player1: null,
      player2: null,
      legsToWin: updated.koFinalLegsToWin,
      winner: null,
      player1Legs: 0,
      player2Legs: 0,
      completed: false,
    });
  }

  updated.knockoutMatches = matches;
  return updated;
}

export function recordKnockoutMatchResult(
  tournament: TournamentState,
  matchId: string,
  result: { player1Legs: number; player2Legs: number },
): TournamentState {
  const updated = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  const match = updated.knockoutMatches.find((m) => m.id === matchId);
  if (!match) return tournament;

  match.player1Legs = result.player1Legs;
  match.player2Legs = result.player2Legs;
  match.completed = true;
  match.winner = result.player1Legs > result.player2Legs ? match.player1 : match.player2;

  // Advance winner to next round
  if (match.round === 'Quarter-Final') {
    const semiMatchIndex = match.matchNumber <= 2 ? 0 : 1;
    const semi = updated.knockoutMatches.filter((m) => m.round === 'Semi-Final')[semiMatchIndex];
    if (semi) {
      if (match.matchNumber % 2 === 1) {
        semi.player1 = match.winner;
      } else {
        semi.player2 = match.winner;
      }
    }
  } else if (match.round === 'Semi-Final') {
    const finalMatch = updated.knockoutMatches.find((m) => m.round === 'Final');
    if (finalMatch) {
      if (match.matchNumber === 1) {
        finalMatch.player1 = match.winner;
      } else {
        finalMatch.player2 = match.winner;
      }
    }
  } else if (match.round === 'Final') {
    updated.champion = match.winner;
  }

  return updated;
}
