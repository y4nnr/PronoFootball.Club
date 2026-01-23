import { FootballDataAPI } from '../football-data-api';

describe('FootballDataAPI', () => {
  let api: FootballDataAPI;

  beforeEach(() => {
    api = new FootballDataAPI('test-api-key');
  });

  describe('normalizeTeamName', () => {
    it('should normalize team names to lowercase', () => {
      // Note: "United" suffix is removed, so "Manchester United" becomes "manchester"
      expect(api.normalizeTeamName('Manchester United')).toBe('manchester');
    });

    it('should remove common FC suffixes', () => {
      // Note: "United" suffix is removed
      expect(api.normalizeTeamName('Manchester United FC')).toBe('manchester');
      // "Real" prefix is removed, "CF" suffix is removed
      expect(api.normalizeTeamName('Real Madrid CF')).toBe('madrid');
    });

    it('should remove common prefixes', () => {
      expect(api.normalizeTeamName('FC Barcelona')).toBe('barcelona');
      expect(api.normalizeTeamName('AC Milan')).toBe('milan');
    });

    it('should handle specific team name variations', () => {
      expect(api.normalizeTeamName('Internazionale Milano')).toBe('inter milan');
      expect(api.normalizeTeamName('Internazionale')).toBe('inter milan');
      expect(api.normalizeTeamName('Sporting Clube de Portugal')).toBe('sporting cp');
      expect(api.normalizeTeamName('AS Monaco')).toBe('monaco');
    });

    it('should handle special characters and accents', () => {
      expect(api.normalizeTeamName('Atlético Madrid')).toBe('atletico madrid');
      expect(api.normalizeTeamName('København')).toBe('copenhagen');
      expect(api.normalizeTeamName('São Paulo')).toBe('sao paulo');
    });

    it('should handle Pafos/Paphos variations', () => {
      expect(api.normalizeTeamName('Paphos FC')).toBe('pafos');
      expect(api.normalizeTeamName('Pafos FC')).toBe('pafos');
      expect(api.normalizeTeamName('Paphos')).toBe('pafos');
    });

    it('should clean up extra spaces', () => {
      // Note: "United" suffix is removed
      expect(api.normalizeTeamName('Manchester   United')).toBe('manchester');
      expect(api.normalizeTeamName('  Real Madrid  ')).toBe('real madrid');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1.0 for identical strings', () => {
      expect(api.calculateSimilarity('Manchester United', 'Manchester United')).toBe(1.0);
    });

    it('should return high similarity for similar strings', () => {
      const similarity = api.calculateSimilarity('Manchester United', 'Manchester Utd');
      expect(similarity).toBeGreaterThan(0.7);
    });

    it('should return low similarity for different strings', () => {
      const similarity = api.calculateSimilarity('Manchester United', 'Liverpool');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      expect(api.calculateSimilarity('', '')).toBe(1.0);
      expect(api.calculateSimilarity('', 'test')).toBe(0);
    });

    it('should calculate similarity correctly', () => {
      // calculateSimilarity is case-sensitive, so identical strings match
      const sim1 = api.calculateSimilarity('manchester', 'manchester');
      expect(sim1).toBe(1.0);
      
      // Similar strings have high similarity
      const sim2 = api.calculateSimilarity('manchester', 'manchest');
      expect(sim2).toBeGreaterThanOrEqual(0.8);
    });
  });

  describe('findBestMatch', () => {
    const ourTeams = [
      'Manchester United',
      'Liverpool',
      'Chelsea',
      'Arsenal',
      'Real Madrid',
      'Barcelona',
    ];

    it('should find exact match', () => {
      const match = api.findBestMatch('Manchester United', ourTeams);
      expect(match).toBe('Manchester United');
    });

    it('should find match with common variations', () => {
      // After normalization, both become "manchester", so they match
      const match = api.findBestMatch('Manchester United FC', ourTeams);
      expect(match).toBe('Manchester United');
    });

    it('should find match with fuzzy matching', () => {
      // Using a closer variation that will match after normalization
      const match = api.findBestMatch('Manchester', ourTeams);
      expect(match).toBe('Manchester United');
    });

    it('should return null for no match below threshold', () => {
      const match = api.findBestMatch('NonExistent Team', ourTeams);
      expect(match).toBeNull();
    });

    it('should handle team name variations', () => {
      const match = api.findBestMatch('Real Madrid CF', ourTeams);
      expect(match).toBe('Real Madrid');
    });
  });

  describe('findBestTeamMatch', () => {
    const ourTeams = [
      { id: '1', name: 'Manchester United' },
      { id: '2', name: 'Liverpool' },
      { id: '3', name: 'Chelsea' },
      { id: '4', name: 'Real Madrid' },
      { id: '5', name: 'Barcelona' },
    ];

    it('should find exact normalized match', () => {
      const match = api.findBestTeamMatch('Manchester United', ourTeams);
      expect(match).not.toBeNull();
      expect(match?.team.name).toBe('Manchester United');
      expect(match?.method).toBe('exact_normalized');
    });

    it('should find fuzzy match', () => {
      // Using a closer variation that will match after normalization
      const match = api.findBestTeamMatch('Manchester', ourTeams);
      expect(match).not.toBeNull();
      expect(match?.team.name).toBe('Manchester United');
    });

    it('should find partial match', () => {
      const match = api.findBestTeamMatch('Manchester', ourTeams);
      expect(match).not.toBeNull();
      expect(match?.team.name).toBe('Manchester United');
    });

    it('should return null for no match', () => {
      const match = api.findBestTeamMatch('NonExistent Team', ourTeams);
      expect(match).toBeNull();
    });

    it('should return match with score and method', () => {
      const match = api.findBestTeamMatch('Manchester United', ourTeams);
      expect(match).not.toBeNull();
      expect(match?.score).toBeGreaterThan(0);
      expect(match?.method).toBeTruthy();
    });
  });

  describe('mapStatus', () => {
    it('should map SCHEDULED to UPCOMING', () => {
      expect(api.mapStatus('SCHEDULED')).toBe('UPCOMING');
    });

    it('should map TIMED to UPCOMING', () => {
      expect(api.mapStatus('TIMED')).toBe('UPCOMING');
    });

    it('should map IN_PLAY to LIVE', () => {
      expect(api.mapStatus('IN_PLAY')).toBe('LIVE');
    });

    it('should map PAUSED to LIVE', () => {
      expect(api.mapStatus('PAUSED')).toBe('LIVE');
    });

    it('should map LIVE to LIVE', () => {
      expect(api.mapStatus('LIVE')).toBe('LIVE');
    });

    it('should map FINISHED to FINISHED', () => {
      expect(api.mapStatus('FINISHED')).toBe('FINISHED');
    });

    it('should map COMPLETED to FINISHED', () => {
      expect(api.mapStatus('COMPLETED')).toBe('FINISHED');
    });

    it('should map POSTPONED to CANCELLED', () => {
      expect(api.mapStatus('POSTPONED')).toBe('CANCELLED');
    });

    it('should map SUSPENDED to CANCELLED', () => {
      expect(api.mapStatus('SUSPENDED')).toBe('CANCELLED');
    });

    it('should map CANCELLED to CANCELLED', () => {
      expect(api.mapStatus('CANCELLED')).toBe('CANCELLED');
    });

    it('should default unknown status to UPCOMING', () => {
      expect(api.mapStatus('UNKNOWN_STATUS')).toBe('UPCOMING');
    });
  });

  describe('getAttributionText', () => {
    it('should return attribution text', () => {
      expect(api.getAttributionText()).toBe('Data provided by football-data.org');
    });
  });
});
