import React, { useState } from 'react';
import { MatchState } from './core/types';
import { createInitialMatchState } from './core/scoring';
import { MatchView } from './components/MatchView';
import { MatchesDashboard } from './components/MatchesDashboard';
import { TournamentView } from './components/TournamentView';
import { RulesGuide } from './components/RulesGuide';
import { ExportView } from './components/ExportView';
import { ProjectorView } from './components/ProjectorView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { loadTournament, getStoredMatch, saveStoredMatch, saveCurrentMatch } from './services/storage';
import { handleTournamentMatchCompleted } from './services/tournamentSync';
import { apiSaveMatch } from './services/api';

type Tab = 'match' | 'matches' | 'tournament' | 'rules' | 'export';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<Tab>('match');
  const [projectorState, setProjectorState] = useState<MatchState | null>(null);
  const [presetMatch, setPresetMatch] = useState<MatchState | null>(null);
  const [currentMatchId, setCurrentMatchId] = useState<string | undefined>(undefined);

  // If projector mode is active, render fullscreen spectator board
  if (projectorState) {
    return (
      <ProjectorView
        state={projectorState}
        onClose={() => setProjectorState(null)}
      />
    );
  }

  const handleLoadTournamentMatch = (
    player1: string,
    player2: string,
    legsToWin: number,
    _onFinish?: (p1Legs: number, p2Legs: number) => void,
    matchId?: string,
  ) => {
    const id = matchId || `tourney-match-${Date.now()}`;
    const existing = getStoredMatch(id);
    const newMatch =
      existing ??
      createInitialMatchState({
        mode: 501,
        doubleOut: true,
        legsToWin,
        playerNames: [player1, player2],
      });
    setCurrentMatchId(id);
    setPresetMatch(newMatch);
    saveCurrentMatch(newMatch, id);
    setActiveTab('match');
  };

  const handleLoadDashboardMatch = (match: MatchState, matchId: string) => {
    setPresetMatch(match);
    setCurrentMatchId(matchId);
    saveCurrentMatch(match, matchId);
    setActiveTab('match');
  };

  const handleMatchComplete = async (finalState: MatchState) => {
    if (currentMatchId) {
      const activeTourney = loadTournament();
      // STRICT DIRECTIVE: Never auto-generate matches unless it is an active tournament
      if (activeTourney && currentMatchId.startsWith(`${activeTourney.id}-`)) {
        await handleTournamentMatchCompleted(activeTourney, currentMatchId, finalState);
      } else {
        // Standalone match: purely save match, NEVER auto-generate next matches
        saveStoredMatch(currentMatchId, finalState);
        await apiSaveMatch(currentMatchId, finalState).catch(() => {});
      }
    }
  };

  return (
    <ErrorBoundary>
      <div className="wrap">
        <header className="top-nav">
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(1.8rem, 4vw, 2.6rem)' }}>
              Intramurals Darts Championship
            </h1>
            <div style={{ color: 'var(--muted)', fontSize: '0.95rem' }}>
              Offline Scoring & Tournament Manager for the Oche
            </div>
          </div>

          <nav className="nav-tabs">
            <button
              className={`tab-btn ${activeTab === 'match' ? 'active' : ''}`}
              onClick={() => setActiveTab('match')}
            >
              Match Scorer
            </button>
            <button
              className={`tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
              onClick={() => setActiveTab('matches')}
            >
              Matches Hub
            </button>
            <button
              className={`tab-btn ${activeTab === 'tournament' ? 'active' : ''}`}
              onClick={() => setActiveTab('tournament')}
            >
              Tournament & Pools
            </button>
            <button
              className={`tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
              onClick={() => setActiveTab('rules')}
            >
              Official Rules
            </button>
            <button
              className={`tab-btn ${activeTab === 'export' ? 'active' : ''}`}
              onClick={() => setActiveTab('export')}
            >
              Data & Export
            </button>
          </nav>
        </header>

        <main>
          {activeTab === 'match' && (
            <MatchView
              presetMatch={presetMatch}
              matchId={currentMatchId}
              onOpenProjector={(state) => setProjectorState(state)}
              onMatchComplete={handleMatchComplete}
            />
          )}

          {activeTab === 'matches' && (
            <MatchesDashboard
              onLoadMatchForScoring={handleLoadDashboardMatch}
              onOpenProjector={(state) => setProjectorState(state)}
            />
          )}

          {activeTab === 'tournament' && (
            <TournamentView onLoadMatchForScoring={handleLoadTournamentMatch} />
          )}

          {activeTab === 'rules' && <RulesGuide />}

          {activeTab === 'export' && <ExportView />}
        </main>
      </div>
    </ErrorBoundary>
  );
};

export default App;
