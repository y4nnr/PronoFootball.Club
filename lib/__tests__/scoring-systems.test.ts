import {
  calculateBetPoints,
  getScoringSystemForSport,
  BetScore,
  ActualScore,
} from '../scoring-systems';

describe('Scoring Systems', () => {
  describe('Football Standard Scoring', () => {
    const scoringSystem = 'FOOTBALL_STANDARD';

    describe('Exact score (3 points)', () => {
      it('should award 3 points for exact match', () => {
        const bet: BetScore = { score1: 2, score2: 1 };
        const actual: ActualScore = { home: 2, away: 1 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });

      it('should award 3 points for exact match with zero scores', () => {
        const bet: BetScore = { score1: 0, score2: 0 };
        const actual: ActualScore = { home: 0, away: 0 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });

      it('should award 3 points for exact match with high scores', () => {
        const bet: BetScore = { score1: 5, score2: 3 };
        const actual: ActualScore = { home: 5, away: 3 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });
    });

    describe('Correct result (1 point)', () => {
      it('should award 1 point for correct home win prediction', () => {
        const bet: BetScore = { score1: 2, score2: 1 };
        const actual: ActualScore = { home: 3, away: 0 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });

      it('should award 1 point for correct away win prediction', () => {
        const bet: BetScore = { score1: 0, score2: 2 };
        const actual: ActualScore = { home: 1, away: 3 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });

      it('should award 1 point for correct draw prediction', () => {
        const bet: BetScore = { score1: 1, score2: 1 };
        const actual: ActualScore = { home: 2, away: 2 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });

      it('should award 1 point for correct draw with zero-zero', () => {
        const bet: BetScore = { score1: 0, score2: 0 };
        const actual: ActualScore = { home: 1, away: 1 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });
    });

    describe('Wrong result (0 points)', () => {
      it('should award 0 points when predicting home win but away wins', () => {
        const bet: BetScore = { score1: 2, score2: 1 };
        const actual: ActualScore = { home: 0, away: 2 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting away win but home wins', () => {
        const bet: BetScore = { score1: 0, score2: 2 };
        const actual: ActualScore = { home: 3, away: 0 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting draw but home wins', () => {
        const bet: BetScore = { score1: 1, score2: 1 };
        const actual: ActualScore = { home: 2, away: 0 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting draw but away wins', () => {
        const bet: BetScore = { score1: 1, score2: 1 };
        const actual: ActualScore = { home: 0, away: 2 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting win but it is a draw', () => {
        const bet: BetScore = { score1: 2, score2: 1 };
        const actual: ActualScore = { home: 1, away: 1 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });
    });
  });

  describe('Rugby Proximity Scoring', () => {
    const scoringSystem = 'RUGBY_PROXIMITY';

    describe('Exact or very close score (3 points)', () => {
      it('should award 3 points for exact match', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 20, away: 15 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });

      it('should award 3 points for difference of 5 or less', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 22, away: 18 }; // diff: 2+3=5
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });

      it('should award 3 points for difference of exactly 5', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 25, away: 15 }; // diff: 5+0=5
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });

      it('should award 3 points for close score with zero', () => {
        const bet: BetScore = { score1: 10, score2: 0 };
        const actual: ActualScore = { home: 12, away: 3 }; // diff: 2+3=5
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });
    });

    describe('Correct result but score too far (1 point)', () => {
      it('should award 1 point for correct home win but difference > 5', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 30, away: 10 }; // diff: 10+5=15
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });

      it('should award 1 point for correct away win but difference > 5', () => {
        const bet: BetScore = { score1: 10, score2: 20 };
        const actual: ActualScore = { home: 5, away: 30 }; // diff: 5+10=15
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });

      it('should award 1 point for correct draw but difference > 5', () => {
        const bet: BetScore = { score1: 15, score2: 15 };
        const actual: ActualScore = { home: 25, away: 25 }; // diff: 10+10=20
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1);
      });
    });

    describe('Wrong result (0 points)', () => {
      it('should award 0 points when predicting home win but away wins', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 10, away: 25 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting away win but home wins', () => {
        const bet: BetScore = { score1: 10, score2: 20 };
        const actual: ActualScore = { home: 25, away: 5 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting draw but home wins', () => {
        const bet: BetScore = { score1: 15, score2: 15 };
        const actual: ActualScore = { home: 20, away: 10 };
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });

      it('should award 0 points when predicting win but it is a draw (with large difference)', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 10, away: 10 }; // diff: 10+5=15, wrong result
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(0);
      });
    });

    describe('Edge cases', () => {
      it('should handle difference of 6 (just over threshold)', () => {
        const bet: BetScore = { score1: 20, score2: 15 };
        const actual: ActualScore = { home: 26, away: 15 }; // diff: 6+0=6
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(1); // Correct result
      });

      it('should handle very high scores', () => {
        const bet: BetScore = { score1: 50, score2: 30 };
        const actual: ActualScore = { home: 52, away: 33 }; // diff: 2+3=5
        expect(calculateBetPoints(bet, actual, scoringSystem)).toBe(3);
      });
    });
  });

  describe('getScoringSystemForSport', () => {
    it('should return FOOTBALL_STANDARD for FOOTBALL', () => {
      expect(getScoringSystemForSport('FOOTBALL')).toBe('FOOTBALL_STANDARD');
    });

    it('should return RUGBY_PROXIMITY for RUGBY', () => {
      expect(getScoringSystemForSport('RUGBY')).toBe('RUGBY_PROXIMITY');
    });
  });

  describe('Default behavior', () => {
    it('should default to FOOTBALL_STANDARD for unknown scoring system', () => {
      const bet: BetScore = { score1: 2, score2: 1 };
      const actual: ActualScore = { home: 2, away: 1 };
      // @ts-expect-error - testing default case with invalid system
      expect(calculateBetPoints(bet, actual, 'UNKNOWN' as any)).toBe(3);
    });
  });
});
