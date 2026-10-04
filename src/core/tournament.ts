import {
  GameMode,
  KnockoutMatch,
  PoolFixture,
  PoolGroup,
  PoolPlayerRecord,
  TournamentState,
  ChallongeMatch,
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
    challongeMatches: [],
    format: 'pools_knockout',
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
    // Match 1: Pool A #1 vs Pool B #2
    // Match 2: Pool B #1 vs Pool A #2
    const pool1Name = updated.pools[0]?.name;
    const pool2Name = updated.pools[1]?.name;

    const p1A = advancingPlayers.find((p) => p.poolName === pool1Name && p.rank === 1)?.name ?? advancingPlayers[0]?.name ?? null;
    const p2A = advancingPlayers.find((p) => p.poolName === pool1Name && p.rank === 2)?.name ?? advancingPlayers[1]?.name ?? null;
    const p1B = advancingPlayers.find((p) => p.poolName === pool2Name && p.rank === 1)?.name ?? advancingPlayers[2]?.name ?? null;
    const p2B = advancingPlayers.find((p) => p.poolName === pool2Name && p.rank === 2)?.name ?? advancingPlayers[3]?.name ?? null;

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

function generateSeededPairs(size: number): [number, number][] {
  if (size <= 4) {
    return [
      [1, 4],
      [2, 3],
    ];
  }
  if (size <= 8) {
    return [
      [1, 8],
      [4, 5],
      [2, 7],
      [3, 6],
    ];
  }
  if (size <= 16) {
    return [
      [1, 16],
      [8, 9],
      [4, 13],
      [5, 12],
      [2, 15],
      [7, 10],
      [3, 14],
      [6, 11],
    ];
  }
  const pairs: [number, number][] = [];
  for (let i = 1; i <= size / 2; i++) {
    pairs.push([i, size + 1 - i]);
  }
  return pairs;
}

export function createChallongeTournament(options: {
  name: string;
  players: string[];
  gameMode?: GameMode;
  doubleOut?: boolean;
  legsToWin?: number;
  semiLegsToWin?: number;
  finalLegsToWin?: number;
}): TournamentState {
  const cleanPlayers = options.players.map((p) => p.trim()).filter(Boolean);
  const legsToWin = options.legsToWin ?? 3;

  // Bracket size: smallest power of 2 >= cleanPlayers.length, min 4
  let bracketSize = 4;
  while (bracketSize < cleanPlayers.length) {
    bracketSize *= 2;
  }

  const totalRounds = Math.log2(bracketSize);
  const seededPairs = generateSeededPairs(bracketSize);
  const allMatches: ChallongeMatch[] = [];

  function getRoundName(roundIdx: number): string {
    const dist = totalRounds - 1 - roundIdx;
    if (dist === 0) return 'Championship Final';
    if (dist === 1) return 'Semi-Final';
    if (dist === 2) return 'Quarter-Final';
    if (dist === 3) return 'Round of 16';
    return `Round ${roundIdx + 1}`;
  }

  // Create matches round by round
  for (let r = 0; r < totalRounds; r++) {
    const numMatchesInRound = bracketSize / Math.pow(2, r + 1);
    const roundName = getRoundName(r);

    let matchLegs = legsToWin;
    const dist = totalRounds - 1 - r;
    if (dist === 0 && options.finalLegsToWin) matchLegs = options.finalLegsToWin;
    else if (dist === 1 && options.semiLegsToWin) matchLegs = options.semiLegsToWin;

    for (let m = 1; m <= numMatchesInRound; m++) {
      const matchId = `challonge-r${r}-m${m}`;
      let nextMatchId: string | undefined;
      let nextMatchSlot: (1 | 2) | undefined;

      if (r < totalRounds - 1) {
        nextMatchId = `challonge-r${r + 1}-m${Math.ceil(m / 2)}`;
        nextMatchSlot = m % 2 === 1 ? 1 : 2;
      }

      allMatches.push({
        id: matchId,
        roundIndex: r,
        roundName,
        matchNumber: m,
        player1: null,
        player2: null,
        legsToWin: matchLegs,
        player1Legs: 0,
        player2Legs: 0,
        winner: null,
        completed: false,
        nextMatchId,
        nextMatchSlot,
      });
    }
  }

  // Populate Round 0 with seeded players & process Byes
  const r0Matches = allMatches.filter((m) => m.roundIndex === 0);
  for (let i = 0; i < seededPairs.length; i++) {
    const match = r0Matches[i];
    const [s1, s2] = seededPairs[i];

    const p1 = s1 <= cleanPlayers.length ? cleanPlayers[s1 - 1] : null;
    const p2 = s2 <= cleanPlayers.length ? cleanPlayers[s2 - 1] : null;

    match.player1 = p1;
    match.player1Seed = p1 ? s1 : undefined;
    match.player2 = p2;
    match.player2Seed = p2 ? s2 : undefined;

    // Check for Bye
    if (p1 && !p2) {
      match.isBye = true;
      match.completed = true;
      match.winner = p1;
      if (match.nextMatchId) {
        const nextMatch = allMatches.find((nm) => nm.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 1) nextMatch.player1 = p1;
          else if (match.nextMatchSlot === 2) nextMatch.player2 = p1;
        }
      }
    } else if (p2 && !p1) {
      match.isBye = true;
      match.completed = true;
      match.winner = p2;
      if (match.nextMatchId) {
        const nextMatch = allMatches.find((nm) => nm.id === match.nextMatchId);
        if (nextMatch) {
          if (match.nextMatchSlot === 1) nextMatch.player1 = p2;
          else if (match.nextMatchSlot === 2) nextMatch.player2 = p2;
        }
      }
    }
  }

  const randomSuffix = Math.random().toString(36).substring(2, 8);
  return {
    id: `tourney-ch-${Date.now()}-${randomSuffix}`,
    name: options.name,
    format: 'challonge_single_elim',
    gameMode: options.gameMode ?? 501,
    doubleOut: options.doubleOut ?? true,
    poolLegsToWin: legsToWin,
    koQuarterLegsToWin: legsToWin,
    koSemiLegsToWin: options.semiLegsToWin ?? legsToWin,
    koFinalLegsToWin: options.finalLegsToWin ?? legsToWin,
    pools: [],
    knockoutMatches: [],
    challongeMatches: allMatches,
    champion: null,
  };
}

