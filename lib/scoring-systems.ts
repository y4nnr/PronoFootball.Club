/**
 * Scoring Systems for Different Sports
 * 
 * This module centralizes all scoring calculation logic
 * to support different sports with different scoring rules
 */

export type ScoringSystem = 'FOOTBALL_STANDARD' | 'RUGBY_PROXIMITY';

export interface BetScore {
  score1: number; // Home team predicted score
  score2: number; // Away team predicted score
}

export interface ActualScore {
  home: number;
  away: number;
}

/**
 * Calculate points for a bet based on the scoring system
 */
export function calculateBetPoints(
  bet: BetScore,
  actualScore: ActualScore,
  scoringSystem: ScoringSystem
): number {
  switch (scoringSystem) {
    case 'FOOTBALL_STANDARD':
      return calculateFootballPoints(bet, actualScore);
    case 'RUGBY_PROXIMITY':
      return calculateRugbyProximityPoints(bet, actualScore);
    default:
      return calculateFootballPoints(bet, actualScore);
  }
}

/**
 * Football Standard Scoring System
 * - Score exact: 3 points
 * - Résultat correct: 1 point
 * - Résultat incorrect: 0 points
 */
function calculateFootballPoints(bet: BetScore, actualScore: ActualScore): number {
  // Score exact = 3 points
  if (bet.score1 === actualScore.home && bet.score2 === actualScore.away) {
    return 3;
  }
  
  // Check result (win/draw/loss)
  const actualResult = actualScore.home > actualScore.away ? 'home' :
                       actualScore.home < actualScore.away ? 'away' : 'draw';
  const predictedResult = bet.score1 > bet.score2 ? 'home' :
                          bet.score1 < bet.score2 ? 'away' : 'draw';
  
  // Résultat correct = 1 point
  if (actualResult === predictedResult) {
    return 1;
  }
  
  return 0;
}

/**
 * Rugby Proximity Scoring System (Option 1 - Simplified)
 * - Score exact ou très proche (différence totale ≤ 5): 3 points
 * - Résultat correct mais score trop éloigné: 1 point
 * - Résultat incorrect: 0 points
 */
function calculateRugbyProximityPoints(bet: BetScore, actualScore: ActualScore): number {
  // Calculate total difference
  const homeDiff = Math.abs(bet.score1 - actualScore.home);
  const awayDiff = Math.abs(bet.score2 - actualScore.away);
  const totalDiff = homeDiff + awayDiff;
  
  // Score exact ou très proche (différence totale ≤ 5) = 3 points
  if (totalDiff <= 5) {
    return 3;
  }
  
  // Check result (win/draw/loss)
  const actualResult = actualScore.home > actualScore.away ? 'home' :
                       actualScore.home < actualScore.away ? 'away' : 'draw';
  const predictedResult = bet.score1 > bet.score2 ? 'home' :
                          bet.score1 < bet.score2 ? 'away' : 'draw';
  
  // Résultat correct = 1 point
  if (actualResult === predictedResult) {
    return 1;
  }
  
  return 0;
}

/**
 * Get the scoring system for a competition based on its sport type
 */
export function getScoringSystemForSport(sportType: 'FOOTBALL' | 'RUGBY'): ScoringSystem {
  switch (sportType) {
    case 'FOOTBALL':
      return 'FOOTBALL_STANDARD';
    case 'RUGBY':
      return 'RUGBY_PROXIMITY';
    default:
      return 'FOOTBALL_STANDARD';
  }
}

