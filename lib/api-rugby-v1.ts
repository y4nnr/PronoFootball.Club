/**
 * API-Sports.io Rugby API Wrapper
 * 
 * This module provides a wrapper for the api-sports.io Rugby API (v3)
 * Similar to api-sports-api-v2.ts but for Rugby matches
 */

import { API_CONFIG } from './api-config';

interface RugbyFixture {
  fixture: {
    id: number;
    status: {
      short: string; // "1H", "2H", "HT", "FT", etc.
      elapsed: number | null; // Minute of the match (0-80+)
    };
    date: string; // ISO date string
  };
  teams: {
    home: { id: number; name: string; };
    away: { id: number; name: string; };
  };
  goals: {
    home: number | null;
    away: number | null;
    extra: { home: number | null; away: number | null; } | null; // For extra time
  };
  league: { id: number; name: string; country: string; };
}

interface RugbyResponse {
  response: RugbyFixture[];
  errors?: any[];
}

export interface RugbyMatch {
  id: number;
  status: string; // Mapped internal status (LIVE, FINISHED, etc.)
  externalStatus: string; // Original external status (HT, 1H, 2H, FT, etc.)
  elapsedMinute: number | null;
  homeTeam: { id: number; name: string; };
  awayTeam: { id: number; name: string; };
  score: { fullTime: { home: number | null; away: number | null; }; };
  utcDate: string;
  competition: { id: number; name: string; };
}

export interface ExternalRugbyCompetition {
  id: number;
  name: string;
  country: string;
  type: string;
  logo?: string;
  seasons: { year: string; start: string; end: string; current: boolean; }[];
}

export interface ExternalRugbySeason {
  year: string;
  start: string;
  end: string;
  current: boolean;
}

export interface ExternalRugbyTeam {
  id: number;
  name: string;
  code?: string;
  logo?: string;
}

export class RugbyAPI {
  private apiKey: string;
  private baseUrl = 'https://v1.rugby.api-sports.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, retryCount = 0): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      const url = `${this.baseUrl}${endpoint}`;
      console.log(`[RUGBY API] makeRequest: ${url}`);
      console.log(`[RUGBY API] API Key present: ${!!this.apiKey}, length: ${this.apiKey?.length || 0}`);
      