export function recordChallongeMatchResult(
  tournament: TournamentState,
  matchId: string,
  player1Legs: number,
  player2Legs: number,
): TournamentState {
  const updated = JSON.parse(JSON.stringify(tournament)) as TournamentState;
  if (!updated.challongeMatches) return tournament;

  const match = updated.challongeMatches.find((m) => m.id === matchId);
  if (!match) return tournament;

  match.player1Legs = player1Legs;
  match.player2Legs = player2Legs;
  match.completed = true;
  match.winner = player1Legs > player2Legs ? match.player1 : match.player2;

  // Advance winner to next match in bracket
  if (match.nextMatchId) {
    const nextMatch = updated.challongeMatches.find((m) => m.id === match.nextMatchId);
    if (nextMatch) {
      if (match.nextMatchSlot === 1) {
        nextMatch.player1 = match.winner;
      } else if (match.nextMatchSlot === 2) {
        nextMatch.player2 = match.winner;
      }
    }
  }

  // If this was the Championship Final or no next match, crown champion
  if (match.roundName === 'Championship Final' || !match.nextMatchId) {
    updated.champion = match.winner;
  }

  return updated;
}

export interface PlayableTournamentMatch {
  id: string;
  tournamentId: string;
  player1: string;
  player2: string;
  legsToWin: number;
  roundName: string;
  stage: 'pool' | 'knockout' | 'challonge';
  completed: boolean;
  winner: string | null;
  player1Legs?: number;
  player2Legs?: number;
}

export function areAllPoolMatchesCompleted(tournament: TournamentState): boolean {
  if (!tournament.pools || tournament.pools.length === 0) return false;
  return tournament.pools.every(
    (pool) => pool.fixtures.length > 0 && pool.fixtures.every((f) => f.played),
  );
}

export function getPlayableTournamentMatches(
  tournament: TournamentState,
): PlayableTournamentMatch[] {
  const result: PlayableTournamentMatch[] = [];

  if (tournament.format === 'challonge_single_elim') {
    for (const m of tournament.challongeMatches || []) {
      if (m.player1 && m.player2) {
        result.push({
          id: `${tournament.id}-${m.id}`,
          tournamentId: tournament.id,
          player1: m.player1,
          player2: m.player2,
          legsToWin: m.legsToWin,
          roundName: m.roundName,
          stage: 'challonge',
          completed: m.completed,
          winner: m.winner,
          player1Legs: m.player1Legs,
          player2Legs: m.player2Legs,
        });
      }
    }
    return result;
  }

  // Knockout matches with ready players
  for (const km of tournament.knockoutMatches || []) {
    if (km.player1 && km.player2) {
      result.push({
        id: `${tournament.id}-${km.id}`,
        tournamentId: tournament.id,
        player1: km.player1,
        player2: km.player2,
        legsToWin: km.legsToWin,
        roundName: km.round,
        stage: 'knockout',
        completed: km.completed,
        winner: km.winner,
        player1Legs: km.player1Legs,
        player2Legs: km.player2Legs,
      });
    }
  }

  // Pool fixtures
  for (const pool of tournament.pools || []) {
    for (const fix of pool.fixtures || []) {
      result.push({
        id: `${tournament.id}-${fix.id}`,
        tournamentId: tournament.id,
        player1: fix.player1,
        player2: fix.player2,
        legsToWin: fix.legsToWin,
        roundName: `${pool.name} Fixture`,
        stage: 'pool',
        completed: fix.played,
        winner: fix.winner ?? null,
        player1Legs: fix.player1Score,
        player2Legs: fix.player2Score,
      });
    }
  }

  return result;
}

