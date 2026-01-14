/**
 * API-Sports.io V2 Wrapper
 * 
 * This wrapper handles interactions with api-sports.io API
 * Provides live match data including chronometer (elapsed minute)
 */

interface ApiSportsFixture {
  fixture: {
    id: number;
    status: {
      short: string; // "1H", "2H", "HT", "FT", etc.
      elapsed: number | null; // Minute of the match (0-90+)
    };
    date: string; // ISO date string
  };
  teams: {
    home: {
      id: number;
      name: string;
    };
    away: {
      id: number;
      name: string;
    };
  };
  goals: {
    home: number | null;
    away: number | null;
    // Extra time scores (if available)
    extra?: {
      home: number | null;
      away: number | null;
    };
    // Penalty scores (if available) - we don't use these
    penalty?: {
      home: number | null;
      away: number | null;
    };
  };
  league: {
    id: number;
    name: string;
    country: string;
  };
}

interface ApiSportsResponse {
  response: ApiSportsFixture[];
  errors?: any[];
}

export interface ApiSportsMatch {
  id: number;
  status: string; // Mapped internal status (LIVE, FINISHED, etc.)
  externalStatus: string; // Original external status (HT, 1H, 2H, FT, etc.)
  elapsedMinute: number | null;
  homeTeam: {
    id: number;
    name: string;
  };
  awayTeam: {
    id: number;
    name: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
  };
  utcDate: string;
  competition: {
    id: number;
    name: string;
  };
}

/**
 * External competition interface for API responses
 */
export interface ExternalCompetition {
  id: number;
  name: string;
  country: string;
  type: string; // "league", "cup", etc.
  logo?: string;
  seasons: ExternalSeason[];
}

export interface ExternalSeason {
  year: string; // "2024" or "2024-2025"
  start: string; // ISO date
  end: string; // ISO date
  current: boolean;
}

export interface ExternalTeam {
  id: number;
  name: string;
  code?: string;
  logo?: string;
}

export interface ExternalFixture {
  fixture: {
    id: number;
    date: string;
    status: {
      short: string;
      elapsed: number | null;
    };
  };
  teams: {
    home: ExternalTeam;
    away: ExternalTeam;
  };
  goals: {
    home: number | null;
    away: number | null;
  };
  league: {
    id: number;
    name: string;
    country: string;
  };
}

