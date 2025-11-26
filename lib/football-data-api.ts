interface FootballDataMatch {
  id: number;
  status: string;
  homeTeam: {
    id: number;
    name: string;
    shortName: string;
  };
  awayTeam: {
    id: number;
    name: string;
    shortName: string;
  };
  score: {
    fullTime: {
      home: number | null;
      away: number | null;
    };
    halfTime: {
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

interface FootballDataResponse {
  matches: FootballDataMatch[];
}

export class FootballDataAPI {
  private apiKey: string;
  private baseUrl = 'https://api.football-data.org/v4';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, retryCount = 0): Promise<any> {
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    try {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        headers: {
          'X-Auth-Token': this.apiKey,
          'Content-Type': 'application/json',
        },
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
        throw new Error(`Football-Data.org API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      const data = await response.json();
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from Football-Data.org API');
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

  async getLiveMatches(): Promise<FootballDataMatch[]> {
    try {
      console.log('🔍 Fetching live matches from Football-Data.org...');
      
      // Primary: Use the dedicated live matches endpoint (best practice)
      try {
        const response: FootballDataResponse = await this.makeRequest('/matches?status=LIVE');
        
        if (!response.matches || !Array.isArray(response.matches)) {
          console.log('⚠️ Invalid response structure from LIVE endpoint');
          throw new Error('Invalid response structure');
        }
        
        console.log(`📊 Found ${response.matches.length} LIVE matches from status=LIVE endpoint`);
        
        // Validate and filter matches - only Champions League
        const validMatches = response.matches.filter(match => {
          if (!match || typeof match !== 'object') return false;
          if (!match.homeTeam || !match.awayTeam) return false;
          if (!match.score || typeof match.score !== 'object') return false;
          // Only include Champions League matches
          return match.competition && match.competition.name === 'UEFA Champions League';
        });
        
        console.log(`✅ Validated ${validMatches.length} matches`);
        return validMatches;
        
      } catch (error) {
        console.log('⚠️ LIVE endpoint failed, falling back to date-based search...');
        console.log('Error:', error instanceof Error ? error.message : 'Unknown error');
        
        // Fallback: Use date-based search with proper error handling
        const today = new Date();
        const dateStr = today.toISOString().split('T')[0];
        
        const response: FootballDataResponse = await this.makeRequest(`/matches?date=${dateStr}`);
        
        if (!response.matches || !Array.isArray(response.matches)) {
          console.log('⚠️ Invalid response structure from date endpoint');
          return [];
        }
        
        console.log(`📊 Found ${response.matches.length} matches for today`);
        
              // Filter for live Champions League matches with proper validation
              const liveMatches = response.matches.filter(match => {
                if (!match || typeof match !== 'object') return false;
                if (!match.homeTeam || !match.awayTeam) return false;
                if (!match.score || typeof match.score !== 'object') return false;
                
                // Only include Champions League matches
                const isChampionsLeague = match.competition && match.competition.name === 'UEFA Champions League';
                const isLiveStatus = match.status === 'IN_PLAY' || 
                                   match.status === 'PAUSED' || 
                                   match.status === 'FINISHED';
                
                return isChampionsLeague && isLiveStatus;
              });
        
        console.log(`⚽ Found ${liveMatches.length} live/finished matches from date search`);
        
        return liveMatches;
      }
    } catch (error) {
      console.error('❌ Error fetching live matches:', error);
      
      // Return empty array instead of throwing to prevent app crashes
      console.log('🔄 Returning empty array due to API error');
      return [];
    }
  }

  async getMatchesByDateRange(startDate: string, endDate: string): Promise<FootballDataMatch[]> {
    try {
      console.log(`🔍 Fetching matches from ${startDate} to ${endDate}...`);
      
      const response: FootballDataResponse = await this.makeRequest(
        `/matches?dateFrom=${startDate}&dateTo=${endDate}`
      );
      
      console.log(`📊 Found ${response.matches.length} matches in date range`);
      
      return response.matches;
    } catch (error) {
      console.error('❌ Error fetching matches by date range:', error);
      throw error;
    }
  }

  // Get attribution text as required by Football-Data.org
  getAttributionText(): string {
    return "Data provided by football-data.org";
  }

  // Dynamic team name normalization - removes common prefixes/suffixes
  normalizeTeamName(name: string): string {
    return name
      .toLowerCase()
      .replace(/\s+/g, ' ')
      // Remove common football club suffixes (be more specific)
      .replace(/\s+fc$/g, '')
      .replace(/\s+cf$/g, '')
      .replace(/\s+ac$/g, '')
      .replace(/\s+as$/g, '')
      .replace(/\s+united$/g, '')
      .replace(/\s+city$/g, '')
      .replace(/\s+real$/g, '')
      .replace(/\s+pae$/g, '')
      .replace(/\s+sfp$/g, '')
      .replace(/\s+fk$/g, '')
      .replace(/\s+ec$/g, '')
      .replace(/\s+afc$/g, '')
      .replace(/\s+sk$/g, '')
      .replace(/\s+aş$/g, '')
      .replace(/\s+ağdam$/g, '')
      .replace(/\s+ağdam\s+fk$/g, '')
      // Remove common prefixes (be more specific)
      .replace(/^fc\s+/g, '')
      .replace(/^cf\s+/g, '')
      .replace(/^ac\s+/g, '')
      .replace(/^as\s+/g, '')
      .replace(/^real\s+/g, '')
      .replace(/^pae\s+/g, '')
      .replace(/^sfp\s+/g, '')
      .replace(/^fk\s+/g, '')
      .replace(/^ec\s+/g, '')
      .replace(/^club\s+/g, '')
      .replace(/^sport\s+/g, '')
      .replace(/^royale\s+/g, '')
      .replace(/^ssc\s+/g, '')
      .replace(/^bayer\s+04\s+/g, 'bayer ')
      // Handle specific team name variations
      .replace(/internazionale\s+milano/g, 'inter milan')
      .replace(/internazionale/g, 'inter milan')
      .replace(/lisboa\s+e\s+benfica/g, 'benfica')
      .replace(/lisboa\s+benfica/g, 'benfica')
      .replace(/københavn/g, 'copenhagen')
      .replace(/atlético\s+de\s+madrid/g, 'atlético madrid')
      .replace(/atlético\s+madrid/g, 'atlético madrid')
      .replace(/saint-gilloise/g, 'saint-gilloise')
      .replace(/union\s+saint-gilloise/g, 'union saint-gilloise')
      .replace(/manchester\s+city\s+fc/g, 'manchester city')
      .replace(/villarreal\s+cf/g, 'villarreal')
      .replace(/psv\s+eindhoven/g, 'psv eindhoven')
      .replace(/psv$/g, 'psv eindhoven')
      .replace(/napoli\s+ssc/g, 'napoli')
      .replace(/ssc\s+napoli/g, 'napoli')
      // Handle specific problematic team names
      .replace(/galatasaray\s+sk/g, 'galatasaray')
      .replace(/galatasaray\s+aş/g, 'galatasaray')
      .replace(/fk\s+bodø\/glimt/g, 'bodø/glimt')
      .replace(/bodo\s+glimt/g, 'bodø/glimt')
      .replace(/qarabağ\s+ağdam\s+fk/g, 'qarabağ')
      .replace(/qarabağ\s+ağdam/g, 'qarabağ')
      .replace(/athletic\s+bilbao/g, 'athletic club')
      // Marseille variations
      .replace(/olympique\s+de\s+marseille/g, 'marseille')
      .replace(/olympique\s+marseille/g, 'marseille')
      .replace(/om\s+marseille/g, 'marseille')
      .replace(/^om$/g, 'marseille')
      // Sporting variations
      .replace(/sporting\s+clube\s+de\s+portugal/g, 'sporting cp')
      .replace(/sporting\s+cp\s+portugal/g, 'sporting cp')
      .replace(/sporting\s+du\s+portugal/g, 'sporting cp')
      .replace(/sporting\s+portugal/g, 'sporting cp')
      // Monaco variations
      .replace(/as\s+monaco/g, 'monaco')
      .replace(/monaco\s+fc/g, 'monaco')
      .replace(/^monaco$/g, 'monaco')
      // Pafos variations
      .replace(/pafos\s+fc/g, 'pafos')
      .replace(/pafo\s+fc/g, 'pafos')
      .replace(/^pafo$/g, 'pafos')
      .replace(/^pafos$/g, 'pafos')
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

  // Calculate similarity between two strings (0-1, higher = more similar)
  calculateSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  // Calculate Levenshtein distance between two strings
  levenshteinDistance(str1: string, str2: string): number {
    const matrix = [];
    
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

  // Find best matching team using fuzzy matching
  findBestMatch(externalTeamName: string, ourTeams: string[]): string | null {
    const normalizedExternal = this.normalizeTeamName(externalTeamName);
    let bestMatch = null;
    let bestScore = 0;
    const threshold = 0.6; // Minimum similarity threshold (60%)
    
    for (const ourTeam of ourTeams) {
      const normalizedOur = this.normalizeTeamName(ourTeam);
      const similarity = this.calculateSimilarity(normalizedExternal, normalizedOur);
      
      if (similarity > bestScore && similarity >= threshold) {
        bestScore = similarity;
        bestMatch = ourTeam;
      }
    }
    
    if (bestMatch) {
      console.log(`🎯 Team match: "${externalTeamName}" → "${bestMatch}" (${Math.round(bestScore * 100)}% similarity)`);
    } else {
      console.log(`❌ No match found for: "${externalTeamName}" (best score: ${Math.round(bestScore * 100)}%)`);
    }
    
    return bestMatch;
  }

  // Advanced team name matching with multiple strategies
  findBestTeamMatch(externalTeamName: string, ourTeams: Array<{id: string, name: string}>): {team: any, score: number, method: string} | null {
    const strategies = [
      { name: 'exact_normalized', threshold: 0.95, weight: 1.0 },
      { name: 'fuzzy_normalized', threshold: 0.7, weight: 0.9 },
      { name: 'partial_match', threshold: 0.6, weight: 0.8 },
      { name: 'word_overlap', threshold: 0.5, weight: 0.7 }
    ];

    let bestMatch = null;
    let bestScore = 0;
    let bestMethod = '';

    for (const ourTeam of ourTeams) {
      for (const strategy of strategies) {
        let score = 0;
        let method = '';

        switch (strategy.name) {
          case 'exact_normalized':
            const normalizedExternal = this.normalizeTeamName(externalTeamName);
            const normalizedOur = this.normalizeTeamName(ourTeam.name);
            if (normalizedExternal === normalizedOur) {
              score = 1.0;
              method = 'exact_normalized';
            }
            break;

          case 'fuzzy_normalized':
            const fuzzyExternal = this.normalizeTeamName(externalTeamName);
            const fuzzyOur = this.normalizeTeamName(ourTeam.name);
            score = this.calculateSimilarity(fuzzyExternal, fuzzyOur);
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
      console.log(`🎯 Advanced match: "${externalTeamName}" → "${bestMatch.name}" (${(bestScore * 100).toFixed(1)}% via ${bestMethod})`);
    } else {
      console.log(`❌ No advanced match found for: "${externalTeamName}"`);
    }

    return bestMatch ? { team: bestMatch, score: bestScore, method: bestMethod } : null;
  }

  // Calculate partial match score (checks if one name contains the other)
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

  // Calculate word overlap score
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

  // Map external status to internal status
  mapStatus(externalStatus: string): string {
    switch (externalStatus) {
      case 'SCHEDULED':
      case 'TIMED':
        return 'UPCOMING';
      case 'IN_PLAY':
      case 'PAUSED':
      case 'LIVE':
        return 'LIVE';
      case 'FINISHED':
      case 'COMPLETED':
        return 'FINISHED';
      case 'POSTPONED':
      case 'SUSPENDED':
      case 'CANCELLED':
        return 'CANCELLED';
      default:
        console.log(`⚠️ Unknown external status: ${externalStatus}, defaulting to UPCOMING`);
        return 'UPCOMING';
    }
  }
}