      const response = await fetch(url, {
        headers: {
          'x-apisports-key': this.apiKey,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        cache: 'no-store' // Next.js specific cache control
      });

      console.log(`[RUGBY API] Response status: ${response.status} ${response.statusText}`);
      console.log(`[RUGBY API] Response headers:`, {
        contentType: response.headers.get('content-type'),
        hasBody: !!response.body
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[RUGBY API] Error response body:`, errorText);
        
        if (response.status === 429) {
          // Rate limit exceeded
          const retryAfter = response.headers.get('Retry-After');
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : baseDelay * Math.pow(2, retryCount);
          
          if (retryCount < maxRetries) {
            console.log(`⚠️ Rate limit exceeded, retrying after ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            return this.makeRequest(endpoint, retryCount + 1);
          } else {
            throw new Error('Rate limit exceeded. Maximum retries reached.');
          }
        }
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      console.log(`[RUGBY API] Parsed JSON response:`, {
        hasResponse: !!data.response,
        isArray: Array.isArray(data.response),
        responseLength: data.response?.length || 0,
        hasErrors: !!data.errors,
        errorsLength: data.errors?.length || 0,
        topLevelKeys: Object.keys(data)
      });
      
      // Handle errors - can be an object or an array
      if (data.errors) {
        const hasErrors = Array.isArray(data.errors) 
          ? data.errors.length > 0 
          : Object.keys(data.errors).length > 0;
        
        if (hasErrors) {
          console.error('[RUGBY API] API errors:', data.errors);
          const errorMessage = typeof data.errors === 'object' && !Array.isArray(data.errors)
            ? Object.values(data.errors).join(', ')
            : JSON.stringify(data.errors);
          throw new Error(`API errors: ${errorMessage}`);
        }
      }

      return data;
    } catch (error) {
      console.error(`[RUGBY API] makeRequest error:`, error);
      if (error instanceof Error) {
        console.error(`[RUGBY API] Error message: ${error.message}`);
        console.error(`[RUGBY API] Error stack: ${error.stack}`);
      }
      
      if (retryCount < maxRetries && error instanceof Error && error.message.includes('Rate limit')) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`⚠️ Request failed, retrying after ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Get live rugby matches
   * IMPORTANT: Rugby API may use /games or /fixtures - try both
   */
  async getLiveMatches(): Promise<RugbyMatch[]> {
    try {
      // Try /games first, fallback to /fixtures
      let data: any = null;
      try {
        data = await this.makeRequest('/games?live=all');
      } catch (error) {
        console.warn('[RUGBY API] /games?live=all failed, trying /fixtures...');
        data = await this.makeRequest('/fixtures?live=all');
      }
      
      // Map response to matches (handle both /games and /fixtures structures)
      const games = data.response || [];
      return this.mapGamesToMatches(games);
    } catch (error) {
      console.error('Error fetching live rugby matches:', error);
      return [];
    }
  }

  /**
   * Get matches by date range
   * IMPORTANT: Rugby API may use /games or /fixtures - try both
   */
  async getMatchesByDateRange(startDate: string, endDate: string): Promise<RugbyMatch[]> {
    try {
      // Try /games first, fallback to /fixtures
      // For date ranges, try multiple formats: single date, date range with 'to', and date range with 'date' twice
      let data: any = null;
      let allGames: any[] = [];
      
      // If startDate and endDate are the same, just use single date
      if (startDate === endDate) {
        try {
          data = await this.makeRequest(`/games?date=${startDate}`);
          if (data.response && Array.isArray(data.response)) {
            allGames = [...allGames, ...data.response];
          }
        } catch (error) {
          console.warn(`[RUGBY API] /games?date=${startDate} failed, trying /fixtures...`);
          try {
            data = await this.makeRequest(`/fixtures?date=${startDate}`);
            if (data.response && Array.isArray(data.response)) {
              allGames = [...allGames, ...data.response];
            }
          } catch (error2) {
            console.warn(`[RUGBY API] /fixtures?date=${startDate} also failed`);
          }
        }
      } else {
        // Date range - try multiple formats
        const datesToTry = [
          `/games?date=${startDate}&to=${endDate}`,
          `/games?date=${startDate}`,
          `/games?date=${endDate}`,
          `/fixtures?date=${startDate}&to=${endDate}`,
          `/fixtures?date=${startDate}`,
          `/fixtures?date=${endDate}`
        ];
        
        for (const endpoint of datesToTry) {
          try {
            data = await this.makeRequest(endpoint);
            if (data.response && Array.isArray(data.response)) {
              // Filter games within date range
              const filteredGames = data.response.filter((game: any) => {
                const gameDate = game.date || game.fixture?.date || game.game?.date;
                if (!gameDate) return false;
                const dateStr = new Date(gameDate).toISOString().split('T')[0];
                return dateStr >= startDate && dateStr <= endDate;
              });
              allGames = [...allGames, ...filteredGames];
              if (filteredGames.length > 0) {
                console.log(`[RUGBY API] Found ${filteredGames.length} games using ${endpoint}`);
                break; // Stop trying other endpoints if we found games
              }
            }
          } catch (error) {
            // Continue to next endpoint
            continue;
          }
        }
      }
      
      // Remove duplicates by ID
      const uniqueGames = Array.from(
        new Map(allGames.map((game: any) => {
          const id = game.id || game.fixture?.id || game.game?.id;
          return [id, game];
        })).values()
      );
      
      return this.mapGamesToMatches(uniqueGames);
    } catch (error) {
      console.error('Error fetching rugby matches by date range:', error);
      return [];
    }
  }

  /**
   * Get a single match by ID
   * IMPORTANT: Rugby API may use /games or /fixtures - try both
   */
  async getMatchById(id: number): Promise<RugbyMatch | null> {
    try {
      // Try /games first, fallback to /fixtures
      let data: any = null;
      try {
        data = await this.makeRequest(`/games?id=${id}`);
      } catch (error) {
        console.warn(`[RUGBY API] /games?id=${id} failed, trying /fixtures...`);
        data = await this.makeRequest(`/fixtures?id=${id}`);
      }
      
      const games = data.response || [];
      const matches = this.mapGamesToMatches(games);
      return matches.length > 0 ? matches[0] : null;
    } catch (error) {
      console.error(`Error fetching rugby match ${id}:`, error);
      return null;
    }
  }
  
  /**
   * Map games/fixtures to matches (handles both /games and /fixtures response structures)
   */
  private mapGamesToMatches(games: any[]): RugbyMatch[] {
    return games.map((game: any) => {
      // Handle both /games and /fixtures structures
      // /games structure: { id, date, status: { short, elapsed }, teams: {...}, scores: {...}, league: {...} }
      // /fixtures structure: { fixture: { id, date, status: { short, elapsed } }, teams: {...}, goals: {...}, league: {...} }
      
      // Determine if it's /games (flat) or /fixtures (nested) structure
      const isGamesStructure = game.status !== undefined && !game.fixture;
      const isFixturesStructure = game.fixture !== undefined;
      
      let fixture: any;
      let teams: any;
      let scores: any;
      let league: any;
      let statusObj: any;
      
      if (isGamesStructure) {
        // /games endpoint: flat structure
        fixture = { id: game.id, date: game.date };
        statusObj = game.status || {};
        teams = game.teams || {};
        scores = game.scores || game.goals || {};
        league = game.league || {};
      } else if (isFixturesStructure) {
        // /fixtures endpoint: nested structure
        fixture = game.fixture || {};
        statusObj = fixture.status || {};
        teams = game.teams || {};
        scores = game.scores || game.goals || {};
        league = game.league || {};
      } else {
        // Fallback: try to detect structure
        fixture = game.fixture || game.game || { id: game.id, date: game.date };
        statusObj = fixture.status || game.status || {};
        teams = game.teams || {};
        scores = game.scores || game.goals || {};
        league = game.league || {};
      }
      
      const statusShort = statusObj?.short || 'NS';
      const status = this.mapStatus(statusShort);
      const externalStatus = statusShort;
      
      // Extract elapsedMinute - try multiple paths
      let elapsedMinute: number | null = null;
      if (statusObj?.elapsed !== null && statusObj?.elapsed !== undefined) {
        elapsedMinute = statusObj.elapsed;
      } else if (game.status?.elapsed !== null && game.status?.elapsed !== undefined) {
        elapsedMinute = game.status.elapsed;
      } else if (fixture.status?.elapsed !== null && fixture.status?.elapsed !== undefined) {
        elapsedMinute = fixture.status.elapsed;
      }
      
      // Log for debugging if elapsedMinute is missing for LIVE games (but not HT, which is expected)
      if (status === 'LIVE' && elapsedMinute === null && externalStatus !== 'HT') {
        console.log(`[RUGBY API] ⚠️ No elapsedMinute found for LIVE match (status: ${externalStatus}). Structure:`, {
          hasGameStatus: !!game.status,
          hasFixtureStatus: !!fixture.status,
          hasStatusObj: !!statusObj,
          gameStatus: game.status,
          fixtureStatus: fixture.status,
          statusObj: statusObj,
          rawGame: JSON.stringify(game, null, 2).substring(0, 500) // First 500 chars of raw response
        });
      }
      
      // For HT (half-time), elapsedMinute should be null - that's expected
      if (externalStatus === 'HT' && elapsedMinute === null) {
        console.log(`[RUGBY API] ℹ️ Half-time (HT) - elapsedMinute is null (expected)`);
      }
      
      // Get scores
      let homeScore: number | null = scores.home || null;
      let awayScore: number | null = scores.away || null;
      
      if ((externalStatus === 'AET' || externalStatus === 'PEN') && scores.extra) {
        homeScore = scores.extra.home;
        awayScore = scores.extra.away;
      }

      return {
        id: fixture.id,
        status,
        externalStatus,
        elapsedMinute,
        homeTeam: {
          id: teams.home?.id || 0,
          name: teams.home?.name || '',
        },
        awayTeam: {
          id: teams.away?.id || 0,
          name: teams.away?.name || '',
        },
        score: {
          fullTime: {
            home: homeScore,
            away: awayScore,
          },
        },
        utcDate: fixture.date || '',
        competition: {
          id: league.id || 0,
          name: league.name || '',
        },
      };
    });
  }

  /**
   * Map external status to internal status
   */
  mapStatus(externalStatus: string): string {
    const statusMap: Record<string, string> = {
      'NS': 'UPCOMING', // Not Started
      '1H': 'LIVE', // First Half
      'HT': 'LIVE', // Half Time
      '2H': 'LIVE', // Second Half
      'ET': 'LIVE', // Extra Time
      'FT': 'FINISHED', // Full Time
      'AET': 'FINISHED', // After Extra Time
      'PEN': 'FINISHED', // Penalties (but we use AET score)
      'SUSP': 'CANCELLED', // Suspended
      'INT': 'CANCELLED', // Interrupted
      'ABAN': 'CANCELLED', // Abandoned
      'CANC': 'CANCELLED', // Cancelled
      'POST': 'UPCOMING', // Postponed
      'AWARDED': 'FINISHED', // Awarded
    };

    return statusMap[externalStatus] || 'UPCOMING';
  }

  /**
   * Normalize team name for matching (improved version)
   */
  normalizeTeamName(name: string): string {
    if (!name) return '';
    
    return name
      .toLowerCase()
      .trim()
      // Remove common prefixes that don't help matching
      .replace(/^(fc|cf|sc|ac|as|us|rc|stade|olympique|racing|union|sporting|athletic|club|football|rugby)\s+/i, '')
      .replace(/^(the|le|la|les|de|du|des|et|and)\s+/i, '')
      // Normalize accents and special characters
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ç]/g, 'c')
      .replace(/[ñ]/g, 'n')
      .replace(/[ýÿ]/g, 'y')
      // Remove punctuation and special characters
      .replace(/'/g, '')
      .replace(/[""]/g, '')
      .replace(/[-_.,;:!?]/g, ' ')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings (Levenshtein-like)
   */
  private calculateSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;
    
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    // Simple similarity: count matching characters
    let matches = 0;
    for (let i = 0; i < shorter.length; i++) {
      if (longer.includes(shorter[i])) matches++;
    }
    
    return matches / longer.length;
  }

  /**
   * Calculate partial match score
   */
  private calculatePartialMatch(external: string, our: string): number {
    const normalizedExternal = this.normalizeTeamName(external);
    const normalizedOur = this.normalizeTeamName(our);
    
    if (normalizedOur.includes(normalizedExternal) || normalizedExternal.includes(normalizedOur)) {
      const minLen = Math.min(normalizedOur.length, normalizedExternal.length);
      const maxLen = Math.max(normalizedOur.length, normalizedExternal.length);
      return minLen / maxLen;
    }
    
    return 0;
  }

  /**
   * Calculate word overlap score
   */
  private calculateWordOverlap(name1: string, name2: string): number {
    const words1 = this.normalizeTeamName(name1).split(/\s+/).filter(w => w.length > 2);
    const words2 = this.normalizeTeamName(name2).split(/\s+/).filter(w => w.length > 2);
    
    if (words1.length === 0 || words2.length === 0) return 0;
    
    const matchingWords = words1.filter(w1 => 
      words2.some(w2 => w1.includes(w2) || w2.includes(w1) || w1 === w2)
    );
    
    return matchingWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Find best team match using advanced matching strategies (improved)
   */
  findBestTeamMatch(
    externalTeamName: string,
    ourTeams: Array<{ id: string; name: string; shortName?: string | null }>
  ): { team: any; score: number; method: string } | null {
    const strategies = [
      { name: 'exact_normalized', threshold: 0.95, weight: 1.0 },
      { name: 'short_name_match', threshold: 0.9, weight: 0.95 },
      { name: 'fuzzy_normalized', threshold: 0.7, weight: 0.9 },
      { name: 'partial_match', threshold: 0.6, weight: 0.8 },
      { name: 'word_overlap', threshold: 0.5, weight: 0.7 },
      { name: 'contains_keyword', threshold: 0.4, weight: 0.6 }
    ];

    let bestMatch = null;
    let bestScore = 0;
    let bestMethod = '';

    // Normalize external name once
    const normalizedExternal = this.normalizeTeamName(externalTeamName);
    const externalKeywords = normalizedExternal.split(/\s+/).filter(w => w.length > 2);

    for (const ourTeam of ourTeams) {
      for (const strategy of strategies) {
        let score = 0;
        let method = '';

        switch (strategy.name) {
          case 'exact_normalized':
            const normalizedOur = this.normalizeTeamName(ourTeam.name);
            if (normalizedExternal === normalizedOur) {
              score = 1.0;
              method = 'exact_normalized';
            }
            break;

          case 'short_name_match':
            // Match by shortName if available
            if (ourTeam.shortName) {
              const normalizedShort = this.normalizeTeamName(ourTeam.shortName);
              const normalizedExternalForShort = this.normalizeTeamName(externalTeamName);
              
              // Check if shortName is contained in external name or vice versa
              if (normalizedExternalForShort.includes(normalizedShort) || 
                  normalizedShort.includes(normalizedExternalForShort) ||
                  normalizedExternalForShort === normalizedShort) {
                score = 0.95;
                method = 'short_name_match';
              }
              
              // Also check if external name normalized contains key city/team name
              const ourNameNormalized = this.normalizeTeamName(ourTeam.name);
              if (normalizedExternalForShort.includes(ourNameNormalized) || 
                  ourNameNormalized.includes(normalizedExternalForShort)) {
                score = Math.max(score, 0.9);
                method = 'short_name_match';
              }
            }
            break;

          case 'fuzzy_normalized':
            const fuzzyOur = this.normalizeTeamName(ourTeam.name);
            score = this.calculateSimilarity(normalizedExternal, fuzzyOur);
            method = 'fuzzy_normalized';
            break;

          case 'partial_match':
            score = this.calculatePartialMatch(externalTeamName, ourTeam.name);
            method = 'partial_match';
            break;

          case 'word_overlap':
            score = this.calculateWordOverlap(externalTeamName, ourTeam.name);
            method = 'word_overlap';
            break;

          case 'contains_keyword':
            // Check if key words from one name appear in the other
            const ourNameNormalized = this.normalizeTeamName(ourTeam.name);
            const ourKeywords = ourNameNormalized.split(/\s+/).filter(w => w.length > 2);
            
            // Count matching keywords
            const matchingKeywords = externalKeywords.filter(ek => 
              ourKeywords.some(ok => ok.includes(ek) || ek.includes(ok))
            );
            
            if (matchingKeywords.length > 0) {
              // Score based on ratio of matching keywords
              score = matchingKeywords.length / Math.max(externalKeywords.length, ourKeywords.length);
              // Boost score if it's a city name match (e.g., "lyon" in both)
              if (matchingKeywords.some(k => k.length >= 4)) {
                score = Math.min(score * 1.2, 1.0);
              }
              method = 'contains_keyword';
            }
            break;
        }

        const weightedScore = score * strategy.weight;
        
        if (weightedScore > bestScore && score >= strategy.threshold) {
          bestScore = weightedScore;
          bestMatch = ourTeam;
          bestMethod = method;
        }
      }
    }

    if (bestMatch) {
      console.log(`🎯 Rugby match: "${externalTeamName}" → "${bestMatch.name}"${bestMatch.shortName ? ` (${bestMatch.shortName})` : ''} (${(bestScore * 100).toFixed(1)}% via ${bestMethod})`);
    } else {
      console.log(`❌ No rugby match found for: "${externalTeamName}"`);
    }

    return bestMatch ? { team: bestMatch, score: bestScore, method: bestMethod } : null;
  }

  /**
   * Map fixtures to matches
   */
  private mapFixturesToMatches(fixtures: RugbyFixture[]): RugbyMatch[] {
    return fixtures.map(fixture => {
      const status = this.mapStatus(fixture.fixture.status.short);
      const externalStatus = fixture.fixture.status.short;
      
      // For rugby, use goals.home/away for scores
      // For AET/PEN, use extra scores if available
      let homeScore: number | null = fixture.goals.home;
      let awayScore: number | null = fixture.goals.away;
      
      if ((externalStatus === 'AET' || externalStatus === 'PEN') && fixture.goals.extra) {
        // Use extra time scores (80 minutes) instead of penalty scores
        homeScore = fixture.goals.extra.home;
        awayScore = fixture.goals.extra.away;
      }

      return {
        id: fixture.fixture.id,
        status,
        externalStatus,
        elapsedMinute: fixture.fixture.status.elapsed,
        homeTeam: {
          id: fixture.teams.home.id,
          name: fixture.teams.home.name,
        },
        awayTeam: {
          id: fixture.teams.away.id,
          name: fixture.teams.away.name,
        },
        score: {
          fullTime: {
            home: homeScore,
            away: awayScore,
          },
        },
        utcDate: fixture.fixture.date,
        competition: {
          id: fixture.league.id,
          name: fixture.league.name,
        },
      };
    });
  }

  /**
   * Get all available rugby competitions
   */
  async getCompetitions(country?: string): Promise<ExternalRugbyCompetition[]> {
    try {
      const endpoint = country 
        ? `/leagues?country=${encodeURIComponent(country)}`
        : '/leagues';
      console.log(`[RUGBY API] Fetching competitions from endpoint: ${endpoint}`);
      
      let data: any;
      try {
        data = await this.makeRequest(endpoint);
      } catch (error) {
        console.error(`[RUGBY API] ❌ Error calling ${endpoint}:`, error);
        if (error instanceof Error) {
          console.error(`[RUGBY API] Error message: ${error.message}`);
          console.error(`[RUGBY API] Error stack: ${error.stack}`);
          // Re-throw the error so it can be handled by the caller
          throw error;
        }
        return [];
      }
      
      console.log(`[RUGBY API] Raw API response structure:`, {
        hasResponse: !!data.response,
        isArray: Array.isArray(data.response),
        responseLength: data.response?.length || 0,
        responseType: typeof data.response,
        topLevelKeys: Object.keys(data || {}),
        hasErrors: !!data.errors,
        errors: data.errors,
        sampleFirstItem: data.response?.[0] ? {
          keys: Object.keys(data.response[0]),
          full: JSON.stringify(data.response[0], null, 2).substring(0, 500)
        } : null
      });
      
      // Check for errors in response (even if makeRequest didn't throw)
      if (data.errors) {
        const hasErrors = Array.isArray(data.errors) 
          ? data.errors.length > 0 
          : Object.keys(data.errors).length > 0;
        
        if (hasErrors) {
          const errorMessage = typeof data.errors === 'object' && !Array.isArray(data.errors)
            ? Object.values(data.errors).join(', ')
            : JSON.stringify(data.errors);
          console.error(`[RUGBY API] ❌ API returned errors: ${errorMessage}`);
          throw new Error(`API errors: ${errorMessage}`);
        }
      }
      
      if (!data.response || !Array.isArray(data.response)) {
        console.error(`[RUGBY API] ❌ Invalid response structure. Expected data.response to be an array`);
        console.error(`[RUGBY API] Actual structure:`, {
          responseType: typeof data.response,
          responseValue: data.response,
          fullData: JSON.stringify(data, null, 2).substring(0, 1000)
        });
        return [];
      }
      
      if (data.response.length === 0) {
        console.warn(`[RUGBY API] ⚠️ API returned empty response array`);
        // Check if this is due to rate limiting or other errors
        if (data.errors) {
          const errorMessage = typeof data.errors === 'object' && !Array.isArray(data.errors)
            ? Object.values(data.errors).join(', ')
            : JSON.stringify(data.errors);
          throw new Error(`API returned empty response. ${errorMessage}`);
        }
        return [];
      }
      
      // Group by competition ID and merge seasons
      const competitionMap = new Map<number, ExternalRugbyCompetition>();
      
      for (const item of data.response) {
        // Log first item structure to understand the API response format
        if (competitionMap.size === 0) {
          console.log(`[RUGBY API] First item structure:`, {
            keys: Object.keys(item),
            hasId: !!item.id,
            hasLeague: !!item.league,
            hasName: !!item.name,
            hasCountry: !!item.country,
            full: JSON.stringify(item, null, 2).substring(0, 500)
          });
        }
        
        // Rugby API v1 returns items directly, not nested in league/country objects
        // Structure: { id, name, type, country: { name }, season }
        // OR: { league: { id, name, type }, country: { name }, seasons: [...] }
        const leagueId = item.id || item.league?.id;
        const leagueName = item.name || item.league?.name;
        const leagueType = item.type || item.league?.type;
        
        // Handle country - can be string or object
        let countryName = '';
        if (typeof item.country === 'string') {
          countryName = item.country;
        } else if (item.country?.name) {
          countryName = item.country.name;
        } else if (item.league?.country) {
          countryName = typeof item.league.country === 'string' ? item.league.country : item.league.country.name || '';
        }
        
        const leagueLogo = item.logo || item.league?.logo;
        
        if (!leagueId) {
          console.warn('[RUGBY API] ⚠️ Skipping item without ID:', {
            hasId: !!item.id,
            hasLeagueId: !!item.league?.id,
            itemKeys: Object.keys(item),
            sample: JSON.stringify(item, null, 2).substring(0, 300)
          });
          continue;
        }
        
        if (!competitionMap.has(leagueId)) {
          competitionMap.set(leagueId, {
            id: leagueId,
            name: leagueName || `Competition ${leagueId}`,
            country: countryName,
            type: leagueType || 'League',
            logo: leagueLogo || undefined,
            seasons: [],
          });
        }
        
        const competition = competitionMap.get(leagueId)!;
        // Handle seasons - Rugby API v1 might have different structure
        if (item.season) {
          const season = item.season;
          const seasonYear = season.year || season.season || season;
          if (seasonYear && !competition.seasons.find(s => s.year === String(seasonYear))) {
            competition.seasons.push({
              year: String(seasonYear),
              start: season.start || '',
              end: season.end || '',
              current: season.current || false,
            });
          }
        } else if (item.seasons && Array.isArray(item.seasons)) {
          for (const season of item.seasons) {
            const seasonYear = season.year || season.season || season;
            if (seasonYear && !competition.seasons.find(s => s.year === String(seasonYear))) {
              competition.seasons.push({
                year: String(seasonYear),
                start: season.start || '',
                end: season.end || '',
                current: season.current || false,
              });
            }
          }
        }
      }
      
      const competitions = Array.from(competitionMap.values());
      console.log(`[RUGBY API] ✅ Processed ${competitions.length} unique competitions from ${data.response.length} items`);
      if (competitions.length > 0) {
        console.log(`[RUGBY API] Sample competitions:`, competitions.slice(0, 5).map(c => ({ 
          id: c.id,
          name: c.name, 
          country: c.country,
          seasonsCount: c.seasons.length
        })));
      } else {
        console.error(`[RUGBY API] ❌ No competitions were successfully parsed!`);
        console.error(`[RUGBY API] Raw response sample:`, JSON.stringify(data.response.slice(0, 3), null, 2));
      }
      return competitions;
    } catch (error) {
      console.error('[RUGBY API] ❌ Error fetching rugby competitions:', error);
      if (error instanceof Error) {
        console.error('[RUGBY API] Error message:', error.message);
        console.error('[RUGBY API] Error stack:', error.stack);
      }
      return [];
    }
  }

  /**
   * Get seasons for a specific competition
   */
  async getCompetitionSeasons(competitionId: number): Promise<ExternalRugbySeason[]> {
    try {
      const data = await this.makeRequest(`/leagues?id=${competitionId}`);
      console.log(`[RUGBY API] getCompetitionSeasons response for ID ${competitionId}:`, {
        responseLength: data.response?.length || 0,
        sample: data.response?.[0]
      });
      
      const seasons: ExternalRugbySeason[] = [];
      
      for (const item of data.response || []) {
        // Rugby API v1 returns seasons in item.seasons array
        // Structure: { season: 2024, current: false, start: "2024-09-07", end: "2025-06-28" }
        if (item.seasons && Array.isArray(item.seasons)) {
          for (const seasonObj of item.seasons) {
            // API returns season as a number (e.g., 2024), not as season.year
            const seasonValue = seasonObj.season || seasonObj.year;
            if (seasonValue) {
              seasons.push({
                year: String(seasonValue), // Convert to string for consistency
                start: seasonObj.start || '',
                end: seasonObj.end || '',
                current: seasonObj.current || false,
              });
            }
          }
        } else if (item.season) {
          // Single season object (fallback)
          const seasonValue = typeof item.season === 'object' ? (item.season.season || item.season.year) : item.season;
          if (seasonValue) {
            seasons.push({
              year: String(seasonValue),
              start: (typeof item.season === 'object' ? item.season.start : '') || '',
              end: (typeof item.season === 'object' ? item.season.end : '') || '',
              current: (typeof item.season === 'object' ? item.season.current : false) || false,
            });
          }
        }
      }
      
      // If no seasons found, create a default season based on current year
      if (seasons.length === 0) {
        const currentYear = new Date().getFullYear();
        const nextYear = currentYear + 1;
        const yearString = `${currentYear}-${nextYear}`;
        seasons.push({
          year: yearString,
          start: new Date(currentYear, 8, 1).toISOString().split('T')[0], // September 1st
          end: new Date(nextYear, 5, 30).toISOString().split('T')[0], // June 30th
          current: true,
        });
        console.log(`[RUGBY API] No seasons found, created default season: ${yearString}`);
      }
      
      return seasons.sort((a, b) => b.year.localeCompare(a.year));
    } catch (error) {
      console.error(`Error fetching seasons for competition ${competitionId}:`, error);
      // Return a default season if API call fails
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const yearString = `${currentYear}-${nextYear}`;
      return [{
        year: yearString,
        start: new Date(currentYear, 8, 1).toISOString().split('T')[0],
        end: new Date(nextYear, 5, 30).toISOString().split('T')[0],
        current: true,
      }];
    }
  }

  /**
   * Get available season keys from /seasons endpoint
   * Returns array of season years (e.g., [2024, 2023, 2022, ...])
   */
  async getAvailableSeasons(): Promise<number[]> {
    try {
      console.log(`[RUGBY API] Fetching available seasons from /seasons endpoint...`);
      const data = await this.makeRequest('/seasons');
      
      if (!data.response || !Array.isArray(data.response)) {
        console.warn(`[RUGBY API] ⚠️ Invalid response from /seasons endpoint`);
        return [];
      }
      
      // Extract season years - response is directly an array of numbers [2008, 2009, ...]
      const seasons = data.response
        .map((item: any) => {
          // Item can be directly a number, or an object with season/year property
          if (typeof item === 'number') {
            return item;
          }
          const season = item.season || item.year || item;
          return typeof season === 'number' ? season : parseInt(String(season));
        })
        .filter((year: number) => !isNaN(year) && year > 2000 && year < 2100)
        .sort((a: number, b: number) => b - a); // Descending
      
      console.log(`[RUGBY API] ✅ Found ${seasons.length} available seasons:`, seasons.slice(0, 10));
      return seasons;
    } catch (error) {
      console.error(`[RUGBY API] ❌ Error fetching available seasons:`, error);
      return [];
    }
  }

  /**
   * Discover the current/next season for a competition using season discovery logic
   * 
   * IMPORTANT: In Rugby API, `season` is a 4-digit partition key = START year of season
   * (e.g., season 2024 = 2024/25 season, games from 2024-09 to 2025-06)
   * 
   * Logic:
   * 1. Call GET /seasons to get candidate season keys
   * 2. Sort descending and iterate:
   *    a) GET /games?league={id}&season={year}&last=1 - record lastGameDate if results>0
   *    b) GET /games?league={id}&season={year}&next=1 - record nextGameDate if results>0
   *    c) If either exists, season is "valid"
   * 3. Choose most recent valid season as current, OR season where "now" is between last/next dates
   */
  async getCurrentOrNextSeason(competitionId: number): Promise<ExternalRugbySeason | null> {
    try {
      console.log(`[RUGBY API] Discovering season for league ${competitionId} using season discovery logic...`);
      
      const now = new Date();
      
      // Step 1: Get candidate season keys from /seasons endpoint
      let availableSeasons = await this.getAvailableSeasons();
      
      // Fallback: If /seasons doesn't work, try to get seasons from recent years
      if (availableSeasons.length === 0) {
        console.warn(`[RUGBY API] ⚠️ No available seasons found from /seasons endpoint, using fallback years`);
        const currentYear = now.getFullYear();
        // Try current year first, then previous years (important for competitions like Six Nations in Feb-Mar)
        availableSeasons = [currentYear, currentYear - 1, currentYear + 1, currentYear - 2, currentYear - 3, currentYear - 4];
        console.log(`[RUGBY API] Using fallback seasons:`, availableSeasons);
      } else {
        // Ensure current year is included in available seasons (in case it's missing)
        const currentYear = now.getFullYear();
        if (!availableSeasons.includes(currentYear)) {
          availableSeasons.unshift(currentYear); // Add at the beginning
          console.log(`[RUGBY API] Added current year ${currentYear} to available seasons`);
        }
      }
      
      console.log(`[RUGBY API] Testing ${availableSeasons.length} candidate seasons...`);
      
      // Step 2: Iterate through seasons (already sorted descending)
      // Limit to first 10 seasons to avoid too many API calls
      const seasonsToTest = availableSeasons.slice(0, 10);
      console.log(`[RUGBY API] Testing first ${seasonsToTest.length} seasons (out of ${availableSeasons.length} available)...`);
      
      const validSeasons: Array<{
        year: number;
        lastGameDate: Date | null;
        nextGameDate: Date | null;
        isCurrent: boolean;
      }> = [];
      
      for (const seasonYear of seasonsToTest) {
        let lastGameDate: Date | null = null;
        let nextGameDate: Date | null = null;
        
        // Step 2: Fetch games for this season and find last/next games (client-side filtering)
        // Rugby API doesn't support last=1 or next=1, so we fetch games and filter
        let gamesData: any = null;
        let fetchError: string | null = null;
        
        try {
          // Fetch all games for this season
          gamesData = await this.makeRequest(`/games?league=${competitionId}&season=${seasonYear}`);
          
          if (gamesData.errors && Object.keys(gamesData.errors).length > 0) {
            // Check if it's the "last" or "next" field error (which we can ignore since we're not using those params)
            const errorKeys = Object.keys(gamesData.errors);
            const hasRealErrors = errorKeys.some(key => key !== 'last' && key !== 'next');
            if (hasRealErrors) {
              fetchError = JSON.stringify(gamesData.errors);
              console.warn(`[RUGBY API] Season ${seasonYear}: API errors:`, gamesData.errors);
            }
          }
          
          if (gamesData.response && Array.isArray(gamesData.response) && gamesData.response.length > 0) {
            // Parse all games with their dates
            const gamesWithDates = gamesData.response
              .map((game: any) => {
                const gameDate = new Date(game.date || game.fixture?.date || game.game?.date);
                return { game, date: gameDate };
              })
              .filter((item: any) => !isNaN(item.date.getTime()));
            
            // Find the last (most recent past) game
            const pastGames = gamesWithDates
              .filter((item: any) => item.date <= now)
              .sort((a: any, b: any) => b.date.getTime() - a.date.getTime());
            
            if (pastGames.length > 0) {
              lastGameDate = pastGames[0].date;
              console.log(`[RUGBY API] Season ${seasonYear}: ✅ Found last game on ${lastGameDate.toISOString().split('T')[0]} (from ${gamesWithDates.length} total games)`);
            } else {
              console.log(`[RUGBY API] Season ${seasonYear}: No past games found (all games are in the future)`);
            }
            
            // Find the next (earliest future) game
            const futureGames = gamesWithDates
              .filter((item: any) => item.date >= now)
              .sort((a: any, b: any) => a.date.getTime() - b.date.getTime());
            
            if (futureGames.length > 0) {
              nextGameDate = futureGames[0].date;
              console.log(`[RUGBY API] Season ${seasonYear}: ✅ Found next game on ${nextGameDate.toISOString().split('T')[0]} (from ${gamesWithDates.length} total games)`);
            } else {
              console.log(`[RUGBY API] Season ${seasonYear}: No future games found (all games are in the past)`);
            }
          } else {
            console.log(`[RUGBY API] Season ${seasonYear}: No games found (empty response)`);
          }
        } catch (error) {
          fetchError = error instanceof Error ? error.message : String(error);
          console.warn(`[RUGBY API] Season ${seasonYear}: Error fetching games:`, fetchError);
        }
        
        // Step 2c: If either exists, season is "valid"
        if (lastGameDate || nextGameDate) {
          // Determine if current season based on dates
          // A season is "current" if:
          // 1. We have both last and next, and now is between them
          // 2. We have only last, and it's recent (within last 9 months - typical season length)
          // 3. We have only next, and it's soon (within next 3 months - season starting soon)
          let isCurrent = false;
          
          if (lastGameDate && nextGameDate) {
            // Both exist: current if now is between them
            isCurrent = now >= lastGameDate && now <= nextGameDate;
            console.log(`[RUGBY API] Season ${seasonYear}: Both dates exist. Now is between: ${isCurrent}`);
          } else if (lastGameDate) {
            // Only last game: current if it's recent (within last 9 months)
            const nineMonthsAgo = new Date(now.getTime() - 9 * 30 * 24 * 60 * 60 * 1000);
            isCurrent = lastGameDate >= nineMonthsAgo;
            console.log(`[RUGBY API] Season ${seasonYear}: Only last game. Recent: ${isCurrent} (last: ${lastGameDate.toISOString().split('T')[0]}, 9 months ago: ${nineMonthsAgo.toISOString().split('T')[0]})`);
          } else if (nextGameDate) {
            // Only next game: NEVER consider a future season as "current" if it's too far
            // A season with only future games should only be "current" if:
            // 1. The season year matches the expected current season year
            // 2. AND the next game is very soon (within next 2 months) - season starting very soon
            const twoMonthsFromNow = new Date(now.getTime() + 2 * 30 * 24 * 60 * 60 * 1000);
            const currentYear = now.getFullYear();
            const month = now.getMonth() + 1; // 1-12
            
            // For Jan-Aug, current season is previous year (e.g., Jan 2026 = season 2025)
            // For Sep-Dec, current season is current year (e.g., Sep 2026 = season 2026)
            const expectedSeasonYear = month >= 9 ? currentYear : currentYear - 1;
            
            // Only consider current if:
            // - Season year EXACTLY matches expected current season (no tolerance for future seasons)
            // - AND next game is within 2 months AND in the future
            const isSoon = nextGameDate <= twoMonthsFromNow && nextGameDate >= now;
            const isExpectedSeason = seasonYear === expectedSeasonYear; // STRICT: must match exactly
            
            isCurrent = isSoon && isExpectedSeason;
            
            console.log(`[RUGBY API] Season ${seasonYear}: Only next game. Soon: ${isSoon}, Expected season: ${expectedSeasonYear}, Match: ${isExpectedSeason}, Current: ${isCurrent} (next: ${nextGameDate.toISOString().split('T')[0]})`);
            
            // If season year is greater than expected, it's definitely a future season, not current
            if (seasonYear > expectedSeasonYear) {
              isCurrent = false;
              console.log(`[RUGBY API] Season ${seasonYear} is in the future (expected: ${expectedSeasonYear}), marking as NOT current`);
            }
          }
          
          validSeasons.push({
            year: seasonYear,
            lastGameDate,
            nextGameDate,
            isCurrent
          });
          
          console.log(`[RUGBY API] ✅ Season ${seasonYear} is VALID (last: ${lastGameDate?.toISOString().split('T')[0] || 'none'}, next: ${nextGameDate?.toISOString().split('T')[0] || 'none'}, current: ${isCurrent})`);
          
          // If we found a current season, we can stop testing (optimization)
          if (isCurrent) {
            console.log(`[RUGBY API] ✅ Found current season ${seasonYear}, stopping search`);
            break;
          }
        } else {
          const errorInfo = fetchError || '';
          console.log(`[RUGBY API] ⚠️ Season ${seasonYear} has no games (not valid)${errorInfo ? `. Errors: ${errorInfo}` : ''}`);
        }
      }
      
      if (validSeasons.length === 0) {
        console.warn(`[RUGBY API] ⚠️ No valid seasons found for league ${competitionId} after testing ${seasonsToTest.length} seasons`);
        console.warn(`[RUGBY API] This could mean:`);
        console.warn(`  - The competition has no games for any tested season`);
        console.warn(`  - The competition ID is incorrect`);
        console.warn(`  - The API is rate-limited or returning errors`);
        
        // Fallback: return the EXPECTED season year, not the most recent available
        // This ensures we use the correct season even if it has no games yet
        const month = now.getMonth() + 1; // 1-12
        const currentYear = now.getFullYear();
        const expectedSeasonYear = month >= 9 ? currentYear : currentYear - 1;
        
        console.log(`[RUGBY API] ⚠️ Using expected season year ${expectedSeasonYear} as fallback (no valid seasons found)`);
        
        // Estimate season dates based on typical Rugby season (Sep-Jun)
        let seasonStart: Date;
        let seasonEnd: Date;
        
        if (month >= 9) {
          // Sep-Dec: current year's season
          seasonStart = new Date(expectedSeasonYear, 8, 1); // September 1st
          seasonEnd = new Date(expectedSeasonYear + 1, 5, 30); // June 30th next year
        } else {
          // Jan-Aug: previous year's season
          seasonStart = new Date(expectedSeasonYear, 8, 1); // September 1st of expected year
          seasonEnd = new Date(expectedSeasonYear + 1, 5, 30); // June 30th next year
        }
        
        return {
          year: String(expectedSeasonYear),
          start: seasonStart.toISOString().split('T')[0],
          end: seasonEnd.toISOString().split('T')[0],
          current: true // Assume current since it's the expected season
        };
      }
      
      // Step 3: Choose the best season
      // Strategy (STRICT priority order):
      // 1. Prefer current season with both last and next games (most complete)
      // 2. Among those, prefer current season
      // 3. CRITICAL: Always prefer season matching expected year, even if not marked as "current"
      // 4. If no match, prefer season with last game (past season) over future-only season
      // 5. NEVER use a future season if a past season exists
      // 6. Fallback to most recent valid season
      
      // Reuse 'now' variable declared at the beginning of the function
      const month = now.getMonth() + 1; // 1-12
      const currentYear = now.getFullYear();
      const expectedSeasonYear = month >= 9 ? currentYear : currentYear - 1;
      
      console.log(`[RUGBY API] Expected current season year: ${expectedSeasonYear} (current date: ${now.toISOString().split('T')[0]}, month: ${month})`);
      console.log(`[RUGBY API] Valid seasons found:`, validSeasons.map(s => ({
        year: s.year,
        isCurrent: s.isCurrent,
        hasLast: !!s.lastGameDate,
        hasNext: !!s.nextGameDate,
        lastDate: s.lastGameDate?.toISOString().split('T')[0] || 'none',
        nextDate: s.nextGameDate?.toISOString().split('T')[0] || 'none'
      })));
      
      let bestSeason: typeof validSeasons[0] | null = null;
      
      // NEW PRIORITY LOGIC: Prioritize seasons with future games or recent games
      // This is important for competitions like Six Nations that play in Feb-Mar
      
      // 1. First, look for seasons with future games (nextGameDate in the future)
      const seasonsWithFutureGames = validSeasons.filter(s => {
        if (!s.nextGameDate) return false;
        return s.nextGameDate >= now;
      });
      
      if (seasonsWithFutureGames.length > 0) {
        // Sort by nextGameDate ascending (closest future game first)
        seasonsWithFutureGames.sort((a, b) => {
          const dateA = a.nextGameDate!.getTime();
          const dateB = b.nextGameDate!.getTime();
          return dateA - dateB; // Ascending
        });
        bestSeason = seasonsWithFutureGames[0];
        console.log(`[RUGBY API] ✅ PRIORITY: Found season with future games: ${bestSeason.year} (next game: ${bestSeason.nextGameDate?.toISOString().split('T')[0]})`);
      } else {
        // 2. No future games, look for current season (with games between last and next)
        const currentSeasons = validSeasons.filter(s => s.isCurrent);
        if (currentSeasons.length > 0) {
          // Prefer current season with both dates
          bestSeason = currentSeasons.find(s => s.lastGameDate && s.nextGameDate) || currentSeasons[0];
          console.log(`[RUGBY API] ✅ Found current season: ${bestSeason.year}`);
        } else {
          // 3. No current season, check if expected year has any games
          const matchingExpectedYear = validSeasons.find(s => s.year === expectedSeasonYear);
          if (matchingExpectedYear) {
            bestSeason = matchingExpectedYear;
            console.log(`[RUGBY API] ✅ Using season matching expected year ${expectedSeasonYear}: ${bestSeason.year}`);
          } else {
            console.log(`[RUGBY API] ⚠️ No season found matching expected year ${expectedSeasonYear}`);
            
            // 4. Look for most recent past season with games
            const seasonsWithLast = validSeasons.filter(s => s.lastGameDate);
            
            if (seasonsWithLast.length > 0) {
              // Sort by lastGameDate descending (most recent past season)
              seasonsWithLast.sort((a, b) => {
                const dateA = a.lastGameDate!.getTime();
                const dateB = b.lastGameDate!.getTime();
                return dateB - dateA; // Descending
              });
              bestSeason = seasonsWithLast[0];
              console.log(`[RUGBY API] ✅ Using most recent past season: ${bestSeason.year} (last game: ${bestSeason.lastGameDate?.toISOString().split('T')[0]})`);
            } else {
              // 5. Fallback: most recent valid season
              bestSeason = validSeasons[0];
              console.log(`[RUGBY API] ⚠️ Using most recent valid season: ${bestSeason.year}`);
            }
          }
        }
      }
      
      // Calculate start and end dates from actual game dates
      // We need to fetch the actual games to get accurate start/end dates
      let startDate: Date;
      let endDate: Date;
      let actualSeasonYear: number = bestSeason.year; // Will be updated if we find games
      
      try {
        // Fetch actual games for this season to get real start/end dates
        const gamesData = await this.makeRequest(`/games?league=${competitionId}&season=${bestSeason.year}`);
        
        if (gamesData.response && Array.isArray(gamesData.response) && gamesData.response.length > 0) {
          // Parse all game dates
          const gameDates = gamesData.response
            .map((game: any) => {
              const gameDate = new Date(game.date || game.fixture?.date || game.game?.date);
              return isNaN(gameDate.getTime()) ? null : gameDate;
            })
            .filter((date: Date | null) => date !== null) as Date[];
          
          if (gameDates.length > 0) {
            // Sort dates and use earliest as start, latest as end
            gameDates.sort((a, b) => a.getTime() - b.getTime());
            startDate = gameDates[0];
            endDate = gameDates[gameDates.length - 1];
            
            // Use the year of the actual games for the season year
            // For competitions like Six Nations (Feb-Mar), use the calendar year of the games
            // For competitions like Top 14 (Sep-Jun), use the start year of the season
            const firstGameYear = startDate.getFullYear();
            const lastGameYear = endDate.getFullYear();
            
            // If games span across year boundary (e.g., Dec 2025 - Jan 2026), use the later year
            // If games are within same year (e.g., Feb-Mar 2026), use that year
            if (firstGameYear === lastGameYear) {
              actualSeasonYear = firstGameYear;
            } else {
              // Games span across years - use the year that contains most games or the later year
              // For Six Nations, games are typically Feb-Mar, so use the year of the first game
              actualSeasonYear = firstGameYear;
            }
            
            console.log(`[RUGBY API] Using actual game dates: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${gameDates.length} games), season year: ${actualSeasonYear}`);
          } else {
            // No valid dates found, use fallback
            throw new Error('No valid game dates found');
          }
        } else {
          // No games found, use fallback
          throw new Error('No games found in response');
        }
      } catch (error) {
        // Fallback: use lastGameDate/nextGameDate or estimate from season year
        console.warn(`[RUGBY API] Could not fetch actual game dates, using fallback:`, error instanceof Error ? error.message : String(error));
        
        if (bestSeason.lastGameDate && bestSeason.nextGameDate) {
          // Both dates exist: use the earlier as start, later as end
          startDate = bestSeason.lastGameDate < bestSeason.nextGameDate ? bestSeason.lastGameDate : bestSeason.nextGameDate;
          endDate = bestSeason.lastGameDate > bestSeason.nextGameDate ? bestSeason.lastGameDate : bestSeason.nextGameDate;
        } else if (bestSeason.lastGameDate) {
          // Only last game: estimate start from season year, use last game as end
          // For competitions like Six Nations (Feb-Mar), estimate start as Jan 1st of season year
          startDate = new Date(bestSeason.year, 0, 1); // January 1st of season year
          endDate = bestSeason.lastGameDate;
        } else if (bestSeason.nextGameDate) {
          // Only next game: use next game as start, estimate end
          startDate = bestSeason.nextGameDate;
          endDate = new Date(bestSeason.year + 1, 5, 30); // June 30th of next year
        } else {
          // No dates: estimate from season year
          // For most rugby competitions, season is Sep-Jun, but for Six Nations it's Feb-Mar
          // We'll use a conservative estimate: Jan 1st to Dec 31st of season year
          startDate = new Date(bestSeason.year, 0, 1); // January 1st
          endDate = new Date(bestSeason.year, 11, 31); // December 31st
        }
      }
      
      const seasonYearStr = String(actualSeasonYear);
      const startDateStr = startDate.toISOString().split('T')[0];
      const endDateStr = endDate.toISOString().split('T')[0];
      
      console.log(`[RUGBY API] ✅ Determined season: ${seasonYearStr} (${startDateStr} to ${endDateStr}), current: ${bestSeason.isCurrent}`);
      
      return {
        year: seasonYearStr,
        start: startDateStr,
        end: endDateStr,
        current: bestSeason.isCurrent
      };
    } catch (error) {
      console.error(`[RUGBY API] ❌ Error determining season for competition ${competitionId}:`, error);
      if (error instanceof Error) {
        console.error(`[RUGBY API] Error message: ${error.message}`);
        console.error(`[RUGBY API] Error stack: ${error.stack}`);
      }
      return null;
    }
  }

  /**
   * Get all valid seasons for a competition with their calculated dates
   * Returns an array of seasons with start/end dates calculated from actual games
   */
  async getAllValidSeasons(competitionId: number): Promise<ExternalRugbySeason[]> {
    try {
      console.log(`[RUGBY API] Getting all valid seasons for league ${competitionId}...`);
      
      const now = new Date();
      
      // Get candidate season keys
      let availableSeasons = await this.getAvailableSeasons();
      
      if (availableSeasons.length === 0) {
        const currentYear = now.getFullYear();
        availableSeasons = [currentYear, currentYear - 1, currentYear + 1, currentYear - 2, currentYear - 3, currentYear - 4];
      } else {
        const currentYear = now.getFullYear();
        if (!availableSeasons.includes(currentYear)) {
          availableSeasons.unshift(currentYear);
        }
      }
      
      // Limit to first 10 seasons to avoid too many API calls
      const seasonsToTest = availableSeasons.slice(0, 10);
      const validSeasons: ExternalRugbySeason[] = [];
      
      for (const seasonYear of seasonsToTest) {
        try {
          // Fetch games for this season
          const gamesData = await this.makeRequest(`/games?league=${competitionId}&season=${seasonYear}`);
          
          if (gamesData.response && Array.isArray(gamesData.response) && gamesData.response.length > 0) {
            // Parse all game dates
            const gameDates = gamesData.response
              .map((game: any) => {
                const gameDate = new Date(game.date || game.fixture?.date || game.game?.date);
                return isNaN(gameDate.getTime()) ? null : gameDate;
              })
              .filter((date: Date | null) => date !== null) as Date[];
            
            if (gameDates.length > 0) {
              // Sort dates
              gameDates.sort((a, b) => a.getTime() - b.getTime());
              const startDate = gameDates[0];
              const endDate = gameDates[gameDates.length - 1];
              
              // Determine season year from actual games
              const firstGameYear = startDate.getFullYear();
              const lastGameYear = endDate.getFullYear();
              const actualSeasonYear = firstGameYear === lastGameYear ? firstGameYear : firstGameYear;
              
              // Check if season is current
              const isCurrent = startDate <= now && now <= endDate;
              
              validSeasons.push({
                year: String(actualSeasonYear),
                start: startDate.toISOString().split('T')[0],
                end: endDate.toISOString().split('T')[0],
                current: isCurrent
              });
              
              console.log(`[RUGBY API] ✅ Found valid season ${actualSeasonYear}: ${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]} (${gameDates.length} games)`);
            }
          }
        } catch (error) {
          // Skip this season if there's an error
          console.log(`[RUGBY API] ⚠️ Season ${seasonYear} has no games or error:`, error instanceof Error ? error.message : String(error));
        }
      }
      
      // Sort by year descending (most recent first)
      validSeasons.sort((a, b) => parseInt(b.year) - parseInt(a.year));
      
      console.log(`[RUGBY API] ✅ Found ${validSeasons.length} valid seasons`);
      return validSeasons;
    } catch (error) {
      console.error(`[RUGBY API] ❌ Error getting all valid seasons:`, error);
      return [];
    }
  }

  /**
   * Get teams for a competition and season
   */
  async getTeamsByCompetition(competitionId: number, season: string): Promise<ExternalRugbyTeam[]> {
    try {
      // Normalize season: extract year if format is "2024-2025" or just use the value if it's "2024"
      // Rugby API v1 expects just the year number (e.g., 2024)
      let seasonParam = season;
      if (season.includes('-')) {
        seasonParam = season.split('-')[0]; // Extract start year
      }
      // Remove any non-numeric characters and ensure it's a valid year
      seasonParam = seasonParam.replace(/\D/g, ''); // Keep only digits
      if (seasonParam.length !== 4) {
        console.warn(`[RUGBY API] Invalid season format: ${season}, using as-is: ${seasonParam}`);
      }
      
      // Rugby API v1: ALWAYS use season parameter (required partition key)
      const endpoint = `/teams?league=${competitionId}&season=${seasonParam}`;
      
      console.log(`[RUGBY API] Fetching teams from endpoint: ${endpoint} (season: ${seasonParam} from ${season})`);
      
      let data: any;
      try {
        data = await this.makeRequest(endpoint);
      } catch (error) {
        console.error(`[RUGBY API] ❌ Error calling ${endpoint}:`, error);
        throw new Error(`Failed to fetch teams for league ${competitionId}, season ${seasonParam}: ${error instanceof Error ? error.message : String(error)}`);
      }
      
      // Check for API errors
      if (data.errors && data.errors.length > 0) {
        const errorMsg = `API errors for league ${competitionId}, season ${seasonParam}: ${JSON.stringify(data.errors)}`;
        console.error(`[RUGBY API] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // Check if response is empty
      if (!data.response || !Array.isArray(data.response) || data.response.length === 0) {
        const errorMsg = `No teams found for league ${competitionId}, season ${seasonParam}. Response length: ${data.response?.length || 0}. API errors: ${data.errors ? JSON.stringify(data.errors) : 'none'}`;
        console.error(`[RUGBY API] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      console.log(`[RUGBY API] Raw API response structure from ${endpoint}:`, {
        hasResponse: !!data.response,
        isArray: Array.isArray(data.response),
        responseLength: data.response?.length || 0,
        responseType: typeof data.response,
        fullResponseKeys: Object.keys(data || {}),
        sample: data.response?.[0] ? {
          keys: Object.keys(data.response[0]),
          id: data.response[0].id,
          name: data.response[0].name,
          hasCountry: !!data.response[0].country,
          hasLogo: !!data.response[0].logo
        } : null
      });
      
      const teams: ExternalRugbyTeam[] = [];
      
      if (!data.response || !Array.isArray(data.response)) {
        console.error(`[RUGBY API] Invalid response structure. Expected data.response to be an array, got:`, typeof data.response, data.response);
        return [];
      }
      
      console.log(`[RUGBY API] Processing ${data.response.length} items from API response`);
      
      for (const item of data.response) {
        // Rugby API v1 returns teams directly in response array
        // Structure: { id, name, country: { name }, logo }
        // According to curl, the structure is directly { id, name, country: {...}, logo }
        // So we use item directly, not item.team
        const team = item;
        
        console.log(`[RUGBY API] Processing item:`, {
          hasId: !!team?.id,
          hasName: !!team?.name,
          id: team?.id,
          name: team?.name,
          fullItem: JSON.stringify(team, null, 2).substring(0, 200)
        });
        
        if (team && team.id && team.name) {
          teams.push({
            id: team.id,
            name: team.name,
            code: team.code || undefined,
            logo: team.logo || undefined,
          });
          console.log(`[RUGBY API] ✅ Added team: ${team.name} (ID: ${team.id})`);
        } else {
          console.warn(`[RUGBY API] ⚠️ Skipping invalid team item. Missing id or name:`, {
            hasId: !!team?.id,
            hasName: !!team?.name,
            item: JSON.stringify(team, null, 2).substring(0, 300)
          });
        }
      }
      
      console.log(`[RUGBY API] ✅ Processed ${teams.length} teams from ${data.response.length} items`);
      if (teams.length > 0) {
        console.log(`[RUGBY API] Sample teams:`, teams.slice(0, 3).map(t => ({ id: t.id, name: t.name, hasLogo: !!t.logo, logo: t.logo })));
      } else {
        console.error(`[RUGBY API] ❌ No teams were successfully parsed! Raw response sample:`, JSON.stringify(data.response.slice(0, 2), null, 2));
      }
      return teams;
    } catch (error) {
      console.error(`[RUGBY API] ❌ ERROR in getTeamsByCompetition for competition ${competitionId}, season ${season}:`, error);
      if (error instanceof Error) {
        console.error(`[RUGBY API] Error message: ${error.message}`);
        console.error(`[RUGBY API] Error stack: ${error.stack}`);
      } else {
        console.error(`[RUGBY API] Unknown error type:`, typeof error, error);
      }
      // Re-throw the error so the caller knows something went wrong
      // Instead of silently returning empty array
      throw error;
    }
  }

  /**
   * Get games for a competition and season
   * IMPORTANT: For Rugby, season is REQUIRED and must be a 4-digit partition key (e.g., "2024")
   * Always calls: GET /games?league={leagueId}&season={season} (or with &next=100 for future games)
   * If response length is 0, throws clear error with leagueId, season, and API errors
   */
  async getFixturesByCompetition(
    competitionId: number,
    season: string,
    onlyFuture?: boolean
  ): Promise<RugbyFixture[]> {
    try {
      // Normalize season parameter: extract year if format is "2024-2025" or just use the value if it's "2024"
      // Rugby API v1 expects just the year number (e.g., 2024) as partition key
      let seasonParam = season;
      if (season.includes('-')) {
        seasonParam = season.split('-')[0]; // Extract start year
      }
      seasonParam = seasonParam.replace(/\D/g, ''); // Keep only digits
      
      if (seasonParam.length !== 4) {
        throw new Error(`Invalid season format for Rugby: ${season}. Must be a 4-digit year (e.g., "2024")`);
      }
      
      const now = new Date();
      
      // Rugby API: ALWAYS use /games with season parameter (required partition key)
      // Try /games first, fallback to /fixtures if /games doesn't work
      let endpoint: string;
      let data: any = null;
      let games: any[] = [];
      
      if (onlyFuture) {
        // For future games, use /games with next parameter
        endpoint = `/games?league=${competitionId}&season=${seasonParam}&next=100`;
      } else {
        // For all games
        endpoint = `/games?league=${competitionId}&season=${seasonParam}`;
      }
      
      console.log(`[RUGBY API] Fetching games from endpoint: ${endpoint} (season: ${seasonParam} from ${season})`);
      
      try {
        data = await this.makeRequest(endpoint);
        games = data.response || [];
        console.log(`[RUGBY API] Received ${games.length} games from ${endpoint}`);
      } catch (gamesError) {
        console.warn(`[RUGBY API] /games endpoint failed, trying /fixtures as fallback...`);
        
        // Fallback to /fixtures
        if (onlyFuture) {
          endpoint = `/fixtures?league=${competitionId}&season=${seasonParam}&date=${now.toISOString().split('T')[0]}&timezone=UTC`;
        } else {
          endpoint = `/fixtures?league=${competitionId}&season=${seasonParam}`;
        }
        
        try {
          console.log(`[RUGBY API] Trying fallback endpoint: ${endpoint}`);
          data = await this.makeRequest(endpoint);
          games = data.response || [];
          console.log(`[RUGBY API] Received ${games.length} fixtures from /fixtures endpoint`);
        } catch (fixturesError) {
          const errorMsg = `Both /games and /fixtures endpoints failed for league ${competitionId}, season ${seasonParam}. Games error: ${gamesError instanceof Error ? gamesError.message : String(gamesError)}. Fixtures error: ${fixturesError instanceof Error ? fixturesError.message : String(fixturesError)}`;
          console.error(`[RUGBY API] ❌ ${errorMsg}`);
          throw new Error(errorMsg);
        }
      }
      
      // Check for API errors
      if (data.errors && data.errors.length > 0) {
        const errorMsg = `API errors for league ${competitionId}, season ${seasonParam}: ${JSON.stringify(data.errors)}`;
        console.error(`[RUGBY API] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // If response is empty, throw clear error
      if (!games || games.length === 0) {
        const errorMsg = `No games found for league ${competitionId}, season ${seasonParam}. Response length: ${games.length}. API errors: ${data.errors ? JSON.stringify(data.errors) : 'none'}`;
        console.error(`[RUGBY API] ❌ ${errorMsg}`);
        throw new Error(errorMsg);
      }
      
      // If we got data but games array is empty, log it
      if (data && (!data.response || data.response.length === 0)) {
        console.warn(`[RUGBY API] ⚠️ API returned empty response for ${endpoint}`);
        console.warn(`[RUGBY API] Response structure:`, {
          hasResponse: !!data.response,
          responseType: typeof data.response,
          isArray: Array.isArray(data.response),
          responseLength: data.response?.length || 0,
          fullResponseKeys: Object.keys(data || {}),
          errors: data.errors
        });
      }
      
      // Log the structure of the first game to understand the API response format
      if (games.length > 0) {
        console.log(`[RUGBY API] Sample game structure (first ${Math.min(2, games.length)} games):`, 
          JSON.stringify(games.slice(0, 2), null, 2).substring(0, 1000));
        console.log(`[RUGBY API] First game keys:`, Object.keys(games[0]));
        if (games[0].game) console.log(`[RUGBY API] game.game keys:`, Object.keys(games[0].game));
        if (games[0].fixture) console.log(`[RUGBY API] game.fixture keys:`, Object.keys(games[0].fixture));
        if (games[0].teams) console.log(`[RUGBY API] game.teams keys:`, Object.keys(games[0].teams));
        if (games[0].league) console.log(`[RUGBY API] game.league keys:`, Object.keys(games[0].league));
      }
      
      // Convert games to RugbyFixture format
      // Based on actual API response structure from test:
      // /games returns: { id, date, status: { short }, teams: { home: { id, name }, away: { id, name } }, scores: { home, away }, league: { id, name, season } }
      // /fixtures returns: { fixture: { id, date, status }, teams: { home, away }, goals: { home, away }, league: { id, name } }
      const fixtures: RugbyFixture[] = games.map((game: any) => {
        // Handle /fixtures structure (has fixture object)
        if (game.fixture) {
          return {
            fixture: {
              id: game.fixture.id,
              status: {
                short: game.fixture.status?.short || 'NS',
                elapsed: game.fixture.status?.elapsed || null
              },
              date: game.fixture.date
            },
            teams: {
              home: {
                id: game.teams?.home?.id || 0,
                name: game.teams?.home?.name || ''
              },
              away: {
                id: game.teams?.away?.id || 0,
                name: game.teams?.away?.name || ''
              }
            },
            goals: {
              home: game.goals?.home || null,
              away: game.goals?.away || null,
              extra: game.goals?.extra || null
            },
            league: {
              id: game.league?.id || competitionId,
              name: game.league?.name || '',
              country: game.league?.country?.name || game.league?.country || ''
            }
          };
        }
        
        // Handle /games structure (flat structure - data directly in game object)
        // Structure: { id, date, status: { short }, teams: { home: { id, name }, away: { id, name } }, scores: { home, away }, league: { id, name, season } }
        const gameId = game.id;
        const gameDate = game.date;
        const statusShort = game.status?.short || 'NS';
        const statusElapsed = game.status?.elapsed || null;
        
        const homeTeamId = game.teams?.home?.id || 0;
        const homeTeamName = game.teams?.home?.name || '';
        
        const awayTeamId = game.teams?.away?.id || 0;
        const awayTeamName = game.teams?.away?.name || '';
        
        // Rugby API uses "scores" not "goals" for /games endpoint
        const homeScore = game.scores?.home || game.goals?.home || null;
        const awayScore = game.scores?.away || game.goals?.away || null;
        
        // Map game structure to RugbyFixture structure
        return {
          fixture: {
            id: gameId,
            status: {
              short: statusShort,
              elapsed: statusElapsed
            },
            date: gameDate
          },
          teams: {
            home: {
              id: homeTeamId,
              name: homeTeamName
            },
            away: {
              id: awayTeamId,
              name: awayTeamName
            }
          },
          goals: {
            home: homeScore,
            away: awayScore,
            extra: game.scores?.extra || game.goals?.extra || null
          },
          league: {
            id: game.league?.id || competitionId,
            name: game.league?.name || '',
            country: game.league?.country?.name || game.league?.country || ''
          }
        };
      });
      
      if (onlyFuture) {
        const futureFixtures = fixtures.filter(f => new Date(f.fixture.date) >= now);
        console.log(`[RUGBY API] Filtered to ${futureFixtures.length} future games`);
        return futureFixtures;
      }
      
      return fixtures;
    } catch (error) {
      console.error(`[RUGBY API] ❌ Error fetching games for competition ${competitionId}, season ${season}:`, error);
      if (error instanceof Error) {
        console.error(`[RUGBY API] Error message: ${error.message}`);
        console.error(`[RUGBY API] Error stack: ${error.stack}`);
      } else {
        console.error(`[RUGBY API] Unknown error type:`, typeof error, error);
      }
      // Return empty array instead of throwing - let caller handle empty result
      return [];
    }
  }

  /**
   * Get attribution text
   */
  getAttributionText(): string {
    return "Data provided by api-sports.io";
  }
}

