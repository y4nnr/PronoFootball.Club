// Mock Football-Data.org API service for testing
export interface MockFootballDataMatch {
  id: number;
  utcDate: string;
  status: string;
  score: {
    fullTime: { home: number; away: number };
    halfTime: { home: number; away: number };
  };
  homeTeam: { name: string };
  awayTeam: { name: string };
  competition: { name: string };
}

class MockFootballDataAPI {
  private baseUrl = 'http://localhost:3000/api/mock-football-data';

  async makeRequest<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mock API request failed: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.makeRequest('/');
      return true;
    } catch (error) {
      console.error('Mock API connection failed:', error);
      return false;
    }
  }

  async getLiveMatches(): Promise<MockFootballDataMatch[]> {
    const response = await this.makeRequest<{ count: number; matches: MockFootballDataMatch[] }>('?competitions=CL&status=IN_PLAY');
    return response.matches || [];
  }

  async getChampionsLeagueMatches(): Promise<MockFootballDataMatch[]> {
    const response = await this.makeRequest<{ count: number; matches: MockFootballDataMatch[] }>('?competitions=CL');
    return response.matches || [];
  }

  async getAllRelevantMatches(): Promise<MockFootballDataMatch[]> {
    const response = await this.makeRequest<{ count: number; matches: MockFootballDataMatch[] }>('?competitions=CL&status=SCHEDULED,IN_PLAY,FINISHED');
    return response.matches || [];
  }

  mapExternalStatusToInternal(externalStatus: string): 'UPCOMING' | 'LIVE' | 'FINISHED' | 'CANCELLED' {
    switch (externalStatus) {
      case 'SCHEDULED':
      case 'TIMED':
        return 'UPCOMING';
      case 'IN_PLAY':
      case 'PAUSED':
        return 'LIVE';
      case 'FINISHED':
      case 'AET':
      case 'PEN':
        return 'FINISHED';
      case 'POSTPONED':
      case 'SUSPENDED':
        return 'UPCOMING';
      case 'CANCELED':
      case 'CANCELLED':
        return 'FINISHED';
      default:
        return 'UPCOMING';
    }
  }
}

export default MockFootballDataAPI;