export function advanceTournamentProgression(
  tournament: TournamentState,
  previousTournament?: TournamentState,
): {
  updatedTournament: TournamentState;
  stageEvent?: 'pools_completed' | 'finalists_set' | 'champion_crowned';
} {
  let updated: TournamentState = {
    ...tournament,
    pools: tournament.pools ? tournament.pools.map((p) => ({ ...p, fixtures: [...p.fixtures] })) : [],
    knockoutMatches: tournament.knockoutMatches ? tournament.knockoutMatches.map((m) => ({ ...m })) : [],
    challongeMatches: tournament.challongeMatches ? tournament.challongeMatches.map((m) => ({ ...m })) : [],
  };

  // Challonge single-elim progression check
  if (tournament.format === 'challonge_single_elim') {
    const finalMatch = updated.challongeMatches?.find(
      (m) => m.roundName === 'Championship Final' || !m.nextMatchId,
    );
    if (finalMatch && finalMatch.completed && finalMatch.winner && !previousTournament?.champion) {
      updated.champion = finalMatch.winner;
      return { updatedTournament: updated, stageEvent: 'champion_crowned' };
    }
    return { updatedTournament: updated };
  }

  // Pools + Knockout format progression check
  const poolsDone = areAllPoolMatchesCompleted(updated);
  if (poolsDone) {
    // 1. Generate knockout bracket automatically if not generated yet
    if (!updated.knockoutMatches || updated.knockoutMatches.length === 0) {
      updated = generateKnockoutFromPools(updated);
      return { updatedTournament: updated, stageEvent: 'pools_completed' };
    }

    // 2. Check Quarter-Finals progression into Semis (for > 2 pools, e.g. 16 players)
    const qfMatches = updated.knockoutMatches.filter((m) => m.round === 'Quarter-Final');
    if (qfMatches.length > 0 && qfMatches.every((m) => m.completed)) {
      const semi1 = updated.knockoutMatches.find((m) => m.id === 'ko-semi-1');
      const semi2 = updated.knockoutMatches.find((m) => m.id === 'ko-semi-2');
      if (semi1 && (!semi1.player1 || !semi1.player2)) {
        semi1.player1 = qfMatches[0]?.winner ?? null;
        semi1.player2 = qfMatches[1]?.winner ?? null;
      }
      if (semi2 && (!semi2.player1 || !semi2.player2)) {
        semi2.player1 = qfMatches[2]?.winner ?? null;
        semi2.player2 = qfMatches[3]?.winner ?? null;
      }
    }

    // 3. Check Semifinals progression into Championship Final
    const semiMatches = updated.knockoutMatches.filter((m) => m.round === 'Semi-Final');
    const finalMatch = updated.knockoutMatches.find((m) => m.round === 'Final');
    const semi1 = semiMatches.find((m) => m.matchNumber === 1);
    const semi2 = semiMatches.find((m) => m.matchNumber === 2);

    if (finalMatch && semi1?.winner && semi2?.winner) {
      finalMatch.player1 = semi1.winner;
      finalMatch.player2 = semi2.winner;
    }

    const prevSemisDone = previousTournament?.knockoutMatches
      ? previousTournament.knockoutMatches.filter((m) => m.round === 'Semi-Final').every((m) => m.completed)
      : false;
    const nowSemisDone = semiMatches.length > 0 && semiMatches.every((m) => m.completed);

    if (nowSemisDone && !prevSemisDone && finalMatch && !finalMatch.completed) {
      return { updatedTournament: updated, stageEvent: 'finalists_set' };
    }

    // 4. Check Championship Final completion
    if (finalMatch && finalMatch.completed && finalMatch.winner) {
      const prevFinalDone = Boolean(
        previousTournament?.knockoutMatches?.find((m) => m.round === 'Final')?.completed,
      );
      updated.champion = finalMatch.winner;
      if (!prevFinalDone || !previousTournament?.champion) {
        return { updatedTournament: updated, stageEvent: 'champion_crowned' };
      }
    }
  }

  return { updatedTournament: updated };
}