export class ApiSportsV2 {
  private apiKey: string;
  private baseUrl = 'https://v3.football.api-sports.io';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, retryCount = 0): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'x-apisports-key': this.apiKey,
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
        },
        cache: 'no-store', // Disable Next.js fetch cache
      });

      // Handle rate limiting (429) with exponential backoff
      if (response.status === 429) {
        if (retryCount < maxRetries) {
          const delay = baseDelay * Math.pow(2, retryCount);
          console.log(`⏳ Rate limited, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          return this.makeRequest(endpoint, retryCount + 1);
        } else {
          throw new Error('Rate limit exceeded. Maximum retries reached.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API-Sports.io API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from API-Sports.io API');
      }

      // Check for API errors in response
      if (data.errors && data.errors.length > 0) {
        throw new Error(`API-Sports.io errors: ${JSON.stringify(data.errors)}`);
      }

      return data;
    } catch (error) {
      if (retryCount < maxRetries && error instanceof Error && error.message.includes('fetch')) {
        const delay = baseDelay * Math.pow(2, retryCount);
        console.log(`🔄 Network error, retrying in ${delay}ms (attempt ${retryCount + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.makeRequest(endpoint, retryCount + 1);
      }
      throw error;
    }
  }

  /**
   * Get live matches from API-Sports.io
   */
  async getLiveMatches(): Promise<ApiSportsMatch[]> {
    try {
      console.log('🔍 Fetching live matches from API-Sports.io...');
      console.log('🔍 Endpoint: /fixtures?live=all');
      
      // Get live matches - using live=all to get all live matches
      const response: ApiSportsResponse = await this.makeRequest('/fixtures?live=all');
      
      console.log(`📊 Raw API response:`, JSON.stringify({
        hasResponse: !!response.response,
        responseIsArray: Array.isArray(response.response),
        responseLength: response.response?.length || 0,
        hasErrors: !!response.errors,
        errors: response.errors
      }, null, 2));
      
      if (!response.response || !Array.isArray(response.response)) {
        console.log('⚠️ Invalid response structure from API-Sports.io');
        if (response.errors) {
          console.log('⚠️ API Errors:', response.errors);
        }
        return [];
      }
      
      console.log(`📊 Found ${response.response.length} live matches from API-Sports.io`);
      
      // Log elapsed times for debugging
      if (response.response.length > 0) {
        console.log('🔍 Sample match elapsed times:');
        response.response.slice(0, 3).forEach((fixture: ApiSportsFixture) => {
          console.log(`   ${fixture.teams.home.name} vs ${fixture.teams.away.name}: status=${fixture.fixture.status.short}, elapsed=${fixture.fixture.status.elapsed}`);
        });
      }
      
      // Convert to our format
      const matches: ApiSportsMatch[] = response.response.map((fixture: ApiSportsFixture) => {
        // Score logic:
        // - FT (90 min): use fullTime score
        // - AET (120 min): use extraTime score if available, otherwise fullTime
        // - PEN (penalties): use extraTime score if available (120 min), otherwise fullTime
        // We NEVER use penalty kick scores
        let finalHomeScore = fixture.goals.home; // Default: fullTime score (90 min)
        let finalAwayScore = fixture.goals.away;
        
        // If match went to extra time (AET) or penalties (PEN), use extra time score
        if ((fixture.fixture.status.short === 'AET' || fixture.fixture.status.short === 'PEN') && fixture.goals.extra) {
          finalHomeScore = fixture.goals.extra.home;
          finalAwayScore = fixture.goals.extra.away;
        }
        
        return {
          id: fixture.fixture.id,
          status: this.mapStatus(fixture.fixture.status.short),
          externalStatus: fixture.fixture.status.short, // Store original external status (HT, 1H, 2H, etc.)
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
              home: finalHomeScore,
              away: finalAwayScore,
            },
          },
          utcDate: fixture.fixture.date,
          competition: {
            id: fixture.league.id,
            name: fixture.league.name,
          },
        };
      });

      // V2: Return all live matches (not just Champions League)
      // This allows matching with any competition in our database
      console.log(`✅ Found ${matches.length} live matches from API-Sports.io`);
      return matches;
      
    } catch (error) {
      console.error('❌ Error fetching live matches from API-Sports.io:', error);
      return [];
    }
  }

  /**
   * Get matches by date range
   */
  async getMatchesByDateRange(startDate: string, endDate: string): Promise<ApiSportsMatch[]> {
    try {
      console.log(`🔍 Fetching matches from ${startDate} to ${endDate} from API-Sports.io...`);
      
      // Try single date first (API-Sports.io might prefer single date)
      console.log(`🔍 Trying endpoint: /fixtures?date=${startDate}`);
      let response: ApiSportsResponse;
      
      try {
        response = await this.makeRequest(`/fixtures?date=${startDate}`);
        console.log(`📊 Single date query returned ${response.response?.length || 0} matches`);
      } catch (error) {
        console.log(`⚠️ Single date query failed, trying date range...`);
        console.log(`🔍 Trying endpoint: /fixtures?date=${startDate}&to=${endDate}`);
        response = await this.makeRequest(`/fixtures?date=${startDate}&to=${endDate}`);
      }
      
      console.log(`📊 Raw API response:`, JSON.stringify({
        hasResponse: !!response.response,
        responseIsArray: Array.isArray(response.response),
        responseLength: response.response?.length || 0,
        hasErrors: !!response.errors,
        errors: response.errors
      }, null, 2));
      
      if (!response.response || !Array.isArray(response.response)) {
        console.log('⚠️ Invalid response structure from API-Sports.io');
        if (response.errors) {
          console.log('⚠️ API Errors:', response.errors);
        }
        return [];
      }
      
      console.log(`📊 Found ${response.response.length} matches in date range`);
      
      // Log first few matches for debugging
      if (response.response.length > 0) {
        console.log('🔍 Sample matches from API:');
        response.response.slice(0, 3).forEach((fixture: ApiSportsFixture) => {
          console.log(`   ${fixture.teams.home.name} vs ${fixture.teams.away.name}: status=${fixture.fixture.status.short}, date=${fixture.fixture.date}`);
        });
      }
      
      // Convert to our format
      const matches: ApiSportsMatch[] = response.response.map((fixture: ApiSportsFixture) => {
        // Score logic:
        // - FT (90 min): use fullTime score
        // - AET (120 min): use extraTime score if available, otherwise fullTime
        // - PEN (penalties): use extraTime score if available (120 min), otherwise fullTime
        // We NEVER use penalty kick scores
        let finalHomeScore = fixture.goals.home; // Default: fullTime score (90 min)
        let finalAwayScore = fixture.goals.away;
        
        // If match went to extra time (AET) or penalties (PEN), use extra time score
        if ((fixture.fixture.status.short === 'AET' || fixture.fixture.status.short === 'PEN') && fixture.goals.extra) {
          finalHomeScore = fixture.goals.extra.home;
          finalAwayScore = fixture.goals.extra.away;
        }
        
        return {
          id: fixture.fixture.id,
          status: this.mapStatus(fixture.fixture.status.short),
          externalStatus: fixture.fixture.status.short, // Store original external status (HT, 1H, 2H, etc.)
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
              home: finalHomeScore,
              away: finalAwayScore,
            },
          },
          utcDate: fixture.fixture.date,
          competition: {
            id: fixture.league.id,
            name: fixture.league.name,
          },
        };
      });

      return matches;
    } catch (error) {
      console.error('❌ Error fetching matches by date range from API-Sports.io:', error);
      return [];
    }
  }

  /**
   * Get match by fixture ID
   */
  async getMatchById(fixtureId: number): Promise<ApiSportsMatch | null> {
    try {
      console.log(`🔍 Fetching match ${fixtureId} from API-Sports.io...`);
      
      const response: ApiSportsResponse = await this.makeRequest(
        `/fixtures?id=${fixtureId}`
      );
      
      if (!response.response || !Array.isArray(response.response) || response.response.length === 0) {
        console.log(`⚠️ Match ${fixtureId} not found in API-Sports.io`);
        return null;
      }
      
      const fixture: ApiSportsFixture = response.response[0];
      
      // Score logic same as other methods
      let finalHomeScore = fixture.goals.home;
      let finalAwayScore = fixture.goals.away;
      
      if ((fixture.fixture.status.short === 'AET' || fixture.fixture.status.short === 'PEN') && fixture.goals.extra) {
        finalHomeScore = fixture.goals.extra.home;
        finalAwayScore = fixture.goals.extra.away;
      }
      
      return {
        id: fixture.fixture.id,
        status: this.mapStatus(fixture.fixture.status.short),
        externalStatus: fixture.fixture.status.short,
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
            home: finalHomeScore,
            away: finalAwayScore,
          },
        },
        utcDate: fixture.fixture.date,
        competition: {
          id: fixture.league.id,
          name: fixture.league.name,
        },
      };
    } catch (error) {
      console.error(`❌ Error fetching match ${fixtureId} from API-Sports.io:`, error);
      return null;
    }
  }

  /**
   * Map API-Sports.io status to our internal status
   */
  mapStatus(externalStatus: string): string {
    switch (externalStatus) {
      case 'NS': // Not Started
      case 'TBD': // To Be Determined
        return 'UPCOMING';
      case '1H': // First Half
      case '2H': // Second Half
      case 'LIVE':
        return 'LIVE';
      case 'HT': // Half Time
      case 'P': // Paused
        return 'LIVE'; // Still considered live
      case 'FT': // Full Time
      case 'AET': // After Extra Time
      case 'PEN': // Penalties
        return 'FINISHED';
      case 'PST': // Postponed
      case 'CANC': // Cancelled
      case 'SUSP': // Suspended
        return 'CANCELLED';
      default:
        console.log(`⚠️ Unknown API-Sports.io status: ${externalStatus}, defaulting to UPCOMING`);
        return 'UPCOMING';
    }
  }

  /**
   * Get attribution text as required by API-Sports.io
   */
  getAttributionText(): string {
    return "Data provided by api-sports.io";
  }

  /**
   * Get all available competitions from API-Sports.io
   * Optionally filter by country
   */
  async getCompetitions(country?: string): Promise<ExternalCompetition[]> {
    try {
      console.log(`🔍 Fetching competitions from API-Sports.io${country ? ` (country: ${country})` : ''}...`);
      
      const endpoint = country 
        ? `/leagues?country=${encodeURIComponent(country)}`
        : '/leagues';
      
      const response = await this.makeRequest(endpoint);
      
      if (!response.response || !Array.isArray(response.response)) {
        console.log('⚠️ Invalid response structure from API-Sports.io');
        return [];
      }
      
      // Group by competition ID and merge seasons
      const competitionsMap = new Map<number, ExternalCompetition>();
      
      for (const item of response.response) {
        const leagueId = item.league.id;
        const existing = competitionsMap.get(leagueId);
        
        const season: ExternalSeason = {
          year: item.seasons?.[0]?.year || '',
          start: item.seasons?.[0]?.start || '',
          end: item.seasons?.[0]?.end || '',
          current: item.seasons?.[0]?.current || false,
        };
        
        if (existing) {
          // Add season if not already present
          const seasonExists = existing.seasons.some(s => s.year === season.year);
          if (!seasonExists) {
            existing.seasons.push(season);
          }
        } else {
          competitionsMap.set(leagueId, {
            id: leagueId,
            name: item.league.name,
            country: item.country.name || item.league.country || '',
            type: item.league.type || 'league',
            logo: item.league.logo,
            seasons: [season],
          });
        }
      }
      
      const competitions = Array.from(competitionsMap.values());
      console.log(`✅ Found ${competitions.length} competitions from API-Sports.io`);
      
      return competitions;
    } catch (error) {
      console.error('❌ Error fetching competitions from API-Sports.io:', error);
      return [];
    }
  }

  /**
   * Get seasons for a specific competition
   */
  async getCompetitionSeasons(competitionId: number): Promise<ExternalSeason[]> {
    try {
      console.log(`🔍 Fetching seasons for competition ${competitionId}...`);
      
      const response = await this.makeRequest(`/leagues?id=${competitionId}`);
      
      if (!response.response || !Array.isArray(response.response) || response.response.length === 0) {
        console.log(`⚠️ Competition ${competitionId} not found`);
        return [];
      }
      
      const seasons: ExternalSeason[] = response.response
        .flatMap((item: any) => item.seasons || [])
        .map((season: any) => ({
          year: season.year || '',
          start: season.start || '',
          end: season.end || '',
          current: season.current || false,
        }))
        .filter((s: ExternalSeason) => s.year && s.start && s.end);
      
      // Remove duplicates
      const uniqueSeasons = seasons.filter((s, index, self) => 
        index === self.findIndex(se => se.year === s.year)
      );
      
      console.log(`✅ Found ${uniqueSeasons.length} seasons for competition ${competitionId}`);
      return uniqueSeasons;
    } catch (error) {
      console.error(`❌ Error fetching seasons for competition ${competitionId}:`, error);
      return [];
    }
  }

  /**
   * Get current or next season for a competition
   * Returns ongoing season if exists, otherwise next season
   */
  async getCurrentOrNextSeason(competitionId: number): Promise<ExternalSeason | null> {
    try {
      const seasons = await this.getCompetitionSeasons(competitionId);
      
      if (seasons.length === 0) {
        return null;
      }
      
      const now = new Date();
      
      // Find ongoing season
      const ongoingSeason = seasons.find(s => {
        const start = new Date(s.start);
        const end = new Date(s.end);
        return start <= now && now <= end;
      });
      
      if (ongoingSeason) {
        console.log(`✅ Found ongoing season: ${ongoingSeason.year}`);
        return ongoingSeason;
      }
      
      // Find next season
      const futureSeasons = seasons
        .filter(s => new Date(s.start) > now)
        .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
      
      if (futureSeasons.length > 0) {
        console.log(`✅ Found next season: ${futureSeasons[0].year}`);
        return futureSeasons[0];
      }
      
      // If no future season, return the most recent one
      const mostRecent = seasons.sort((a, b) => 
        new Date(b.start).getTime() - new Date(a.start).getTime()
      )[0];
      
      console.log(`⚠️ No ongoing or future season found, using most recent: ${mostRecent.year}`);
      return mostRecent;
    } catch (error) {
      console.error(`❌ Error getting current/next season for competition ${competitionId}:`, error);
      return null;
    }
  }

  /**
   * Get teams for a specific competition and season
   */
  async getTeamsByCompetition(competitionId: number, season: string): Promise<ExternalTeam[]> {
    try {
      console.log(`🔍 Fetching teams for competition ${competitionId}, season ${season}...`);
      
      const response = await this.makeRequest(
        `/teams?league=${competitionId}&season=${season}`
      );
      
      if (!response.response || !Array.isArray(response.response)) {
        console.log('⚠️ Invalid response structure from API-Sports.io');
        return [];
      }
      
      const teams: ExternalTeam[] = response.response.map((item: any) => ({
        id: item.team.id,
        name: item.team.name,
        code: item.team.code,
        logo: item.team.logo,
      }));
      
      console.log(`✅ Found ${teams.length} teams for competition ${competitionId}, season ${season}`);
      return teams;
    } catch (error) {
      console.error(`❌ Error fetching teams for competition ${competitionId}, season ${season}:`, error);
      return [];
    }
  }

  /**
   * Get fixtures for a specific competition and season
   * @param onlyFuture If true, only return fixtures with date >= today
   */
  async getFixturesByCompetition(
    competitionId: number,
    season: string,
    onlyFuture: boolean = false
  ): Promise<ExternalFixture[]> {
    try {
      console.log(`🔍 Fetching fixtures for competition ${competitionId}, season ${season}${onlyFuture ? ' (future only)' : ''}...`);
      
      const response = await this.makeRequest(
        `/fixtures?league=${competitionId}&season=${season}`
      );
      
      if (!response.response || !Array.isArray(response.response)) {
        console.log('⚠️ Invalid response structure from API-Sports.io');
        return [];
      }
      
      let fixtures: ExternalFixture[] = response.response;
      
      // Filter out LIVE matches (as per user requirement)
      fixtures = fixtures.filter((f: ExternalFixture) => {
        const status = f.fixture.status.short;
        return status !== '1H' && status !== '2H' && status !== 'HT' && status !== 'LIVE';
      });
      
      // Filter future matches if requested
      if (onlyFuture) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        fixtures = fixtures.filter((f: ExternalFixture) => {
          const fixtureDate = new Date(f.fixture.date);
          fixtureDate.setHours(0, 0, 0, 0);
          return fixtureDate >= today;
        });
      }
      
      console.log(`✅ Found ${fixtures.length} fixtures for competition ${competitionId}, season ${season}`);
      return fixtures;
    } catch (error) {
      console.error(`❌ Error fetching fixtures for competition ${competitionId}, season ${season}:`, error);
      return [];
    }
  }

  /**
   * Normalize team name for matching (enhanced version matching V1)
   */
  normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      // Remove common football club suffixes
      .replace(/\s+fc$/g, '')
      .replace(/\s+cf$/g, '')
      .replace(/\s+ac$/g, '')
      .replace(/\s+as$/g, '')
      .replace(/\s+united$/g, '')
      .replace(/\s+city$/g, '')
      .replace(/\s+real$/g, '')
      .replace(/\s+afc$/g, '')
      // Remove common prefixes
      .replace(/^fc\s+/g, '')
      .replace(/^cf\s+/g, '')
      .replace(/^ac\s+/g, '')
      .replace(/^as\s+/g, '')
      .replace(/^club\s+/g, '')
      // Handle French team name patterns
      .replace(/^olympique\s+/g, '') // "Olympique Lyonnais" -> "lyonnais"
      .replace(/^ol\s+/g, '') // "OL" -> ""
      // Handle special characters and accents
      .replace(/[àáâãäå]/g, 'a')
      .replace(/[èéêë]/g, 'e')
      .replace(/[ìíîï]/g, 'i')
      .replace(/[òóôõö]/g, 'o')
      .replace(/[ùúûü]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[ç]/g, 'c')
      .replace(/[ø]/g, 'o')
      .replace(/[æ]/g, 'ae')
      .replace(/[ß]/g, 'ss')
      // Clean up extra spaces
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Calculate similarity between two strings (0-1, higher = more similar)
   */
  calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  levenshteinDistance(str1: string, str2: string): number {
    const matrix: number[][] = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  /**
   * Calculate partial match score (checks if one name contains the other)
   */
  private calculatePartialMatch(name1: string, name2: string): number {
    const norm1 = this.normalizeTeamName(name1);
    const norm2 = this.normalizeTeamName(name2);
    
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      const shorter = norm1.length < norm2.length ? norm1 : norm2;
      const longer = norm1.length >= norm2.length ? norm1 : norm2;
      return shorter.length / longer.length;
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
    
    const commonWords = words1.filter(word1 => 
      words2.some(word2 => 
        this.calculateSimilarity(word1, word2) > 0.8
      )
    );
    
    return commonWords.length / Math.max(words1.length, words2.length);
  }

  /**
   * Find best team match using advanced matching strategies (matching V1)
   */
  findBestTeamMatch(externalTeamName: string, ourTeams: Array<{id: string, name: string, shortName?: string | null}>): {team: any, score: number, method: string} | null {
    const strategies = [
      { name: 'exact_normalized', threshold: 0.95, weight: 1.0 },
      { name: 'short_name_match', threshold: 0.9, weight: 0.95 }, // New: match by shortName
      { name: 'fuzzy_normalized', threshold: 0.7, weight: 0.9 },
      { name: 'partial_match', threshold: 0.6, weight: 0.8 },
      { name: 'word_overlap', threshold: 0.5, weight: 0.7 },
      { name: 'contains_keyword', threshold: 0.4, weight: 0.6 } // New: check if one name contains key words from the other
    ];

    let bestMatch = null;
    let bestScore = 0;
    let bestMethod = '';

    // Normalize external name once
    const normalizedExternal = this.normalizeTeamName(externalTeamName);
    const externalKeywords = normalizedExternal.split(/\s+/).filter(w => w.length > 2); // Extract meaningful words

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
            // Match by shortName if available (e.g., "Lyon" matches "Olympique Lyonnais" if shortName is "LYO")
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
              // e.g., "olympique lyonnais" contains "lyonnais" which could match "lyon"
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
      console.log(`🎯 Advanced match: "${externalTeamName}" → "${bestMatch.name}"${bestMatch.shortName ? ` (${bestMatch.shortName})` : ''} (${(bestScore * 100).toFixed(1)}% via ${bestMethod})`);
    } else {
      console.log(`❌ No advanced match found for: "${externalTeamName}"`);
    }

    return bestMatch ? { team: bestMatch, score: bestScore, method: bestMethod } : null;
  }
}

